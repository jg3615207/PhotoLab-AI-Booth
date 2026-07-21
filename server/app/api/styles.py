from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional
from pathlib import Path
from PIL import Image
import io, httpx, base64
from app.db import get_db, get_setting, set_setting
from app.config import settings
from app.providers.runninghub_v2 import V2_MODEL_REGISTRY

router = APIRouter(prefix="/api/styles", tags=["styles"])

STYLES_DIR = Path(__file__).parent.parent.parent / "styles"

@router.get("")
def list_styles(admin: bool = False):
    with get_db() as db:
        clause = "" if admin else " WHERE active=1"
        rows = db.execute(f"SELECT * FROM styles{clause} ORDER BY sort_order ASC, created_at DESC").fetchall()
        result = []
        for r in rows:
            s = dict(r)
            s["thumbnail"] = f"/api/styles/{r['id']}/thumb.jpg"
            s["ref_image"] = f"/api/styles/{r['id']}/ref.jpg"
            if s.get("animated_thumbnail"):
                if s["animated_thumbnail"].startswith("http") or s["animated_thumbnail"].startswith("/"):
                    s["animated_thumbnail"] = s["animated_thumbnail"]
                else:
                    s["animated_thumbnail"] = f"/api/styles/{r['id']}/{s['animated_thumbnail']}"
            else:
                s["animated_thumbnail"] = ""
            result.append(s)
        return result

class ReorderRequest(BaseModel):
    ids: list[str]

@router.post("/reorder")
def reorder_styles(req: ReorderRequest):
    with get_db() as db:
        for idx, sid in enumerate(req.ids):
            db.execute("UPDATE styles SET sort_order=? WHERE id=?", (idx, sid))
    return {"status": "ok"}

@router.get("/v2-models")
def list_v2_models():
    """Returns available V2 models for the UI dropdown."""
    return [
        {
            "id": mid,
            "name": m["name"],
            "resolutions": m["resolutions"],
            "has_quality": m["has_quality"],
            "default_quality": m["default_quality"],
            "has_t2i": m["t2i_endpoint"] is not None,
            "price_note": m.get("price_note", ""),
        }
        for mid, m in V2_MODEL_REGISTRY.items()
    ]

@router.post("")
def create_style(
    id: str = Form(...),
    name: str = Form(...),
    max_people: int = Form(1),
    aspect_ratio: str = Form("2:3"),
    prompt_template: str = Form(""),
    resolution: str = Form("2k"),
    seed: str = Form(""),
    provider: str = Form("v1"),
    v2_model: str = Form("nb2-cheap"),
    v2_quality: str = Form(None),
    transition_type: str = Form("glitch"),
    animated_thumbnail: str = Form(""),
    dynamic_prompt_enabled: int = Form(0),
):
    with get_db() as db:
        existing = db.execute("SELECT id FROM styles WHERE id=?", (id,)).fetchone()
        if existing:
            raise HTTPException(400, "Style ID already exists")
        db.execute(
            "INSERT INTO styles (id, name, max_people, aspect_ratio, prompt_template, resolution, seed, provider, v2_model, v2_quality, transition_type, animated_thumbnail, dynamic_prompt_enabled, active) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)",
            (id, name, max_people, aspect_ratio, prompt_template, resolution, seed or "", provider, v2_model, v2_quality or None, transition_type, animated_thumbnail, dynamic_prompt_enabled),
        )
    return {"status": "created", "id": id}

