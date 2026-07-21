import httpx, time, json
from pathlib import Path
from app.config import settings
from app.providers.base import AIProvider, GenerateResult

API_KEY = settings.api_key
BASE = settings.rh_base_url
WORKFLOW_ID = settings.rh_workflow_id

NODE_IDS = {
    "guest_image": "2",
    "style_ref": "3",
    "model": "1",
}

class RunningHubProvider(AIProvider):
    def __init__(self):
        self._client = httpx.Client(timeout=180)

    def _upload(self, file_path: str) -> str:
        with open(file_path, "rb") as f:
            r = self._client.post(
                f"{BASE}/task/openapi/upload",
                data={"apiKey": API_KEY},
                files={"file": ("image.jpg", f, "image/jpeg")},
            )
        data = r.json()
        if data.get("code") != 0:
            raise RuntimeError(f"Upload failed: {data.get('msg')}")
        return data["data"]["fileName"]

    def upload_image(self, image_path: str) -> str:
        return self._upload(image_path)

    def _wait_for_task(self, task_id: str, poll_interval: int = 3, max_wait: int = 200) -> dict:
        start = time.time()
        while time.time() - start < max_wait:
            r = self._client.post(
                f"{BASE}/task/openapi/status",
                json={"apiKey": API_KEY, "taskId": task_id},
            )
            data = r.json()
            status = data.get("data")
            if status == "SUCCESS":
                r2 = self._client.post(
                    f"{BASE}/task/openapi/outputs",
                    json={"apiKey": API_KEY, "taskId": task_id},
                )
                outputs = r2.json()
                items = outputs.get("data", [])
                if items:
                    return items[0]
                raise RuntimeError("No outputs returned for successful task")
            elif status == "FAILED":
                raise RuntimeError(f"Task {task_id} failed")
            time.sleep(poll_interval)
        raise TimeoutError(f"Task {task_id} did not complete in {max_wait}s")

    def _normalize_filename(self, name: str) -> str:
        parts = name.split("/")
        if len(parts) == 2 and parts[0] == "api":
            return name
        return name.replace("\\", "/")

    def generate(
        self,
        guest_image_path: str,
        rh_ref_file: str,
        prompt: str,
        seed: int | None = None,
        resolution: str = "2k",
        aspect_ratio: str = "2:3",
    ) -> GenerateResult:
        if seed is None:
            import random
            seed = random.randint(0, 2**31 - 1)

        guest_fn = self._upload(guest_image_path)

        if not rh_ref_file:
            raise ValueError("No style reference file (rh_ref_file) configured for this style")

        node_overrides = [
            {"nodeId": NODE_IDS["guest_image"], "fieldName": "image", "fieldValue": guest_fn},
            {"nodeId": NODE_IDS["style_ref"], "fieldName": "image", "fieldValue": rh_ref_file},
            {"nodeId": NODE_IDS["model"], "fieldName": "prompt", "fieldValue": prompt},
            {"nodeId": NODE_IDS["model"], "fieldName": "seed", "fieldValue": str(seed)},
            {"nodeId": NODE_IDS["model"], "fieldName": "resolution", "fieldValue": resolution},
            {"nodeId": NODE_IDS["model"], "fieldName": "aspectRatio", "fieldValue": aspect_ratio},
        ]

        r = self._client.post(
            f"{BASE}/task/openapi/create",
            json={"apiKey": API_KEY, "workflowId": WORKFLOW_ID, "nodeInfoList": node_overrides},
        )
        result = r.json()
        if result.get("code") != 0:
            raise RuntimeError(f"Task creation failed: {result.get('msg')}")

        task_id = result["data"]["taskId"]
        output = self._wait_for_task(task_id)
        return GenerateResult(
            image_url=output["fileUrl"],
            task_id=task_id,
            cost_time=int(output.get("taskCostTime", 0)),
            cost_money=float(output.get("thirdPartyConsumeMoney", 0)) + float(output.get("consumeMoney", 0)),
        )
