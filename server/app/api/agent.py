"""
PhotoLab AI Style Agent API Endpoint
Provides conversational AI style assistant capabilities:
- Vision image analysis & style extraction
- Prompt crafting & refinement with PhotoLab guardrails
- RunningHub T2I reference image generation
- Style CRUD (create, update, clone, list)
- Multi-conversation persistence
- Streaming SSE response with tool execution
- Bilingual support (en / zh-Hant)
"""

import json
import uuid
import os
import base64
import asyncio
import httpx
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, BackgroundTasks, Query
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

from app.config import settings
from app.db import get_conn, get_db, get_setting
from app.providers.runninghub_v2 import RunningHubV2Provider

router = APIRouter(prefix="/api/agent", tags=["agent"])

AGENT_IMAGES_DIR = Path("data/agent_images")
AGENT_IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Define tool schemas for LLM tool-calling
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "analyze_image",
            "description": "Analyze an image using Vision AI to extract artistic style, color palette, lighting, medium, mood, and composition for prompt engineering.",
            "parameters": {
                "type": "object",
                "properties": {
                    "image_url_or_base64": {
                        "type": "string",
                        "description": "Image URL or base64 data to analyze"
                    },
                    "focus": {
                        "type": "string",
                        "description": "Specific focus of analysis, e.g., 'style', 'colors', 'lighting', 'composition'",
                        "default": "all"
                    }
                },
                "required": ["image_url_or_base64"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "craft_prompt",
            "description": "Craft a PhotoLab-compatible prompt template from natural language concepts or vision analysis.",
            "parameters": {
                "type": "object",
                "properties": {
                    "concept": {
                        "type": "string",
                        "description": "Natural language style concept, e.g., 'Cyberpunk neon street at night'"
                    },
                    "reference_analysis": {
                        "type": "string",
                        "description": "Optional text analysis from analyze_image tool"
                    },
                    "medium": {
                        "type": "string",
                        "description": "Artistic medium, e.g., 'anime', 'oil painting', '3D render', 'watercolor', 'cinematic photo'"
                    }
                },
                "required": ["concept"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "refine_prompt",
            "description": "Refine an existing prompt template based on user feedback (e.g. 'make it warmer', 'more detail in background').",
            "parameters": {
                "type": "object",
                "properties": {
                    "existing_prompt": {
                        "type": "string",
                        "description": "The current prompt template"
                    },
                    "feedback": {
                        "type": "string",
                        "description": "User feedback or desired changes"
                    }
                },
                "required": ["existing_prompt", "feedback"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_reference",
            "description": "Generate a new style reference image using RunningHub V2 text-to-image API.",
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {
                        "type": "string",
                        "description": "Text prompt for image generation"
                    },
                    "aspect_ratio": {
                        "type": "string",
                        "description": "Aspect ratio: '2:3', '1:1', '16:9', '3:4'",
                        "default": "2:3"
                    },
                    "model": {
                        "type": "string",
                        "description": "RunningHub v2 model: 'nb2-cheap', 'nb-pro', 'gpt2-official', 'gpt2-cheap'",
                        "default": "nb2-cheap"
                    },
                    "quality": {
                        "type": "string",
                        "description": "Model quality (optional)",
                        "default": "medium"
                    }
                },
                "required": ["prompt"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_styles",
            "description": "List existing PhotoLab styles with their IDs, names, prompt templates, models, and reference URLs.",
            "parameters": {
                "type": "object",
                "properties": {
                    "active_only": {
                        "type": "boolean",
                        "description": "Only return active styles",
                        "default": True
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_style",
            "description": "Create a new PhotoLab style in the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Unique string ID (slug format, e.g. 'neon-cyberpunk-v2')"
                    },
                    "name": {
                        "type": "string",
                        "description": "Display name in kiosk UI"
                    },
                    "prompt_template": {
                        "type": "string",
                        "description": "AI generation prompt template"
                    },
                    "aspect_ratio": {
                        "type": "string",
                        "default": "2:3"
                    },
                    "v2_model": {
                        "type": "string",
                        "default": "nb2-cheap"
                    },
                    "max_people": {
                        "type": "integer",
                        "default": 1
                    },
                    "transition_type": {
                        "type": "string",
                        "default": "glitch"
                    },
                    "ref_image_url": {
                        "type": "string",
                        "description": "URL or file path to the reference image"
                    }
                },
                "required": ["id", "name", "prompt_template"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_style",
            "description": "Update an existing style's prompt, model, name, or settings.",
            "parameters": {
                "type": "object",
                "properties": {
                    "id": {
                        "type": "string",
                        "description": "Style ID to update"
                    },
                    "name": {"type": "string"},
                    "prompt_template": {"type": "string"},
                    "aspect_ratio": {"type": "string"},
                    "v2_model": {"type": "string"},
                    "max_people": {"type": "integer"},
                    "transition_type": {"type": "string"}
                },
                "required": ["id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "clone_style",
            "description": "Clone an existing style to a new ID with optional modifications.",
            "parameters": {
                "type": "object",
                "properties": {
                    "source_id": {"type": "string"},
                    "new_id": {"type": "string"},
                    "new_name": {"type": "string"},
                    "new_prompt": {"type": "string"}
                },
                "required": ["source_id", "new_id", "new_name"]
            }
        }
    }
]


class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str
    images: List[str] = []
    lang: str = "en"


def get_llm_config():
    """Reads OpenAI/LLM settings configured in PhotoLab app_settings."""
    api_key = get_setting("openai_api_key", settings.openai_api_key)
    if not api_key or api_key.strip() == "":
        api_key = settings.api_key or ""
        
    base_url = get_setting("openai_base_url", settings.openai_base_url or "https://api.openai.com/v1")
    model = get_setting("openai_model", settings.openai_model or "gpt-4o-mini")
    
    if base_url:
        base_url = base_url.rstrip("/")
        if not base_url.endswith("/v1") and "/v1" not in base_url and "runninghub" not in base_url:
            base_url = f"{base_url}/v1"
            
    return {
        "api_key": api_key,
        "base_url": base_url,
        "model": model
    }


def build_system_prompt(lang: str = "en") -> str:
    """Builds dynamic system prompt with PhotoLab rules and current style catalog."""
    conn = get_conn()
    rows = conn.execute("SELECT id, name, prompt_template, v2_model, aspect_ratio FROM styles WHERE active=1 ORDER BY name").fetchall()
    
    styles_summary = []
    for r in rows:
        styles_summary.append(f"- ID: `{r['id']}` | Name: {r['name']} | Model: {r['v2_model']} | Ratio: {r['aspect_ratio']}\n  Prompt: \"{r['prompt_template']}\"")
    
    styles_text = "\n".join(styles_summary) if styles_summary else "No styles configured yet."
    
    if lang == "zh-Hant":
        return f"""你是一個專業的 PhotoLab AI 展位風格創作 Agent（AI Style Agent）。
你的主要任務是協助管理員創作、優化、分析與生成 PhotoLab AI 拍貼機的風格與提示詞。

### 核心能力與工具：
1. **圖片視覺分析 (analyze_image)**：分析靈感參考圖的藝術風格、色彩、光影、材質與氛圍。
2. **提示詞撰寫 (craft_prompt)**：依據 PhotoLab 規範將想法轉換為高品質英文 Prompt Template。
3. **提示詞微調 (refine_prompt)**：根據自然語言回饋修正已有提示詞。
4. **生成參考圖 (generate_reference)**：呼叫 RunningHub V2 繪製風格參考圖。
5. **風格庫管理 (list_styles, create_style, update_style, clone_style)**：直接建立、更新或複製 SQLite 資料庫中的風格。

### PhotoLab 提示詞撰寫規範 (Guardrails)：
1. **身份保持與去人物化**：提示詞必須專注於藝術介質（如 watercolor, cyberpunk neon, oil painting）、光影、色彩與背景氣氛。
2. **禁止描繪人物衣服與姿勢**：不要在 Prompt Template 中描述服裝或特定姿勢，以便保留顧客本身的著裝與動作。
3. **忽略參考圖中的人物**：提示詞應明確包含 "Transform the guest into this style. Reference image is for artistic style/colors only — ignore any people in reference."
4. **語言**：Prompt Template 必須為英文（SD / ComfyUI / RunningHub 模型最佳支援語言），但對使用者的對話與說明請使用繁體中文。

### 現有風格列表：
{styles_text}

請隨時使用適當的工具來為使用者提供服務。當使用者上傳圖片時，先進行視覺分析，然後引導創作 Prompt 與生成參考圖！"""

    return f"""You are the PhotoLab AI Style Agent, an expert assistant embedded in the PhotoLab AI Photo Booth system.
Your role is to assist admins in creating, refining, analyzing, and generating AI styles, prompts, and reference images.

### Key Tools & Capabilities:
1. **analyze_image**: Vision AI analysis of inspiration images for artistic medium, colors, lighting, texture, and mood.
2. **craft_prompt**: Craft PhotoLab-compliant prompt templates in English.
3. **refine_prompt**: Adjust existing prompts based on natural language feedback.
4. **generate_reference**: Invoke RunningHub V2 T2I model to generate style reference photos.
5. **list_styles, create_style, update_style, clone_style**: Read and manage styles directly in SQLite DB.

### PhotoLab Prompt Engineering Rules (Guardrails):
1. **Identity Preservation**: Focus prompts on artistic medium, lighting, color palette, rendering style, and atmospheric background.
2. **No Clothing or Pose Details**: Do not specify attire or physical poses in prompt templates to preserve the guest's own clothing and posture.
3. **Ignore Reference Person**: Always include instructions for the AI model to use the reference image purely for style, colors, and textures, ignoring any person depicted in the reference image.
4. **Prompt Language**: Always write prompt templates in English (for optimal RunningHub/SD model output), but communicate with the admin user in English.

### Current Styles Catalog:
{styles_text}

Use your tools proactively whenever appropriate. When the user attaches an image, analyze it, craft a prompt, and offer to generate a reference image or save a style!"""


# Helper for Tool Execution
async def execute_tool(name: str, args: Dict[str, Any], lang: str = "en") -> Dict[str, Any]:
    conn = get_conn()
    
    if name == "list_styles":
        active_only = args.get("active_only", True)
        query = "SELECT id, name, max_people, aspect_ratio, prompt_template, v2_model, rh_ref_url, active FROM styles"
        if active_only:
            query += " WHERE active=1"
        query += " ORDER BY name"
        rows = conn.execute(query).fetchall()
        return {"styles": [dict(r) for r in rows]}

    elif name == "analyze_image":
        image_input = args.get("image_url_or_base64", "")
        focus = args.get("focus", "all")
        
        cfg = get_llm_config()
        if not cfg["api_key"]:
            return {"error": "LLM API Key is missing. Please set it in System Settings."}
            
        vision_prompt = (
            f"Analyze this image for an AI photo booth style reference (focus: {focus}). "
            "Describe in detail: 1) Artistic medium (e.g. digital art, oil painting, 3D render, anime), "
            "2) Color palette & color temperature, 3) Lighting quality & mood, "
            "4) Textures and line work, 5) Recommended background atmosphere. "
            "Ignore any specific human subjects. Output concise structured bullet points."
        )
        
        content_payload = [{"type": "text", "text": vision_prompt}]
        if image_input.startswith("data:image") or image_input.startswith("http"):
            content_payload.append({"type": "image_url", "image_url": {"url": image_input}})
        else:
            if os.path.exists(image_input):
                with open(image_input, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("utf-8")
                content_payload.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}})
            else:
                content_payload.append({"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_input}"}})

        headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}
        payload = {
            "model": cfg["model"],
            "messages": [{"role": "user", "content": content_payload}],
            "max_tokens": 800
        }
        
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(f"{cfg['base_url']}/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                res_json = resp.json()
                analysis_text = res_json["choices"][0]["message"]["content"]
                return {"analysis": analysis_text}
            else:
                return {"error": f"Vision API error ({resp.status_code}): {resp.text}"}

    elif name == "craft_prompt":
        concept = args.get("concept", "")
        ref_analysis = args.get("reference_analysis", "")
        medium = args.get("medium", "")
        
        prompt_parts = []
        if medium:
            prompt_parts.append(f"{medium} style")
        prompt_parts.append(concept)
        if ref_analysis:
            prompt_parts.append(f"incorporating elements: {ref_analysis[:150]}")
            
        base_concept = ", ".join(prompt_parts)
        
        cfg = get_llm_config()
        if cfg["api_key"]:
            sys_msg = (
                "You are an AI prompt engineer for PhotoLab photo booth. Convert the user concept into a high-quality "
                "ComfyUI / Stable Diffusion image-to-image prompt template in English. "
                "Format: Describe art medium, colors, lighting, atmospheric details. "
                "Add guardrails: 'Transform ONLY the person from input photo into this style. Do NOT add extra people. Reference image is for style/colors only.' "
                "Output ONLY the final prompt template text without intro or explanations."
            )
            headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}
            payload = {
                "model": cfg["model"],
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": f"Create prompt template for: {base_concept}"}
                ],
                "max_tokens": 300
            }
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(f"{cfg['base_url']}/chat/completions", headers=headers, json=payload)
                    if resp.status_code == 200:
                        crafted = resp.json()["choices"][0]["message"]["content"].strip().strip('"')
                        return {"prompt_template": crafted}
            except Exception:
                pass
                
        fallback_prompt = f"{base_concept}, highly detailed, vibrant colors, masterwork atmosphere. Transform the guest photo into this style. Do NOT add extra people. Reference image is for style only."
        return {"prompt_template": fallback_prompt}

    elif name == "refine_prompt":
        existing = args.get("existing_prompt", "")
        feedback = args.get("feedback", "")
        
        cfg = get_llm_config()
        if cfg["api_key"]:
            sys_msg = (
                "Modify the existing prompt template according to user feedback. Maintain PhotoLab prompt rules "
                "(preserve focus on medium/atmosphere, English language, preserve subject identity). Output ONLY the refined prompt text."
            )
            headers = {"Authorization": f"Bearer {cfg['api_key']}", "Content-Type": "application/json"}
            payload = {
                "model": cfg["model"],
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": f"Existing Prompt: \"{existing}\"\nFeedback: {feedback}"}
                ],
                "max_tokens": 300
            }
            try:
                async with httpx.AsyncClient(timeout=20.0) as client:
                    resp = await client.post(f"{cfg['base_url']}/chat/completions", headers=headers, json=payload)
                    if resp.status_code == 200:
                        refined = resp.json()["choices"][0]["message"]["content"].strip().strip('"')
                        return {"refined_prompt": refined}
            except Exception:
                pass
                
        return {"refined_prompt": f"{existing}, {feedback}"}

    elif name == "generate_reference":
        prompt = args.get("prompt", "")
        aspect_ratio = args.get("aspect_ratio", "2:3")
        model_name = args.get("model", "nb2-cheap")
        quality = args.get("quality", "medium")
        
        provider = RunningHubV2Provider()
        try:
            res = await provider.generate_ref_image(
                prompt=prompt,
                aspect_ratio=aspect_ratio,
                model_name=model_name,
                quality=quality
            )
            
            ref_url = res.get("url", "")
            img_id = str(uuid.uuid4())[:8]
            local_filename = f"ref_{img_id}.jpg"
            local_path = AGENT_IMAGES_DIR / local_filename
            
            if ref_url.startswith("http"):
                async with httpx.AsyncClient(timeout=30.0) as client:
                    img_resp = await client.get(ref_url)
                    if img_resp.status_code == 200:
                        with open(local_path, "wb") as f:
                            f.write(img_resp.content)
            
            local_url = f"/api/agent/images/{local_filename}"
            
            return {
                "success": True,
                "remote_url": ref_url,
                "image_url": local_url if local_path.exists() else ref_url,
                "cost_time": res.get("cost_time", 0),
                "cost_money": res.get("cost_money", 0),
                "model": model_name,
                "prompt": prompt
            }
        except Exception as e:
            return {"error": f"Reference image generation failed: {str(e)}"}

    elif name == "create_style":
        style_id = args.get("id", "").strip().lower().replace(" ", "-")
        name_val = args.get("name", "")
        prompt_template = args.get("prompt_template", "")
        aspect_ratio = args.get("aspect_ratio", "2:3")
        v2_model = args.get("v2_model", "nb2-cheap")
        max_people = args.get("max_people", 1)
        transition_type = args.get("transition_type", "glitch")
        ref_image_url = args.get("ref_image_url", "")
        
        if not style_id or not name_val or not prompt_template:
            return {"error": "Missing required fields: id, name, prompt_template"}
            
        with get_db() as db:
            db.execute("""
                INSERT OR REPLACE INTO styles 
                (id, name, max_people, aspect_ratio, prompt_template, provider, v2_model, transition_type, rh_ref_url, active)
                VALUES (?, ?, ?, ?, ?, 'v2', ?, ?, ?, 1)
            """, (style_id, name_val, max_people, aspect_ratio, prompt_template, v2_model, transition_type, ref_image_url))
            
        return {
            "success": True,
            "message": f"Style '{name_val}' (`{style_id}`) created successfully!",
            "style": {
                "id": style_id,
                "name": name_val,
                "prompt_template": prompt_template,
                "aspect_ratio": aspect_ratio,
                "v2_model": v2_model,
                "transition_type": transition_type
            }
        }

    elif name == "update_style":
        style_id = args.get("id", "")
        if not style_id:
            return {"error": "Missing style id"}
            
        fields = []
        params = []
        for k in ["name", "prompt_template", "aspect_ratio", "v2_model", "max_people", "transition_type", "rh_ref_url"]:
            if k in args and args[k] is not None:
                fields.append(f"{k} = ?")
                params.append(args[k])
                
        if not fields:
            return {"error": "No fields provided to update"}
            
        params.append(style_id)
        sql = f"UPDATE styles SET {', '.join(fields)} WHERE id = ?"
        
        with get_db() as db:
            db.execute(sql, tuple(params))
            
        return {"success": True, "message": f"Style `{style_id}` updated successfully."}

    elif name == "clone_style":
        source_id = args.get("source_id", "")
        new_id = args.get("new_id", "").strip().lower().replace(" ", "-")
        new_name = args.get("new_name", "")
        new_prompt = args.get("new_prompt", None)
        
        row = conn.execute("SELECT * FROM styles WHERE id=?", (source_id,)).fetchone()
        if not row:
            return {"error": f"Source style `{source_id}` not found"}
            
        style_dict = dict(row)
        style_dict["id"] = new_id
        style_dict["name"] = new_name
        if new_prompt:
            style_dict["prompt_template"] = new_prompt
            
        with get_db() as db:
            db.execute("""
                INSERT INTO styles (id, name, max_people, aspect_ratio, prompt_template, style_ref, thumbnail, print_frame, rh_ref_file, rh_ref_url, provider, v2_model, v2_quality, seed, resolution, workflows, transition_type, active, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
            """, (
                new_id, new_name, style_dict.get("max_people", 1), style_dict.get("aspect_ratio", "2:3"),
                style_dict.get("prompt_template", ""), style_dict.get("style_ref", ""), style_dict.get("thumbnail", ""),
                style_dict.get("print_frame", ""), style_dict.get("rh_ref_file", ""), style_dict.get("rh_ref_url", ""),
                style_dict.get("provider", "v2"), style_dict.get("v2_model", "nb2-cheap"), style_dict.get("v2_quality"),
                style_dict.get("seed", ""), style_dict.get("resolution", "2k"), style_dict.get("workflows", "{}"),
                style_dict.get("transition_type", "glitch")
            ))
            
        return {"success": True, "message": f"Style cloned to `{new_id}` ({new_name})."}

    return {"error": f"Unknown tool: {name}"}