@router.put("/{style_id}")
def update_style(
    style_id: str,
    name: str = Form(None),
    max_people: int = Form(None),
    aspect_ratio: str = Form(None),
    prompt_template: str = Form(None),
    resolution: str = Form(None),
    seed: str = Form(None),
    active: int = Form(None),
    v2_model: str = Form(None),
    v2_quality: str = Form(None),
    transition_type: str = Form(None),
    animated_thumbnail: str = Form(None),
    dynamic_prompt_enabled: int = Form(None),
):
    with get_db() as db:
        row = db.execute("SELECT id FROM styles WHERE id=?", (style_id,)).fetchone()
        if not row:
            raise HTTPException(404)
        updates = {}
        for k in ["name", "max_people", "aspect_ratio", "prompt_template", "resolution", "seed", "active", "v2_model", "v2_quality", "transition_type", "animated_thumbnail", "dynamic_prompt_enabled"]:
            v = locals().get(k)
            if v is not None:
                updates[k] = v
        if updates:
            set_clause = ", ".join(f"{k}=?" for k in updates)
            db.execute(f"UPDATE styles SET {set_clause} WHERE id=?", (*updates.values(), style_id))
    return {"status": "updated"}


class StylePatch(BaseModel):
    name: Optional[str] = None
    max_people: Optional[int] = None
    aspect_ratio: Optional[str] = None
    prompt_template: Optional[str] = None
    resolution: Optional[str] = None
    seed: Optional[str] = None
    active: Optional[int] = None
    provider: Optional[str] = None
    v2_model: Optional[str] = None
    v2_quality: Optional[str] = None
    transition_type: Optional[str] = None
    animated_thumbnail: Optional[str] = None
    dynamic_prompt_enabled: Optional[int] = None


class GenerateRefRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "2:3"
    resolution: str = "2k"
    v2_model: str = "nb2-cheap"
    v2_quality: Optional[str] = None


@router.patch("/{style_id}")
def patch_style(style_id: str, body: StylePatch):
    with get_db() as db:
        row = db.execute("SELECT id FROM styles WHERE id=?", (style_id,)).fetchone()
        if not row:
            raise HTTPException(404)
        updates = body.model_dump(exclude_none=True)
        if updates:
            set_clause = ", ".join(f"{k}=?" for k in updates)
            db.execute(f"UPDATE styles SET {set_clause} WHERE id=?", (*updates.values(), style_id))
    return {"status": "updated", "fields": list(updates.keys())}


@router.delete("/{style_id}")
def delete_style(style_id: str):
    import shutil
    with get_db() as db:
        db.execute("DELETE FROM styles WHERE id=?", (style_id,))
    
    style_dir = STYLES_DIR / style_id
    if style_dir.exists():
        shutil.rmtree(style_dir, ignore_errors=True)
        
    return {"status": "deleted"}

@router.post("/{style_id}/ref-image")
def upload_ref_image(style_id: str, image: UploadFile = File(...)):
    with get_db() as db:
        row = db.execute("SELECT id FROM styles WHERE id=?", (style_id,)).fetchone()
        if not row:
            raise HTTPException(404)

    content = image.file.read()
    pil = Image.open(io.BytesIO(content)).convert("RGB")
    max_dim = 2048
    if max(pil.size) > max_dim:
        ratio = max_dim / max(pil.size)
        pil = pil.resize((int(pil.size[0] * ratio), int(pil.size[1] * ratio)), Image.LANCZOS)

    style_dir = STYLES_DIR / style_id
    style_dir.mkdir(parents=True, exist_ok=True)
    ref_path = style_dir / "ref.jpg"
    pil.save(str(ref_path), "JPEG", quality=92)

    thumb = pil.copy()
    thumb.thumbnail((256, 384), Image.LANCZOS)
    thumb_path = style_dir / "thumb.jpg"
    thumb.save(str(thumb_path), "JPEG", quality=85)

    # Upload to RunningHub
    rh_file_name = None
    rh_url = None
    try:
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=92)
        buf.seek(0)
        # v1 upload (internal fileName for workflow API)
        r = httpx.post(
            f"{settings.rh_base_url}/task/openapi/upload",
            data={"apiKey": settings.api_key},
            files={"file": ("ref.jpg", buf, "image/jpeg")},
            timeout=30,
        )
        data = r.json()
        if data.get("code") == 0:
            rh_file_name = data["data"]["fileName"]
    except Exception:
        pass

    try:
        buf.seek(0)
        # v2 upload (public URL for model API)
        r2 = httpx.post(
            f"{settings.rh_base_url}/openapi/v2/media/upload/binary",
            headers={"Authorization": f"Bearer {settings.api_key}"},
            files={"file": ("ref.jpg", buf, "image/jpeg")},
            timeout=30,
        )
        data2 = r2.json()
        if data2.get("code") == 0:
            rh_url = data2["data"].get("download_url", "")
    except Exception:
        pass

    with get_db() as db:
        if rh_file_name:
            db.execute("UPDATE styles SET rh_ref_file=? WHERE id=?", (rh_file_name, style_id))
        if rh_url:
            db.execute("UPDATE styles SET rh_ref_url=? WHERE id=?", (rh_url, style_id))

    return {
        "status": "ok",
        "thumbnail": f"/api/styles/{style_id}/thumb.jpg",
        "ref_image": f"/api/styles/{style_id}/ref.jpg",
        "rh_ref_file": rh_file_name,
        "rh_ref_url": rh_url,
    }

