"""
PhotoLab Frame Maker API Router
Provides endpoints for creating, editing, template management, asset listing, and applying frame designs to styles/events.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel
from typing import Optional, List
from pathlib import Path
import json, uuid, base64, io, os
from PIL import Image, ImageOps

from app.db import get_db
from app.config import settings

router = APIRouter(prefix="/api/frame-maker", tags=["frame-maker"])

FRAMES_DIR = Path(__file__).parent.parent.parent / "data" / "frame_templates"
FRAMES_DIR.mkdir(parents=True, exist_ok=True)

ASSETS_DIR = Path(__file__).parent.parent.parent / "data" / "frame_assets"
ASSETS_DIR.mkdir(parents=True, exist_ok=True)


class TemplateSaveRequest(BaseModel):
    id: Optional[str] = None
    name: str
    description: Optional[str] = ""
    canvas_json: str
    target_width: Optional[int] = 1200
    target_height: Optional[int] = 1800
    frame_image_base64: Optional[str] = None
    category: Optional[str] = "custom"
    tags: Optional[List[str]] = []


@router.get("/templates")
def list_templates(category: Optional[str] = None):
    with get_db() as db:
        if category:
            rows = db.execute("SELECT * FROM frame_templates WHERE category=? ORDER BY created_at DESC", (category,)).fetchall()
        else:
            rows = db.execute("SELECT * FROM frame_templates ORDER BY created_at DESC").fetchall()
        
        results = []
        for r in rows:
            d = dict(r)
            try:
                d["tags"] = json.loads(d["tags"])
            except Exception:
                d["tags"] = []
            d["thumbnail_url"] = f"/api/frame-maker/templates/{d['id']}/thumbnail.jpg" if d.get("thumbnail") else ""
            d["frame_png_url"] = f"/api/frame-maker/templates/{d['id']}/frame.png" if d.get("frame_png") else ""
            results.append(d)
        return results


@router.get("/templates/{template_id}")
def get_template(template_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM frame_templates WHERE id=?", (template_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Frame template not found")
        d = dict(row)
        try:
            d["tags"] = json.loads(d["tags"])
        except Exception:
            d["tags"] = []
        d["thumbnail_url"] = f"/api/frame-maker/templates/{d['id']}/thumbnail.jpg" if d.get("thumbnail") else ""
        d["frame_png_url"] = f"/api/frame-maker/templates/{d['id']}/frame.png" if d.get("frame_png") else ""
        return d


@router.post("/templates")
def save_template(req: TemplateSaveRequest):
    t_id = req.id if req.id else f"frame_{uuid.uuid4().hex[:8]}"
    t_dir = FRAMES_DIR / t_id
    t_dir.mkdir(parents=True, exist_ok=True)
    
    thumb_path = ""
    frame_png_path = ""

    if req.frame_image_base64:
        try:
            b64_str = req.frame_image_base64
            if "," in b64_str:
                b64_str = b64_str.split(",", 1)[1]
            img_bytes = base64.b64decode(b64_str)
            pil = Image.open(io.BytesIO(img_bytes)).convert("RGBA")
            
            # Ensure target dimensions
            target_size = (req.target_width or 1200, req.target_height or 1800)
            if pil.size != target_size:
                pil = pil.resize(target_size, Image.LANCZOS)

            frame_png_path = str(t_dir / "frame.png")
            pil.save(frame_png_path, "PNG")

            # Thumbnail
            thumb = pil.copy()
            thumb.thumbnail((256, 384), Image.LANCZOS)
            thumb_rgb = Image.new("RGB", thumb.size, (30, 30, 45))
            thumb_rgb.paste(thumb, mask=thumb.split()[3]) # paste alpha
            thumb_path = str(t_dir / "thumb.jpg")
            thumb_rgb.save(thumb_path, "JPEG", quality=85)
        except Exception as e:
            print(f"[frame_maker] Save frame error: {e}")

    with get_db() as db:
        db.execute(
            """INSERT INTO frame_templates (id, name, description, canvas_json, target_width, target_height, thumbnail, frame_png, category, tags, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
               ON CONFLICT(id) DO UPDATE SET
               name=excluded.name, description=excluded.description, canvas_json=excluded.canvas_json,
               target_width=excluded.target_width, target_height=excluded.target_height,
               thumbnail=COALESCE(NULLIF(excluded.thumbnail, ''), frame_templates.thumbnail),
               frame_png=COALESCE(NULLIF(excluded.frame_png, ''), frame_templates.frame_png),
               category=excluded.category, tags=excluded.tags, updated_at=datetime('now')""",
            (t_id, req.name, req.description or "", req.canvas_json, req.target_width or 1200, req.target_height or 1800, thumb_path, frame_png_path, req.category or "custom", json.dumps(req.tags or []))
        )

    return {"status": "ok", "id": t_id}


@router.delete("/templates/{template_id}")
def delete_template(template_id: str):
    import shutil
    with get_db() as db:
        db.execute("DELETE FROM frame_templates WHERE id=?", (template_id,))
    t_dir = FRAMES_DIR / template_id
    if t_dir.exists():
        shutil.rmtree(t_dir, ignore_errors=True)
    return {"status": "deleted"}


@router.get("/templates/{template_id}/thumbnail.jpg")
def get_thumbnail(template_id: str):
    thumb_path = FRAMES_DIR / template_id / "thumb.jpg"
    if not thumb_path.exists():
        raise HTTPException(404, "Thumbnail not found")
    return FileResponse(str(thumb_path))


@router.get("/templates/{template_id}/frame.png")
def get_frame_png(template_id: str):
    frame_path = FRAMES_DIR / template_id / "frame.png"
    if not frame_path.exists():
        raise HTTPException(404, "Frame PNG not found")
    return FileResponse(str(frame_path), media_type="image/png")


class ApplyFrameRequest(BaseModel):
    frame_image_base64: str
    target_type: str # 'style' or 'event'
    target_id: str


@router.post("/apply")
def apply_frame(req: ApplyFrameRequest):
    """Applies exported PNG frame directly to a style or event."""
    try:
        b64_str = req.frame_image_base64
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(b64_str)
        pil = Image.open(io.BytesIO(img_bytes)).convert("RGBA")

        if req.target_type == "style":
            style_dir = Path(__file__).parent.parent.parent / "styles" / req.target_id
            style_dir.mkdir(parents=True, exist_ok=True)
            frame_path = style_dir / "frame.png"
            pil.save(str(frame_path), "PNG")
            with get_db() as db:
                db.execute("UPDATE styles SET print_frame=? WHERE id=?", (str(frame_path), req.target_id))
            return {"status": "ok", "applied_to": "style", "target_id": req.target_id}

        elif req.target_type == "event":
            event_dir = Path(__file__).parent.parent.parent / "data" / "events" / req.target_id
            event_dir.mkdir(parents=True, exist_ok=True)
            frame_path = event_dir / "frame.png"
            pil.save(str(frame_path), "PNG")
            with get_db() as db:
                db.execute("UPDATE events SET frame_path=? WHERE id=?", (str(frame_path), req.target_id))
            return {"status": "ok", "applied_to": "event", "target_id": req.target_id}

        else:
            raise HTTPException(400, "Invalid target_type. Must be 'style' or 'event'")
    except Exception as e:
        raise HTTPException(500, f"Failed to apply frame: {str(e)}")


class AIFramePromptRequest(BaseModel):
    event_type: str
    theme: Optional[str] = ""
    style_keywords: Optional[str] = ""


@router.post("/ai-suggest")
def ai_suggest_frame_elements(req: AIFramePromptRequest):
    """Uses LLM to suggest color schemes, stickers, text ideas, and frame composition based on event concept."""
    from app.db import get_setting
    import httpx

    api_key = get_setting("openai_api_key", settings.openai_api_key)
    base_url = get_setting("openai_base_url", settings.openai_base_url)
    model = get_setting("openai_model", settings.openai_model) or "gpt-4o"

    if not api_key:
        return {
            "title": f"{req.event_type} Theme Frame",
            "colors": ["#FFD700", "#1A1A2E", "#E94560", "#0F3460"],
            "texts": [req.event_type.upper(), "Special Memories", "Photo Booth 2026"],
            "suggested_stickers": ["stars", "ribbon", "sparkles"],
            "ai_prompt": f"Elegant photo frame overlay for {req.event_type}, {req.theme}, gold metallic borders, transparent center cutout"
        }

    sys_prompt = (
        "You are an expert graphic designer for photo booth event frames.\n"
        "Return a JSON object with: title, colors (array of 4 hex codes), texts (array of 3 short text phrases like event headers/hashtags), "
        "suggested_elements (array of 3 design element descriptions), and ai_prompt (a Stable Diffusion / RunningHub prompt to generate a frame border/background image)."
    )

    user_prompt = f"Event Type: {req.event_type}\nTheme/Mood: {req.theme}\nKeywords: {req.style_keywords}"

    try:
        r = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.7
            },
            timeout=20
        )
        r.raise_for_status()
        data = r.json()
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)
    except Exception as e:
        print(f"[frame_maker] AI suggest error: {e}")
        return {
            "title": f"{req.event_type} Frame",
            "colors": ["#6366F1", "#A855F7", "#1E1E38", "#FFFFFF"],
            "texts": [req.event_type, "#PhotoLab", "Best Moments"],
            "suggested_elements": ["Golden border", "Floral accent", "Bottom banner"],
            "ai_prompt": f"Photo booth frame border for {req.event_type}, ornate details, transparent center"
        }


@router.get("/assets")
def list_assets():
    """Lists available cliparts, stickers, and frame borders from data/frame_assets/."""
    assets = []
    for item in ASSETS_DIR.glob("*.*"):
        if item.suffix.lower() in [".png", ".jpg", ".jpeg", ".svg"]:
            assets.append({
                "name": item.stem,
                "url": f"/api/frame-maker/assets/{item.name}",
                "category": "custom"
            })
    return assets


@router.get("/assets/{filename}")
def serve_asset(filename: str):
    asset_path = ASSETS_DIR / filename
    if not asset_path.exists():
        raise HTTPException(404, "Asset file not found")
    media = "image/svg+xml" if filename.endswith(".svg") else ("image/png" if filename.endswith(".png") else "image/jpeg")
    return FileResponse(str(asset_path), media_type=media)


@router.post("/assets/upload")
def upload_asset(file: UploadFile = File(...)):
    ext = Path(file.filename).suffix.lower()
    if ext not in [".png", ".jpg", ".jpeg", ".svg"]:
        raise HTTPException(400, "Only PNG, JPG, and SVG files supported")
    
    asset_id = f"asset_{uuid.uuid4().hex[:8]}{ext}"
    dest = ASSETS_DIR / asset_id
    with open(dest, "wb") as f:
        f.write(file.file.read())

    return {"status": "ok", "url": f"/api/frame-maker/assets/{asset_id}", "name": Path(file.filename).stem}
