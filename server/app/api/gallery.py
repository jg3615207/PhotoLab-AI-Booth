from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import FileResponse
from app.config import settings
from app.db import get_db
import os

router = APIRouter(prefix="/api", tags=["gallery"])

@router.get("/images/{job_id}/download")
def download_image(job_id: str):
    from pathlib import Path
    with get_db() as db:
        sess = db.execute("SELECT output_image, print_image, input_image FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        if not sess:
            raise HTTPException(404, "Session not found")
        
        db.execute("UPDATE sessions SET download_count = COALESCE(download_count, 0) + 1 WHERE job_id=?", (job_id,))

        job_out = Path(settings.output_dir) / job_id
        candidates = [
            sess["print_image"],
            sess["output_image"],
            str(job_out / "print_ready.jpg"),
            str(job_out / "framed.jpg"),
            str(job_out / "upscaled.jpg"),
            str(job_out / "raw.png"),
            sess["input_image"],
            str(Path(settings.upload_dir) / job_id / "input.jpg")
        ]
        
        for cand in candidates:
            if cand and os.path.exists(cand):
                ext = ".png" if cand.endswith(".png") else ".jpg"
                media_type = "image/png" if cand.endswith(".png") else "image/jpeg"
                return FileResponse(cand, media_type=media_type, filename=f"PhotoLab_{job_id}{ext}")
                
    raise HTTPException(404, "Image file not found")

@router.get("/images/{job_id}/{filename}")
def serve_image(job_id: str, filename: str):
    job_dir = os.path.join(settings.output_dir, job_id)
    path = os.path.join(job_dir, filename)
    
    if not os.path.exists(path):
        for alt in ["print_ready.jpg", "framed.jpg", "upscaled.jpg", "raw.png", "raw.jpg", "input.jpg"]:
            alt_path = os.path.join(job_dir, alt)
            if os.path.exists(alt_path):
                path = alt_path
                break

    if not os.path.exists(path):
        upload_input = os.path.join(settings.upload_dir, job_id, "input.jpg")
        if os.path.exists(upload_input):
            path = upload_input

    if not os.path.exists(path):
        from fastapi.responses import Response
        svg_placeholder = """<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400" fill="none">
          <rect width="300" height="400" fill="#121222" rx="12"/>
          <path d="M120 180C120 163.431 133.431 150 150 150C166.569 150 180 163.431 180 180C180 196.569 166.569 210 150 210C133.431 210 120 196.569 120 180Z" fill="#2A2A44"/>
          <path d="M90 260L130 210L160 240L190 200L220 260H90Z" fill="#2A2A44"/>
          <text x="150" y="300" text-anchor="middle" fill="#666688" font-family="sans-serif" font-size="14">Photo Not Available</text>
        </svg>"""
        return Response(content=svg_placeholder, media_type="image/svg+xml")
        
    if filename in ["output.jpg", "print_ready.jpg", "framed.jpg", "raw.jpg", "raw.png"]:
        try:
            with get_db() as db:
                db.execute("UPDATE sessions SET download_count = COALESCE(download_count, 0) + 1 WHERE job_id=?", (job_id,))
        except Exception:
            pass

    media_type = "image/png" if path.endswith(".png") else "image/jpeg"
    return FileResponse(path, media_type=media_type)

@router.get("/uploads/{job_id}/{filename}")
def serve_upload_image(job_id: str, filename: str):
    path = os.path.join(settings.upload_dir, job_id, filename)
    if not os.path.exists(path):
        # Fallback to output directory if needed
        out_input = os.path.join(settings.output_dir, job_id, filename)
        if os.path.exists(out_input):
            path = out_input

    if not os.path.exists(path):
        raise HTTPException(404, "Upload file not found")
    media_type = "image/png" if path.endswith(".png") else "image/jpeg"
    return FileResponse(path, media_type=media_type)