@router.post("/{style_id}/frame")
def upload_frame(style_id: str, image: UploadFile = File(...)):
    with get_db() as db:
        row = db.execute("SELECT id FROM styles WHERE id=?", (style_id,)).fetchone()
        if not row:
            raise HTTPException(404)
    content = image.file.read()
    pil = Image.open(io.BytesIO(content)).convert("RGBA")
    style_dir = STYLES_DIR / style_id
    style_dir.mkdir(parents=True, exist_ok=True)
    frame_path = style_dir / "frame.png"
    pil.save(str(frame_path), "PNG")
    return {"status": "ok"}

@router.post("/{style_id}/generate-ref")
def generate_ref_image(style_id: str, body: GenerateRefRequest):
    """Generate a style reference image from text prompt using AI."""
    from app.providers.runninghub_v2 import RunningHubV2Provider
    provider = RunningHubV2Provider()

    try:
        result = provider.generate_ref_image(
            prompt=body.prompt,
            aspect_ratio=body.aspect_ratio,
            resolution=body.resolution,
            v2_model=body.v2_model,
            v2_quality=body.v2_quality,
        )
    except Exception as e:
        raise HTTPException(500, f"AI generation failed: {str(e)}")

    # Download generated image to _preview.jpg
    style_dir = STYLES_DIR / style_id
    style_dir.mkdir(parents=True, exist_ok=True)
    preview_path = style_dir / "_preview.jpg"

    try:
        r = httpx.get(result.image_url, timeout=60)
        r.raise_for_status()
        with open(preview_path, "wb") as f:
            f.write(r.content)
    except Exception as e:
        raise HTTPException(500, f"Failed to download generated image: {str(e)}")

    preview_url = f"/api/styles/{style_id}/_preview.jpg"
    try:
        with get_db() as db:
            db.execute(
                """INSERT INTO ref_gen_logs 
                   (style_id, prompt, aspect_ratio, resolution, v2_model, v2_quality, preview_url, cost_time, cost_money, status) 
                   VALUES (?,?,?,?,?,?,?,?,?,'generated')""",
                (style_id, body.prompt, body.aspect_ratio, body.resolution, body.v2_model, body.v2_quality, preview_url, result.cost_time, result.cost_money)
            )
    except Exception as log_err:
        print(f"Failed to log ref gen: {log_err}")

    return {
        "status": "generated",
        "preview_url": preview_url,
        "cost_money": result.cost_money,
        "cost_time": result.cost_time,
        "task_id": result.task_id,
    }


