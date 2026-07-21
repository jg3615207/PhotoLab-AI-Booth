from fastapi import APIRouter, Request
from app.config import settings

router = APIRouter(prefix="/api", tags=["gallery"])

@router.get("/images/{job_id}/{filename}")
def serve_image(job_id: str, filename: str):
    from fastapi.responses import FileResponse
    import os
    path = os.path.join(settings.output_dir, job_id, filename)
    if not os.path.exists(path):
        from fastapi import HTTPException
        raise HTTPException(404)
    return FileResponse(path)

@router.get("/uploads/{job_id}/{filename}")
def serve_upload_image(job_id: str, filename: str):
    from fastapi.responses import FileResponse
    import os
    path = os.path.join(settings.upload_dir, job_id, filename)
    if not os.path.exists(path):
        from fastapi import HTTPException
        raise HTTPException(404)
    return FileResponse(path)
