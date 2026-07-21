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
    limit: int = Query(200)
):
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
        params = []
        conditions = []
        
        if event_id and event_id != "all":
            conditions.append("s.event_id = ?")
            params.append(event_id)
        if status and status != "all":
            conditions.append("s.status = ?")
            params.append(status)
            
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
            
        query += " ORDER BY s.created_at DESC LIMIT ?"
        params.append(limit)
        
        rows = db.execute(query, params).fetchall()
        result = []
        for r in rows:
            d = dict(r)
            
            # File metadata
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
            
        return result

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

@router.delete("/print-queue/{queue_id}")
def delete_queue_job(queue_id: int):
    with get_db() as db:
        db.execute("DELETE FROM print_queue WHERE id=?", (queue_id,))
    return {"status": "deleted"}

@router.post("/print-queue/clear")
def clear_completed_queue():
    with get_db() as db:
        db.execute("DELETE FROM print_queue WHERE status IN ('completed', 'failed')")
    return {"status": "cleared"}

@router.post("/print-queue/toggle-pause")
def toggle_queue_pause():
    curr = get_setting("print_queue_paused", "0")
    next_val = "1" if curr == "0" else "0"
    set_setting("print_queue_paused", next_val)
    return {"paused": next_val == "1"}

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
                if target_path and os.path.exists(target_path):
                    enqueue_print(job_id, target_path)
                    queued_count += 1
                    
    return {"status": "ok", "queued_count": queued_count}

@router.post("/bulk-download")
def bulk_download(req: BulkActionRequest):
    if not req.job_ids:
        raise HTTPException(400, "No job_ids provided")
        
    tmp_zip = tempfile.NamedTemporaryFile(delete=False, suffix=".zip")
    tmp_zip_path = tmp_zip.name
    tmp_zip.close()

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

    if added_count == 0:
        os.unlink(tmp_zip_path)
        raise HTTPException(404, "No valid image files found to package into zip")

    return FileResponse(tmp_zip_path, media_type="application/zip", filename="PhotoLab_Selected_Photos.zip")