@router.post("/{style_id}/accept-ref")
def accept_ref_image(style_id: str):
    """Accept the preview image as the official style reference."""
    style_dir = STYLES_DIR / style_id
    preview_path = style_dir / "_preview.jpg"
    if not preview_path.exists():
        raise HTTPException(400, "No preview to accept — generate first")

    # Move preview to permanent ref.jpg
    pil = Image.open(preview_path).convert("RGB")
    ref_path = style_dir / "ref.jpg"
    pil.save(str(ref_path), "JPEG", quality=92)

    # Generate thumbnail
    thumb = pil.copy()
    thumb.thumbnail((256, 384), Image.LANCZOS)
    thumb_path = style_dir / "thumb.jpg"
    thumb.save(str(thumb_path), "JPEG", quality=85)

    # Delete preview file
    preview_path.unlink(missing_ok=True)

    try:
        with get_db() as db:
            db.execute("UPDATE ref_gen_logs SET status='accepted' WHERE style_id=? AND status='generated'", (style_id,))
    except Exception:
        pass

    # Upload to RunningHub v1 (workflow API)
    rh_file_name = None
    try:
        buf = io.BytesIO()
        pil.save(buf, format="JPEG", quality=92)
        buf.seek(0)
        r = httpx.post(
            f"{settings.rh_base_url}/task/openapi/upload",
            data={"apiKey": settings.api_key},
            files={"file": ("ref.jpg", buf, "image/jpeg")},
            timeout=30,
        )
        data = r.json()
        if data.get("code") == 0:
            rh_file_name = data["data"]["fileName"]
    except Exception:
        pass

    # Upload to RunningHub v2 (direct API)
    rh_url = None
    try:
        buf.seek(0)
        r2 = httpx.post(
            f"{settings.rh_base_url}/openapi/v2/media/upload/binary",
            headers={"Authorization": f"Bearer {settings.api_key}"},
            files={"file": ("ref.jpg", buf, "image/jpeg")},
            timeout=30,
        )
        data2 = r2.json()
        if data2.get("code") == 0:
            rh_url = data2["data"].get("download_url", "")
    except Exception:
        pass

    # Update DB
    with get_db() as db:
        if rh_file_name:
            db.execute("UPDATE styles SET rh_ref_file=? WHERE id=?", (rh_file_name, style_id))
        if rh_url:
            db.execute("UPDATE styles SET rh_ref_url=? WHERE id=?", (rh_url, style_id))

    return {
        "status": "accepted",
        "ref_image": f"/api/styles/{style_id}/ref.jpg",
        "thumbnail": f"/api/styles/{style_id}/thumb.jpg",
        "rh_ref_file": rh_file_name,
        "rh_ref_url": rh_url,
    }


@router.get("/{style_id}/_preview.jpg")
def serve_preview(style_id: str):
    preview_path = STYLES_DIR / style_id / "_preview.jpg"
    if not preview_path.exists():
        raise HTTPException(404, "No preview available")
    return FileResponse(str(preview_path))


@router.delete("/{style_id}/generate-ref")
def cancel_generate_ref(style_id: str):
    """Cancel/cleanup the preview image."""
    preview_path = STYLES_DIR / style_id / "_preview.jpg"
    if preview_path.exists():
        preview_path.unlink()
    return {"status": "cancelled"}


