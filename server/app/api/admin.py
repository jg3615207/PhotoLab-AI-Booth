from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.config import settings
from app.db import get_db
from pathlib import Path
import shutil

router = APIRouter(prefix="/api/admin/maintenance", tags=["admin"])

@router.get("/backup-db")
def backup_db():
    return FileResponse(settings.db_path, filename="photolab_backup.db")

@router.post("/clear-cache")
def clear_cache():
    cleared_count = 0
    for d in [settings.upload_dir, settings.output_dir]:
        p = Path(d)
        if p.exists():
            for child in p.iterdir():
                if child.is_file():
                    try:
                        child.unlink()
                        cleared_count += 1
                    except Exception as e:
                        print(f"Failed to delete {child}: {e}")
    return {"status": "ok", "cleared_files": cleared_count}

@router.get("/live-jobs")
def get_live_jobs():
    with get_db() as db:
        rows = db.execute("SELECT * FROM sessions WHERE status IN ('processing', 'pending') ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]

class BulkEventRequest(BaseModel):
    ids: list[str]

@router.post("/events/bulk-archive")
def bulk_archive_events(req: BulkEventRequest):
    with get_db() as db:
        for eid in req.ids:
            db.execute("UPDATE events SET archived = 1 WHERE id = ?", (eid,))
    return {"status": "ok"}

@router.post("/events/bulk-delete")
def bulk_delete_events(req: BulkEventRequest):
    with get_db() as db:
        for eid in req.ids:
            db.execute("DELETE FROM events WHERE id = ?", (eid,))
    return {"status": "ok"}

@router.get("/stats")
def get_stats():
    with get_db() as db:
        # Total
        total = db.execute("SELECT COUNT(*) FROM sessions WHERE status='done'").fetchone()[0]
        # Today
        from datetime import date
        today = date.today().isoformat()
        today_total = db.execute("SELECT COUNT(*) FROM sessions WHERE status='done' AND date(created_at) = ?", (today,)).fetchone()[0]
        
        # By Style
        style_counts = db.execute("SELECT style_id, COUNT(*) as count FROM sessions WHERE status='done' GROUP BY style_id").fetchall()
        styles_list = [{"style_id": r["style_id"], "count": r["count"]} for r in style_counts]
        
        # By Hour (for today)
        hourly = db.execute("SELECT strftime('%H', created_at) as hr, COUNT(*) as count FROM sessions WHERE status='done' AND date(created_at) = ? GROUP BY hr", (today,)).fetchall()
        hourly_list = [{"hour": r["hr"], "count": r["count"]} for r in hourly]
        
        return {
            "total": total,
            "today": today_total,
            "by_style": styles_list,
            "hourly": hourly_list
        }
