"""RunningHub v2 Standard Model (direct) API provider.
Multi-model support with dynamic endpoint routing via model registry."""
import httpx, time, json, random
from pathlib import Path
import io
from app.config import settings
from app.providers.base import AIProvider, GenerateResult

API_KEY = settings.api_key
BASE = settings.rh_base_url

# ============================================================
# V2 Model Registry — canonical list of supported models
# ============================================================
V2_MODEL_REGISTRY = {
    "nb2-cheap": {
        "name": "Nano Banana 2",
        "i2i_endpoint": f"{BASE}/openapi/v2/rhart-image-n-g31-flash/image-to-image",
        "t2i_endpoint": f"{BASE}/openapi/v2/rhart-image-n-g31-flash/text-to-image",
        "resolutions": ["1k", "2k", "4k"],
        "has_quality": False,
        "default_quality": None,
        "price_note": "~$0.027/2k",
    },
    "nb-pro": {
        "name": "Nano Banana Pro",
        "i2i_endpoint": f"{BASE}/openapi/v2/rhart-image-n-pro/edit",
        "t2i_endpoint": f"{BASE}/openapi/v2/rhart-image-n-pro/text-to-image",
        "resolutions": ["1k", "2k", "4k"],
        "has_quality": False,
        "default_quality": None,
        "price_note": "~$0.035/2k",
    },
    "gpt2-official": {
        "name": "GPT Image 2 Official",
        "i2i_endpoint": f"{BASE}/openapi/v2/rhart-image-g-2-official/image-to-image",
        "t2i_endpoint": f"{BASE}/openapi/v2/rhart-image-g-2-official/text-to-image",
        "resolutions": ["1k", "2k", "4k"],
        "has_quality": True,
        "default_quality": "medium",
        "price_note": "~$0.045/2k",
    },
    "gpt2-cheap": {
        "name": "GPT Image 2 Cheap",
        "i2i_endpoint": f"{BASE}/openapi/v2/rhart-image-g-2/image-to-image",
        "t2i_endpoint": f"{BASE}/openapi/v2/rhart-image-g-2/text-to-image",
        "resolutions": ["1k"],  # 2k/4k unreliable
        "has_quality": False,
        "default_quality": None,
        "price_note": "~$0.028/2k",
    },
}


class RunningHubV2Provider(AIProvider):
    """V2 Direct Model API: calls model endpoints directly.
    Supports multiple models via registry. ~18s per render, no seed control."""

    def __init__(self):
        self._client = httpx.Client(timeout=180)

    def _resolve_model(self, model_id: str) -> dict:
        """Look up a model in the registry. Raises ValueError if not found."""
        if model_id not in V2_MODEL_REGISTRY:
            raise ValueError(f"Unknown v2 model: {model_id}. Available: {list(V2_MODEL_REGISTRY.keys())}")
        return V2_MODEL_REGISTRY[model_id]

    def _upload(self, file_path: str) -> str:
        with open(file_path, "rb") as f:
            content = f.read()
        r = self._client.post(
            f"{BASE}/openapi/v2/media/upload/binary",
            headers={"Authorization": f"Bearer {API_KEY}"},
            files={"file": ("img.jpg", content, "image/jpeg")},
        )
        data = r.json()
        if data.get("code") != 0:
            raise RuntimeError(f"v2 upload failed: {data.get('msg')}")
        url = data["data"].get("download_url")
        if not url:
            raise RuntimeError("v2 upload: no download_url in response")
        return url

    def upload_image(self, image_path: str) -> str:
        return self._upload(image_path)

    def generate(
        self,
        guest_image_path: str,
        rh_ref_file: str,
        prompt: str,
        seed: int | None = None,
        resolution: str = "2k",
        aspect_ratio: str = "2:3",
        v2_model: str = "nb2-cheap",
        v2_quality: str | None = None,
    ) -> GenerateResult:
        model = self._resolve_model(v2_model)
        endpoint = model["i2i_endpoint"]
        print(f"[v2.generate] model={v2_model} endpoint={endpoint}")
        
        guest_url = self._upload(guest_image_path)
        style_url = rh_ref_file

        body = {
            "imageUrls": [guest_url, style_url],
            "prompt": prompt,
            "aspectRatio": aspect_ratio,
            "resolution": resolution,
        }

        # Add quality if model supports it
        if model["has_quality"]:
            quality = v2_quality or model["default_quality"]
            if quality:
                body["quality"] = quality

        r = self._client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        data = r.json()
        task_id = data.get("taskId")
        if not task_id:
            raise RuntimeError(f"v2 task creation failed: {data.get('errorMessage', data)}")

        return self._poll_task(task_id)

    def generate_ref_image(
        self,
        prompt: str,
        aspect_ratio: str = "2:3",
        resolution: str = "2k",
        v2_model: str = "nb2-cheap",
        v2_quality: str | None = None,
    ) -> GenerateResult:
        """Generate a style reference image from text prompt only. Text-to-image via selected model."""
        model = self._resolve_model(v2_model)
        endpoint = model["t2i_endpoint"]
        if not endpoint:
            raise ValueError(f"Model '{v2_model}' does not support text-to-image")
        print(f"[v2.generate_ref_image] model={v2_model} endpoint={endpoint}")
        
        body = {
            "prompt": prompt,
            "aspectRatio": aspect_ratio,
            "resolution": resolution,
        }

        if model["has_quality"]:
            quality = v2_quality or model["default_quality"]
            if quality:
                body["quality"] = quality

        r = self._client.post(
            endpoint,
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json",
            },
            json=body,
        )
        data = r.json()
        task_id = data.get("taskId")
        if not task_id:
            raise RuntimeError(f"text-to-image task creation failed: {data.get('errorMessage', data)}")

        return self._poll_task(task_id)

    def _poll_task(self, task_id: str) -> GenerateResult:
        """Poll RunningHub task status and return result."""
        start = time.time()
        while time.time() - start < 200:
            time.sleep(3)
            r = self._client.post(
                f"{BASE}/openapi/v2/query",
                headers={"Authorization": f"Bearer {API_KEY}"},
                json={"taskId": task_id},
            )
            status_data = r.json()
            s = status_data.get("status")
            if s == "SUCCESS":
                results = status_data.get("results", [])
                if not results:
                    raise RuntimeError("Task completed but no results")
                usage = status_data.get("usage", {})
                return GenerateResult(
                    image_url=results[0]["url"],
                    task_id=task_id,
                    cost_time=int(usage.get("taskCostTime", 0)),
                    cost_money=float(usage.get("thirdPartyConsumeMoney", 0) or 0)
                               + float(usage.get("consumeMoney", 0) or 0),
                )
            elif s == "FAILED":
                raise RuntimeError(f"Task failed: {status_data.get('errorMessage', 'unknown')}")

        raise TimeoutError(f"Task {task_id} timed out")