# Conversation History Endpoints
@router.get("/conversations")
def list_conversations():
    conn = get_conn()
    rows = conn.execute("""
        SELECT c.id, c.title, c.created_at, c.updated_at, COUNT(m.id) as message_count 
        FROM agent_conversations c 
        LEFT JOIN agent_messages m ON c.id = m.conversation_id 
        GROUP BY c.id 
        ORDER BY c.updated_at DESC
    """).fetchall()
    return [dict(r) for r in rows]


@router.post("/conversations")
def create_conversation(title: str = "New Chat"):
    conv_id = str(uuid.uuid4())
    with get_db() as db:
        db.execute("INSERT INTO agent_conversations (id, title) VALUES (?, ?)", (conv_id, title))
    return {"id": conv_id, "title": title}


@router.get("/conversations/{conv_id}")
def get_conversation_history(conv_id: str):
    conn = get_conn()
    conv = conn.execute("SELECT * FROM agent_conversations WHERE id=?", (conv_id,)).fetchone()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
        
    messages = conn.execute("SELECT * FROM agent_messages WHERE conversation_id=? ORDER BY id ASC", (conv_id,)).fetchall()
    res_messages = []
    for m in messages:
        md = dict(m)
        md["images"] = json.loads(md["images"]) if md["images"] else []
        md["tool_calls"] = json.loads(md["tool_calls"]) if md["tool_calls"] else []
        md["tool_results"] = json.loads(md["tool_results"]) if md["tool_results"] else []
        res_messages.append(md)
        
    return {
        "conversation": dict(conv),
        "messages": res_messages
    }


