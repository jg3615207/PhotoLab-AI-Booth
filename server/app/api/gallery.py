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

from fastapi.responses import HTMLResponse

@router.get("/download/{job_id}", response_class=HTMLResponse)
def mobile_download_page(job_id: str):
    with get_db() as db:
        sess = db.execute("SELECT job_id, style_id, created_at FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        if not sess:
            return HTMLResponse("<h2>Photo not found or expired.</h2>", status_code=404)
        
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PhotoLab - My Photo</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }}
        body {{ background: #0b0c16; color: #fff; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 20px; }}
        .card {{ background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(12px); border-radius: 20px; width: 100%; max-width: 480px; padding: 24px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
        h1 {{ font-size: 22px; font-weight: 700; margin-bottom: 6px; background: linear-gradient(135deg, #a3b8ff, #764ba2); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
        p.subtitle {{ font-size: 13px; color: #8a8d9e; margin-bottom: 20px; }}
        .photo-container {{ position: relative; width: 100%; border-radius: 14px; overflow: hidden; margin-bottom: 20px; background: #000; box-shadow: 0 8px 24px rgba(0,0,0,0.6); }}
        .photo-container img {{ width: 100%; height: auto; display: block; }}
        .btn {{ display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 14px; border-radius: 12px; font-weight: 600; font-size: 15px; cursor: pointer; text-decoration: none; border: none; transition: transform 0.2s, background 0.2s; }}
        .btn:active {{ transform: scale(0.98); }}
        .btn-primary {{ background: linear-gradient(135deg, #667eea, #764ba2); color: #fff; margin-bottom: 14px; }}
        .share-label {{ font-size: 13px; color: #aaa; margin: 16px 0 10px; display: block; }}
        .share-grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }}
        .share-btn {{ background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 10px; border-radius: 10px; font-size: 12px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-decoration: none; }}
        .share-btn:hover {{ background: rgba(255,255,255,0.16); }}
        .toast {{ position: fixed; bottom: 30px; background: #667eea; color: #fff; padding: 10px 20px; border-radius: 20px; font-size: 13px; display: none; }}
    </style>
</head>
<body>
    <div class="card">
        <h1>✨ PhotoLab AI Memory</h1>
        <p class="subtitle">Tap below to save or share your event photo</p>
        
        <div class="photo-container">
            <img src="/api/images/{job_id}/download" alt="Event Photo">
        </div>

        <a href="/api/images/{job_id}/download" download="PhotoLab_{job_id}.jpg" class="btn btn-primary">
            📥 Download High-Res Photo
        </a>

        <span class="share-label">Share to Social Media</span>
        <div class="share-grid">
            <a href="https://www.facebook.com/sharer/sharer.php?u=" id="fb-share" target="_blank" class="share-btn">
                <span>📘</span> FB
            </a>
            <a href="https://twitter.com/intent/tweet?url=" id="tw-share" target="_blank" class="share-btn">
                <span>🐦</span> X
            </a>
            <a href="https://line.me/R/msg/text/?" id="line-share" target="_blank" class="share-btn">
                <span>💬</span> Line
            </a>
            <button onclick="copyShareLink()" class="share-btn">
                <span>🔗</span> Copy
            </button>
        </div>
    </div>
    <div id="toast" class="toast">Link copied to clipboard!</div>

    <script>
        const currUrl = encodeURIComponent(window.location.href);
        document.getElementById('fb-share').href = 'https://www.facebook.com/sharer/sharer.php?u=' + currUrl;
        document.getElementById('tw-share').href = 'https://twitter.com/intent/tweet?url=' + currUrl + '&text=' + encodeURIComponent('Check out my AI photo!');
        document.getElementById('line-share').href = 'https://line.me/R/msg/text/?' + currUrl;

        function copyShareLink() {{
            navigator.clipboard.writeText(window.location.href).then(() => {{
                const t = document.getElementById('toast');
                t.style.display = 'block';
                setTimeout(() => t.style.display = 'none', 2500);
            }});
        }}
    </script>
</body>
</html>"""
    return HTMLResponse(content=html)

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