@router.post("/optimize-prompt")
def optimize_prompt(raw_prompt: str = Form(...)):
    """Optimize a raw style prompt using OpenAI-compatible LLM (e.g. DeepSeek)."""
    api_key = get_setting("openai_api_key", settings.openai_api_key)
    base_url = get_setting("openai_base_url", settings.openai_base_url)
    model = get_setting("openai_model", settings.openai_model)

    if not api_key:
        raise HTTPException(500, "OpenAI API Key not configured")

    system_prompt = (
        "You are an expert prompt engineer specializing in stable diffusion / image-to-image AI styles for a professional Photo Booth application (\"PhotoLab\").\n"
        "Your task is to take a raw, simple style concept from the user and expand it into a highly detailed, optimized prompt template that yields spectacular and consistent results under image-to-image (i2i) control.\n\n"
        "### Guardrails & Constraints you MUST enforce in the optimized prompt:\n"
        "1. **Preserve Identity**: Explicitly instruct the AI to preserve the facial identity, expression, pose, and count of the people in the input photo.\n"
        "2. **No Extra People**: Strictly forbid the addition of extra people, faces, or characters.\n"
        "3. **Focus on Style and Environment**: Enhance details about the artistic medium (e.g., oil painting, digital illustration, anime line art), color palette, lighting (e.g., cinematic rim light, soft volumetric glow), and background environment (e.g., starry sky, neon city).\n"
        "4. **Leave Out Clothing & Pose**: Do NOT specify or describe specific clothing, outfits, attire, poses, postures, or body positions. Leave out clothing and pose descriptions completely, allowing the guest photo's own pose and subject to shine through.\n"
        "5. **Ignore Reference Person**: The person in any reference image is NOT important. Never describe the person, face, hair, outfit, or pose from the reference image. Use reference images ONLY for style, color scheme, lighting, and aesthetic texture.\n"
        "6. **Keep It Clean**: Do not include any quality buzzwords like \"photorealistic\", \"hyperrealistic\", \"8k\", \"trending on artstation\". Instead, use concrete descriptive terms like \"volumetric lighting\", \"fine brushstrokes\", \"sharp digital painting\".\n"
        "7. **Output Format**: Return ONLY the final optimized prompt string, with no prefix, markdown framing, or conversational text, so it can be immediately saved into the system."
    )

    try:
        r = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": raw_prompt},
                ],
                "temperature": 0.7,
            },
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        optimized = data["choices"][0]["message"]["content"].strip()
        
        if optimized.startswith("```"):
            lines = optimized.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            optimized = "\n".join(lines).strip()
            
        return {"optimized_prompt": optimized}
    except Exception as e:
        raise HTTPException(500, f"Failed to call Prompt Optimizer API: {str(e)}")