@router.delete("/conversations/{conv_id}")
def delete_conversation(conv_id: str):
    with get_db() as db:
        db.execute("DELETE FROM agent_messages WHERE conversation_id=?", (conv_id,))
        db.execute("DELETE FROM agent_conversations WHERE id=?", (conv_id,))
    return {"success": True}


@router.delete("/conversations")
def clear_all_conversations():
    with get_db() as db:
        db.execute("DELETE FROM agent_messages")
        db.execute("DELETE FROM agent_conversations")
    return {"success": True}


@router.get("/images/{filename}")
def serve_agent_image(filename: str):
    file_path = AGENT_IMAGES_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)


# Main Streaming Chat SSE Endpoint
@router.post("/chat")
async def chat_stream(req: ChatRequest):
    cfg = get_llm_config()
    if not cfg["api_key"]:
        raise HTTPException(
            status_code=400, 
            detail="LLM API Key is missing. Please set your API Key in Global Settings (⚙️ 全域設定 -> Vision AI / LLM Settings)."
        )

    conv_id = req.conversation_id
    conn = get_conn()
    
    if not conv_id:
        conv_id = str(uuid.uuid4())
        title = req.message[:30] if req.message else "Image Analysis"
        with get_db() as db:
            db.execute("INSERT INTO agent_conversations (id, title) VALUES (?, ?)", (conv_id, title))
    else:
        existing = conn.execute("SELECT id FROM agent_conversations WHERE id=?", (conv_id,)).fetchone()
        if not existing:
            title = req.message[:30] if req.message else "Image Analysis"
            with get_db() as db:
                db.execute("INSERT INTO agent_conversations (id, title) VALUES (?, ?)", (conv_id, title))
                
    with get_db() as db:
        db.execute("UPDATE agent_conversations SET updated_at=datetime('now') WHERE id=?", (conv_id,))

    user_images_json = json.dumps(req.images)
    with get_db() as db:
        db.execute("""
            INSERT INTO agent_messages (conversation_id, role, content, images)
            VALUES (?, 'user', ?, ?)
        """, (conv_id, req.message, user_images_json))

    history_rows = conn.execute("""
        SELECT role, content, images, tool_calls, tool_results 
        FROM agent_messages 
        WHERE conversation_id=? 
        ORDER BY id DESC LIMIT 12
    """, (conv_id,)).fetchall()
    
    history_rows = list(reversed(history_rows))

    messages_payload = [{"role": "system", "content": build_system_prompt(req.lang)}]
    
    for row in history_rows:
        role = row["role"]
        content = row["content"]
        imgs = json.loads(row["images"]) if row["images"] else []
        
        if role == "user":
            if imgs:
                msg_content = [{"type": "text", "text": content or "Please inspect this image."}]
                for img_src in imgs:
                    msg_content.append({"type": "image_url", "image_url": {"url": img_src}})
                messages_payload.append({"role": "user", "content": msg_content})
            else:
                messages_payload.append({"role": "user", "content": content})
        elif role == "assistant":
            messages_payload.append({"role": "assistant", "content": content})

    async def event_generator():
        yield f"event: message_start\ndata: {json.dumps({'conversation_id': conv_id})}\n\n"
        
        headers = {
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": cfg["model"],
            "messages": messages_payload,
            "tools": AGENT_TOOLS,
            "tool_choice": "auto",
            "stream": True
        }
        
        full_assistant_text = ""
        collected_tool_calls = []

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", f"{cfg['base_url']}/chat/completions", headers=headers, json=payload) as response:
                    if response.status_code != 200:
                        err_body = await response.aread()
                        err_text = err_body.decode("utf-8")
                        yield f"event: text_delta\ndata: {json.dumps({'delta': f'⚠️ LLM Error ({response.status_code}): {err_text}'})}\n\n"
                        yield f"event: message_end\ndata: {json.dumps({'status': 'error'})}\n\n"
                        return

                    async for chunk in response.aiter_lines():
                        if not chunk or not chunk.startswith("data: "):
                            continue
                        line_data = chunk[6:].strip()
                        if line_data == "[DONE]":
                            break
                            
                        try:
                            parsed = json.loads(line_data)
                            delta = parsed["choices"][0].get("delta", {})
                            
                            if "content" in delta and delta["content"]:
                                text_chunk = delta["content"]
                                full_assistant_text += text_chunk
                                yield f"event: text_delta\ndata: {json.dumps({'delta': text_chunk})}\n\n"
                                
                            if "tool_calls" in delta and delta["tool_calls"]:
                                for tc in delta["tool_calls"]:
                                    idx = tc.get("index", 0)
                                    while len(collected_tool_calls) <= idx:
                                        collected_tool_calls.append({"id": "", "function": {"name": "", "arguments": ""}})
                                    if tc.get("id"):
                                        collected_tool_calls[idx]["id"] = tc["id"]
                                    if tc.get("function", {}).get("name"):
                                        collected_tool_calls[idx]["function"]["name"] = tc["function"]["name"]
                                    if tc.get("function", {}).get("arguments"):
                                        collected_tool_calls[idx]["function"]["arguments"] += tc["function"]["arguments"]

                        except Exception:
                            continue

        except Exception as e:
            yield f"event: text_delta\ndata: {json.dumps({'delta': f'⚠️ Request exception: {str(e)}'})}\n\n"
            yield f"event: message_end\ndata: {json.dumps({'status': 'error'})}\n\n"
            return

        executed_results = []
        if collected_tool_calls:
            for tc in collected_tool_calls:
                func_name = tc["function"]["name"]
                args_str = tc["function"]["arguments"]
                try:
                    args_dict = json.loads(args_str) if args_str else {}
                except Exception:
                    args_dict = {}
                    
                yield f"event: tool_start\ndata: {json.dumps({'tool': func_name, 'args': args_dict})}\n\n"
                
                tool_res = await execute_tool(func_name, args_dict, req.lang)
                executed_results.append({"tool": func_name, "args": args_dict, "result": tool_res})
                
                yield f"event: tool_result\ndata: {json.dumps({'tool': func_name, 'result': tool_res})}\n\n"
                
                if func_name == "generate_reference" and tool_res.get("image_url"):
                    img_url = tool_res["image_url"]
                    follow_up = f"\n\n🎨 **Generated Reference Image**:\n![Generated Reference]({img_url})\n"
                    full_assistant_text += follow_up
                    yield f"event: text_delta\ndata: {json.dumps({'delta': follow_up})}\n\n"
                elif func_name == "analyze_image" and tool_res.get("analysis"):
                    analysis_text = tool_res["analysis"]
                    follow_up = f"\n\n🔍 **Image Analysis Results**:\n{analysis_text}\n"
                    full_assistant_text += follow_up
                    yield f"event: text_delta\ndata: {json.dumps({'delta': follow_up})}\n\n"
                elif func_name == "craft_prompt" and tool_res.get("prompt_template"):
                    prompt_val = tool_res["prompt_template"]
                    follow_up = f"\n\n✍️ **Crafted Prompt Template**:\n```\n{prompt_val}\n```\n"
                    full_assistant_text += follow_up
                    yield f"event: text_delta\ndata: {json.dumps({'delta': follow_up})}\n\n"
                elif func_name == "create_style" and tool_res.get("success"):
                    msg = tool_res.get("message", "Style created!")
                    follow_up = f"\n\n✅ **{msg}**\n"
                    full_assistant_text += follow_up
                    yield f"event: text_delta\ndata: {json.dumps({'delta': follow_up})}\n\n"

        with get_db() as db:
            db.execute("""
                INSERT INTO agent_messages (conversation_id, role, content, tool_calls, tool_results)
                VALUES (?, 'assistant', ?, ?, ?)
            """, (
                conv_id,
                full_assistant_text or "Task executed.",
                json.dumps(collected_tool_calls),
                json.dumps(executed_results)
            ))
            
        yield f"event: message_end\ndata: {json.dumps({'conversation_id': conv_id, 'status': 'completed'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
