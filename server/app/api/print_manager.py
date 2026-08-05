import os, math, zipfile, tempfile
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Form, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.db import get_db, get_setting, set_setting
from app.services.printing import enqueue_print

class BulkActionRequest(BaseModel):
    job_ids: list[str]

router = APIRouter(prefix="/api/admin", tags=["print_manager"])

def format_file_size(size_bytes: int) -> str:
    if not size_bytes or size_bytes <= 0:
        return "N/A"
    size_name = ("B", "KB", "MB", "GB")
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_name[i]}"

@router.get("/job-history")
def get_job_history(
    event_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1),
    page_size: int = Query(50),
    limit: Optional[int] = Query(None)
):
    if limit is not None:
        page_size = limit

    effective_page = max(1, page)
    effective_size = max(1, min(page_size, 200))
    offset = (effective_page - 1) * effective_size

    with get_db() as db:
        params = []
        conditions = []
        
        if event_id and event_id != "all":
            if event_id in ("unassigned", "none"):
                conditions.append("(s.event_id IS NULL OR s.event_id = '' OR s.event_id = 'none')")
            else:
                conditions.append("s.event_id = ?")
                params.append(event_id)
        if status and status != "all":
            conditions.append("s.status = ?")
            params.append(status)

        count_query = "SELECT COUNT(*) FROM sessions s"
        if conditions:
            count_query += " WHERE " + " AND ".join(conditions)

        total_count = db.execute(count_query, params).fetchone()[0]

        query = """
            SELECT 
                s.job_id,
                s.event_id,
                COALESCE(e.name, 'Default Session') as event_name,
                s.style_id,
                COALESCE(st.name, s.style_id) as style_name,
                s.status,
                s.input_image,
                s.output_image,
                s.print_image,
                s.print_status,
                s.capture_source,
                COALESCE(NULLIF(s.v2_model, ''), st.v2_model, st.provider, 'nb2-cheap') as v2_model,
                COALESCE(s.download_count, 0) as download_count,
                s.cost_time,
                s.cost_money,
                s.created_at,
                s.updated_at,
                s.printed_at
            FROM sessions s
            LEFT JOIN events e ON s.event_id = e.id
            LEFT JOIN styles st ON s.style_id = st.id
        """
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += " ORDER BY s.created_at DESC LIMIT ? OFFSET ?"
        data_params = list(params) + [effective_size, offset]
        
        rows = db.execute(query, data_params).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            
            out_path = d.get("print_image") or d.get("output_image")
            file_size_str = "N/A"
            filename_str = f"{d['job_id']}.jpg"
            if out_path and os.path.exists(out_path):
                filename_str = os.path.basename(out_path)
                try:
                    file_size_str = format_file_size(os.path.getsize(out_path))
                except Exception:
                    pass
            
            d["file_name"] = filename_str
            d["file_size_formatted"] = file_size_str
            d["is_downloaded"] = d["download_count"] > 0
            result.append(d)

        import math
        return {
            "items": result,
            "total": total_count,
            "page": effective_page,
            "page_size": effective_size,
            "total_pages": math.ceil(total_count / effective_size) if effective_size > 0 else 1
        }

