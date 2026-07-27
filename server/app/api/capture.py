import uuid, os, json
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.config import settings
from app.db import get_db
from app.services.frames import check_faces
from app.services.pipeline import run_pipeline, run_pipeline_with_failsafe
import threading

router = APIRouter(prefix="/api", tags=["capture"])

@router.post("/capture")
async def capture(
    image: UploadFile = File(...),
    style_id: str = Form(...),
    ref_image: UploadFile | None = File(None),
    prompt_override: str = Form(None),
    model_override: str = Form(None),
    resolution_override: str = Form(None),
    quality_override: str = Form(None),
    aspect_override: str = Form(None),
    seed_override: str = Form(None),
    event_id: str = Form(None),
    capture_source: str = Form("webcam"),
):
    if event_id:
        from datetime import date
        with get_db() as db:
            event = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
            if not event:
                return {"error": "Invalid Session ID"}
            if not event["active"]:
                return {"error": "Session is inactive"}
            if event["expire_date"]:
                today = date.today().isoformat()
                if today > event["expire_date"]:
                    return {"error": "Session has expired"}
            if event["frame_cap"] > 0:
                count = db.execute("SELECT COUNT(*) FROM sessions WHERE event_id=? AND status='done'", (event_id,)).fetchone()[0]
                if count >= event["frame_cap"]:
                    return {"error": "Session frame generation limit reached"}

    job_id = uuid.uuid4().hex[:12]
    upload_dir = Path(settings.upload_dir) / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    img_path = str(upload_dir / "input.jpg")
    # File validation
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(400, "Invalid file format. Only JPEG, PNG, or WEBP images are accepted.")

    content = await image.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "File size exceeds 15MB limit.")

    from PIL import Image as PILImage
    import io
    try:
        pil_img = PILImage.open(io.BytesIO(content)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Corrupted or invalid image file.")

    max_dim = 2048
    if max(pil_img.size) > max_dim:
        ratio = max_dim / max(pil_img.size)
        new_size = (int(pil_img.size[0] * ratio), int(pil_img.size[1] * ratio))
        pil_img = pil_img.resize(new_size, PILImage.LANCZOS)
    pil_img.save(img_path, "JPEG", quality=92)

    ref_path = None
    if ref_image:
        ref_path = str(upload_dir / "style_ref.jpg")
        ref_content = await ref_image.read()
        with open(ref_path, "wb") as f:
            f.write(ref_content)

    with get_db() as db:
        st_row = db.execute("SELECT v2_model FROM styles WHERE id=?", (style_id,)).fetchone()
        used_model = model_override or (st_row["v2_model"] if st_row and st_row["v2_model"] else "nb2-cheap")
        db.execute(
            "INSERT INTO sessions (job_id, style_id, capture_source, input_image, ref_image, status, event_id, v2_model) VALUES (?,?,?,?,?,?,?,?)",
            (job_id, style_id, capture_source, img_path, ref_path, "created", event_id, used_model),
        )

    face_count = check_faces(img_path)
    with get_db() as db:
        s = db.execute("SELECT max_people FROM styles WHERE id=?", (style_id,)).fetchone()
        if s and face_count > s["max_people"]:
            return {"error": f"Too many faces ({face_count}) for this style (max {s['max_people']})", "job_id": job_id}

    # Determine failsafe settings from event
    failsafe_enabled = False
    failsafe_timeout = 35
    if event_id:
        with get_db() as db:
            ev = db.execute(
                "SELECT gen_failsafe_enabled, gen_failsafe_timeout FROM events WHERE id=?",
                (event_id,),
            ).fetchone()
            if ev:
                try:
                    failsafe_enabled = bool(ev["gen_failsafe_enabled"])
                    failsafe_timeout = int(ev["gen_failsafe_timeout"] or 35)
                except Exception:
                    pass

    pipeline_kwargs = dict(
        style_id=style_id,
        image_path=img_path,
        style_ref_path=ref_path,
        prompt_override=prompt_override,
        model_override=model_override,
        resolution_override=resolution_override,
        quality_override=quality_override,
        aspect_override=aspect_override,
        seed_override=seed_override,
    )

    if failsafe_enabled:
        # run_pipeline_with_failsafe blocks internally (waits for the race),
        # so we wrap it in a daemon thread
        threading.Thread(
            target=run_pipeline_with_failsafe,
            kwargs={**pipeline_kwargs, "job_id": job_id, "failsafe_timeout": failsafe_timeout},
            daemon=True,
        ).start()
    else:
        threading.Thread(
            target=run_pipeline,
            args=(job_id,),
            kwargs=pipeline_kwargs,
            daemon=True,
        ).start()

    return {"job_id": job_id, "status": "created"}


@router.get("/job/{job_id}")
def get_job(job_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404)
        return dict(row)

@router.post("/reprint/{job_id}")
@router.post("/capture/reprint/{job_id}")
def reprint(job_id: str):
    with get_db() as db:
        row = db.execute("SELECT output_image, print_image FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Session not found")
        target_path = row["print_image"] if (row["print_image"] and os.path.exists(row["print_image"])) else row["output_image"]
        if not target_path or not os.path.exists(target_path):
            out_dir = Path(settings.output_dir) / job_id
            for alt in [out_dir / "print_ready.jpg", out_dir / "framed.jpg", out_dir / "upscaled.jpg", out_dir / "raw.png"]:
                if alt.exists():
                    target_path = str(alt)
                    break
        if not target_path or not os.path.exists(target_path):
            raise HTTPException(404, "Print image file not found")
        from app.services.printing import enqueue_print
        enqueue_print(image_path=target_path, copies=1, session_id=job_id)
        return {"status": "queued"}