def test_openai_connection(api_key: str, base_url: str, model: str):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    r = httpx.post(
        f"{base_url.rstrip('/')}/chat/completions",
        headers=headers,
        json={
            "model": model,
            "messages": [
                {"role": "user", "content": "Respond only with the word 'ok' and nothing else."}
            ],
            "max_tokens": 5,
        },
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    return data["choices"][0]["message"]["content"].strip()


@router.get("/settings")
def get_settings_endpoint():
    api_key = get_setting("openai_api_key", settings.openai_api_key)
    base_url = get_setting("openai_base_url", settings.openai_base_url)
    model = get_setting("openai_model", settings.openai_model)
    local_save_dir = get_setting("local_save_dir", "")
    
    masked_key = ""
    if api_key:
        if len(api_key) > 8:
            masked_key = f"{api_key[:6]}...{api_key[-4:]}"
        else:
            masked_key = "••••••••"
            
    return {
        "openai_api_key": masked_key,
        "openai_base_url": base_url,
        "openai_model": model,
        "custom_css": get_setting("custom_css", ""),
        "local_save_dir": local_save_dir,
    }


@router.post("/settings/test")
def test_settings_endpoint(
    api_key: str = Form(...),
    base_url: str = Form(...),
    model: str = Form(...),
):
    if "..." in api_key or "••" in api_key or api_key == "••••••••":
        actual_key = get_setting("openai_api_key", settings.openai_api_key)
    else:
        actual_key = api_key

    if not actual_key:
        raise HTTPException(400, "API Key is required")

    try:
        res = test_openai_connection(actual_key, base_url, model)
        return {"status": "ok", "response": res}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(400, f"Connection test failed: {str(e)}")


@router.post("/settings/save")
def save_settings_endpoint(
    api_key: str = Form(...),
    base_url: str = Form(...),
    model: str = Form(...),
    custom_css: str = Form(""),
    local_save_dir: str = Form(""),
):
    is_masked = "..." in api_key or "••" in api_key or api_key == "••••••••"
    if is_masked:
        actual_key = get_setting("openai_api_key", settings.openai_api_key)
    else:
        actual_key = api_key

    # Save values first
    if not is_masked:
        set_setting("openai_api_key", actual_key)
    set_setting("openai_base_url", base_url)
    set_setting("openai_model", model)
    set_setting("custom_css", custom_css)
    set_setting("local_save_dir", local_save_dir)

    # Perform connection test as a warning check
    test_warning = None
    if actual_key:
        try:
            test_openai_connection(actual_key, base_url, model)
        except Exception as e:
            test_warning = f"Connection check warning: {str(e)}"
    else:
        test_warning = "No API Key configured"

    if test_warning:
        return {"status": "warning", "detail": test_warning}
    return {"status": "ok"}


@router.post("/analyze-vision")
def analyze_vision(
    image: UploadFile = File(...),
):
    """Analyze a style reference image using Multimodal Vision AI (mimo-v2.5-free)."""
    api_key = get_setting("openai_api_key", settings.openai_api_key)
    base_url = get_setting("openai_base_url", settings.openai_base_url)
    model = get_setting("openai_model", "mimo-v2.5-free")
    if not model or model.strip() == "":
        model = "mimo-v2.5-free"
    
    if not api_key:
        raise HTTPException(500, "OpenAI API Key not configured")

    try:
        content = image.file.read()
        pil_img = Image.open(io.BytesIO(content)).convert("RGB")
        max_dim = 1024
        if max(pil_img.size) > max_dim:
            ratio = max_dim / max(pil_img.size)
            pil_img = pil_img.resize((int(pil_img.size[0] * ratio), int(pil_img.size[1] * ratio)), Image.LANCZOS)
        
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=90)
        base64_image = base64.b64encode(buf.getvalue()).decode('utf-8')
        
        vision_prompt = (
            "Analyze this style reference image to extract ONLY its visual, photographic, and artistic style.\n\n"
            "CRITICAL DIRECTIVES FOR PROMPT GENERATION:\n"
            "1. Absolutely DO NOT describe or mention ANY clothing, outfits, dress, suit, shirt, costume, or attire.\n"
            "2. Absolutely DO NOT describe or mention ANY pose, posture, body position, standing, sitting, or human action.\n"
            "3. Absolutely DO NOT describe the person, face, hair color, gender, or body in the reference image (the person in the reference image is NOT important).\n\n"
            "Focus EXCLUSIVELY on describing:\n"
            "- Artistic medium & rendering technique (e.g. vintage film photo, oil painting, studio photography, cyberpunk digital art, watercolor, anime lineart)\n"
            "- Color palette, color grading, tone, contrast, and color saturation\n"
            "- Lighting, shadows, volumetric glow, reflections, and atmospheric mood\n"
            "- Background scenery, environment, composition, and surface textures\n\n"
            "Output a highly detailed prompt template for an image-to-image (i2i) photo booth pipeline following these strict rules:\n"
            "1. Focus purely on describing the photo/artistic style, color scheme, lighting, and environmental atmosphere.\n"
            "2. Completely leave out clothing, outfits, poses, actions, and human characteristics.\n"
            "3. Append this exact guardrail at the end: 'Transform ONLY the person from the guest photo into this style. Strictly preserve their facial identity, pose, and count. Do NOT add extra people. Use the reference image for style, color scheme, and aesthetic texture only.'\n"
            "4. Do not include generic buzzwords like 'photorealistic', 'hyperrealistic', '8k', or 'trending on artstation'.\n"
            "5. Output ONLY the raw prompt template text with no markdown formatting, code fences, headers, or introductory text."
        )
        
        r = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {
                      "role": "user",
                      "content": [
                        {
                          "type": "text",
                          "text": vision_prompt
                        },
                        {
                          "type": "image_url",
                          "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}"
                          }
                        }
                      ]
                    }
                ],
                "temperature": 0.7,
            },
            timeout=60,
        )
        r.raise_for_status()
        data = r.json()
        description = data["choices"][0]["message"]["content"].strip()
        
        if description.startswith("```"):
            lines = description.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines[-1].startswith("```"):
                lines = lines[:-1]
            description = "\n".join(lines).strip()
            
        return {"optimized_prompt": description}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"Vision API analysis failed: {str(e)}")


@router.get("/{file_path:path}")
def serve_style_file(file_path: str):
    path = STYLES_DIR / file_path
    if not path.exists():
        raise HTTPException(404)
    return FileResponse(str(path))