@router.get("/job-detail/{job_id}")
def get_job_detail(job_id: str):
    import json
    from app.config import settings
    with get_db() as db:
        query = """
            SELECT 
                s.job_id,
                s.event_id,
                COALESCE(e.name, 'Default Session') as event_name,
                s.style_id,
                COALESCE(st.name, s.style_id) as style_name,
                s.status,
                s.input_image,
                s.output_image,
                s.print_image,
                s.print_status,
                s.capture_source,
                COALESCE(NULLIF(s.v2_model, ''), st.v2_model, st.provider, 'nb2-cheap') as v2_model,
                st.prompt_template,
                st.aspect_ratio,
                st.resolution,
                COALESCE(s.download_count, 0) as download_count,
                s.cost_time,
                s.cost_money,
                s.created_at,
                s.updated_at,
                s.printed_at
            FROM sessions s
            LEFT JOIN events e ON s.event_id = e.id
            LEFT JOIN styles st ON s.style_id = st.id
            WHERE s.job_id = ?
        """
        row = db.execute(query, (job_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Job not found")

        data = dict(row)

        # File metadata
        out_path = data.get("print_image") or data.get("output_image")
        file_size_str = "N/A"
        if out_path and os.path.exists(out_path):
            try:
                file_size_str = format_file_size(os.path.getsize(out_path))
            except Exception:
                pass
        data["file_size_formatted"] = file_size_str

        # Try reading meta.json from output dir if exists
        meta_json = {}
        out_dir = Path(settings.output_dir) / job_id
        meta_file = out_dir / "meta.json"
        if meta_file.exists():
            try:
                with open(meta_file, "r", encoding="utf-8") as f:
                    meta_json = json.load(f)
            except Exception as e:
                print(f"[get_job_detail] Failed to parse meta.json for {job_id}: {e}")

        # Also attempt to extract embedded PNG metadata if meta.json is absent
        if not meta_json:
            raw_png = out_dir / "raw.png"
            if raw_png.exists():
                try:
                    from PIL import Image
                    img = Image.open(str(raw_png))
                    if hasattr(img, 'text') and 'json' in img.text:
                        meta_json = json.loads(img.text['json'])
                    elif hasattr(img, 'info') and 'json' in img.info:
                        meta_json = json.loads(img.info['json'])
                except Exception as e:
                    print(f"[get_job_detail] Failed to extract PNG metadata for {job_id}: {e}")

        exact_json = meta_json or {
            "job_id": job_id,
            "style_id": data["style_id"],
            "prompt": data.get("prompt_template", ""),
            "v2_model": data["v2_model"],
            "aspect_ratio": data.get("aspect_ratio", "2:3"),
            "resolution": data.get("resolution", "2k"),
            "cost_time_ms": data.get("cost_time", 0),
            "cost_money_usd": data.get("cost_money", 0),
            "created_at": data.get("created_at")
        }

        # Check for local face crop files on disk (user1.jpg, user2.jpg, ...)
        user_crop_files = []
        if out_dir.exists():
            for cf in sorted(out_dir.glob("user*.jpg")):
                user_crop_files.append({
                    "name": cf.stem,
                    "filename": cf.name,
                    "size_bytes": cf.stat().st_size,
                    "size_formatted": format_file_size(cf.stat().st_size),
                    "url": f"/api/images/{job_id}/{cf.name}"
                })
        data["user_crop_files"] = user_crop_files
        data["meta_json"] = exact_json
        return data

@router.get("/ref-gen-history")
def get_ref_gen_history(limit: int = Query(100)):
    with get_db() as db:
        rows = db.execute("""
            SELECT 
                rg.id,
                rg.style_id,
                COALESCE(st.name, rg.style_id) as style_name,
                rg.prompt,
                rg.aspect_ratio,
                rg.resolution,
                rg.v2_model,
                rg.v2_quality,
                rg.preview_url,
                rg.cost_time,
                rg.cost_money,
                rg.status,
                rg.created_at
            FROM ref_gen_logs rg
            LEFT JOIN styles st ON rg.style_id = st.id
            ORDER BY rg.created_at DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return [dict(r) for r in rows]

@router.get("/print-queue")
def get_print_queue():
    with get_db() as db:
        paused = get_setting("print_queue_paused", "0") == "1"
        rows = db.execute("""
            SELECT 
                pq.id,
                pq.session_id,
                pq.image_path,
                pq.copies,
                pq.status,
                pq.created_at,
                COALESCE(pq.printed_at, '') as printed_at,
                s.event_id,
                COALESCE(e.name, 'Default') as event_name,
                s.style_id
            FROM print_queue pq
            LEFT JOIN sessions s ON pq.session_id = s.job_id
            LEFT JOIN events e ON s.event_id = e.id
            ORDER BY pq.id DESC
            LIMIT 300
        """).fetchall()
        
        items = []
        for r in rows:
            d = dict(r)
            fname = os.path.basename(d["image_path"]) if d["image_path"] else "print.jpg"
            d["file_name"] = fname
            items.append(d)
            
        return {
            "paused": paused,
            "queue": items
        }

@router.post("/print-queue/{queue_id}/reprint")
def reprint_queue_job(queue_id: int):
    with get_db() as db:
        row = db.execute("SELECT * FROM print_queue WHERE id=?", (queue_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Print job not found")
        
        # Reset to queued
        db.execute("UPDATE print_queue SET status='queued' WHERE id=?", (queue_id,))
        if row["session_id"]:
            db.execute("UPDATE sessions SET print_status='queued' WHERE job_id=?", (row["session_id"],))
            
    return {"status": "requeued"}

@router.post("/print-queue/{queue_id}/cancel")
def cancel_queue_job(queue_id: int):
    with get_db() as db:
        row = db.execute("SELECT session_id FROM print_queue WHERE id=?", (queue_id,)).fetchone()
        if row and row["session_id"]:
            db.execute("UPDATE sessions SET print_status='cancelled' WHERE job_id=?", (row["session_id"],))
        db.execute("UPDATE print_queue SET status='cancelled' WHERE id=?", (queue_id,))
    return {"status": "cancelled"}

@router.delete("/print-queue/{queue_id}")
def delete_queue_job(queue_id: int):
    with get_db() as db:
        db.execute("DELETE FROM print_queue WHERE id=?", (queue_id,))
    return {"status": "deleted"}

@router.post("/print-queue/clear")
def clear_completed_queue():
    with get_db() as db:
        db.execute("DELETE FROM print_queue WHERE status IN ('completed', 'failed', 'cancelled')")
    return {"status": "cleared"}

@router.post("/print-queue/toggle-pause")
def toggle_queue_pause():
    curr = get_setting("print_queue_paused", "0")
    next_val = "1" if curr == "0" else "0"
    set_setting("print_queue_paused", next_val)
    return {"paused": next_val == "1"}

@router.post("/reprint/{job_id}")
def admin_reprint(job_id: str):
    from app.config import settings
    with get_db() as db:
        sess = db.execute("SELECT output_image, print_image FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        if not sess:
            raise HTTPException(404, "Job not found")
        target_path = sess["print_image"] if (sess["print_image"] and os.path.exists(sess["print_image"])) else sess["output_image"]
        if not target_path or not os.path.exists(target_path):
            out_dir = Path(settings.output_dir) / job_id
            for alt in [out_dir / "print_ready.jpg", out_dir / "framed.jpg", out_dir / "upscaled.jpg", out_dir / "raw.png"]:
                if alt.exists():
                    target_path = str(alt)
                    break
        if not target_path or not os.path.exists(target_path):
            raise HTTPException(404, "Print image file not found")
        enqueue_print(image_path=target_path, copies=1, session_id=job_id)
        return {"status": "queued"}

@router.post("/bulk-reprint")
def bulk_reprint(req: BulkActionRequest):
    if not req.job_ids:
        raise HTTPException(400, "No job_ids provided")
        
    queued_count = 0
    with get_db() as db:
        for job_id in req.job_ids:
            sess = db.execute("SELECT output_image, print_image FROM sessions WHERE job_id=?", (job_id,)).fetchone()
            if sess:
                target_path = sess["print_image"] if (sess["print_image"] and os.path.exists(sess["print_image"])) else sess["output_image"]
                if not target_path or not os.path.exists(target_path):
                    out_dir = Path(settings.output_dir) / job_id
                    for alt in [out_dir / "print_ready.jpg", out_dir / "framed.jpg", out_dir / "upscaled.jpg", out_dir / "raw.png"]:
                        if alt.exists():
                            target_path = str(alt)
                            break
                if target_path and os.path.exists(target_path):
                    enqueue_print(image_path=target_path, copies=1, session_id=job_id)
                    queued_count += 1
                    
    return {"status": "ok", "queued_count": queued_count}

from fastapi import APIRouter, HTTPException, BackgroundTasks

def cleanup_file(filepath: str):
    try:
        if os.path.exists(filepath):
            os.unlink(filepath)
    except Exception as e:
        print(f"Failed to cleanup temp file {filepath}: {e}")

@router.post("/bulk-download")
async def bulk_download(req: BulkActionRequest, background_tasks: BackgroundTasks):
    if not req.job_ids:
        raise HTTPException(400, "No job_ids provided")
        
    tmp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp_zip_path = tmp_zip.name
    tmp_zip.close()

    def build_zip():
        added_count = 0
        with zipfile.ZipFile(tmp_zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            with get_db() as db:
                for job_id in req.job_ids:
                    sess = db.execute("SELECT output_image, print_image FROM sessions WHERE job_id=?", (job_id,)).fetchone()
                    if sess:
                        target_path = sess["print_image"] if (sess["print_image"] and os.path.exists(sess["print_image"])) else sess["output_image"]
                        if target_path and os.path.exists(target_path):
                            arcname = f"PhotoLab_{job_id}.jpg"
                            zipf.write(target_path, arcname=arcname)
                            db.execute("UPDATE sessions SET download_count = COALESCE(download_count, 0) + 1 WHERE job_id=?", (job_id,))
                            added_count += 1
        return added_count

    import asyncio
    added_count = await asyncio.to_thread(build_zip)

    if added_count == 0:
        if os.path.exists(tmp_zip_path):
            os.unlink(tmp_zip_path)
        raise HTTPException(404, "No valid image files found to package into zip")

    background_tasks.add_task(cleanup_file, tmp_zip_path)
    return FileResponse(tmp_zip_path, media_type="application/zip", filename="PhotoLab_Selected_Photos.zip")

@router.post("/launch-print-app")
def launch_print_app():
    import subprocess, sys
    # Find project root directory gracefully
    current_dir = Path(__file__).resolve().parent
    project_root = current_dir
    while project_root.parent != project_root:
        if (project_root / "print_manager_app.py").exists():
            break
        project_root = project_root.parent

    bat_path = project_root / "run_print_manager.bat"
    py_app_path = project_root / "print_manager_app.py"

    try:
        if os.name == 'nt' and hasattr(os, 'startfile') and bat_path.exists():
            os.startfile(str(bat_path))
            return {"status": "launched", "method": "os.startfile", "path": str(bat_path)}
        elif py_app_path.exists():
            python_exe = sys.executable
            subprocess.Popen([python_exe, str(py_app_path)], cwd=str(py_app_path.parent))
            return {"status": "launched", "method": "subprocess", "path": str(py_app_path)}
        else:
            raise HTTPException(404, f"Print manager script not found at {py_app_path}")
    except Exception as e:
        print(f"[launch_print_app] ERROR: {e}")
        raise HTTPException(500, f"Failed to launch print app: {str(e)}")
