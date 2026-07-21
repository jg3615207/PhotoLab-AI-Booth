from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse
from app.config import settings
from app.db import get_db
import os

router = APIRouter(prefix="/api", tags=["gallery"])

@router.get("/images/{job_id}/download")
def download_image(job_id: str):
    with get_db() as db:
        sess = db.execute("SELECT output_image, print_image FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        if not sess:
            raise HTTPException(404, "Session not found")
        
        db.execute("UPDATE sessions SET download_count = COALESCE(download_count, 0) + 1 WHERE job_id=?", (job_id,))
        
        target_path = sess["print_image"] if (sess["print_image"] and os.path.exists(sess["print_image"])) else sess["output_image"]
        if target_path and os.path.exists(target_path):
            return FileResponse(target_path, media_type="image/jpeg", filename=f"PhotoLab_{job_id}.jpg")
    raise HTTPException(440, "Image file not found")

@router.get("/images/{job_id}/{filename}")
def serve_image(job_id: str, filename: str):
    job_dir = os.path.join(settings.output_dir, job_id)
    path = os.path.join(job_dir, filename)
    
    if not os.path.exists(path):
        for alt in ["print_ready.jpg", "framed.jpg", "raw.jpg", "input.jpg"]:
            alt_path = os.path.join(job_dir, alt)
            if os.path.exists(alt_path):
                path = alt_path
                break

    if not os.path.exists(path):
        raise HTTPException(404)
        
    if filename in ["output.jpg", "print_ready.jpg", "framed.jpg", "raw.jpg"]:
        try:
            with get_db() as db:
                db.execute("UPDATE sessions SET download_count = COALESCE(download_count, 0) + 1 WHERE job_id=?", (job_id,))
        except Exception:
            pass

    return FileResponse(path)

@router.get("/uploads/{job_id}/{filename}")
def serve_upload_image(job_id: str, filename: str):
    path = os.path.join(settings.upload_dir, job_id, filename)
    if not os.path.exists(path):
        raise HTTPException(404)
    return FileResponse(path)
