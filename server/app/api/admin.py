from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.config import settings
from app.db import get_db
from pathlib import Path
import shutil, json

router = APIRouter(prefix="/api/admin/maintenance", tags=["admin"])

@router.get("/watchdog/status")
def get_watchdog_status():
    with get_db() as db:
        row = db.execute("SELECT value FROM app_settings WHERE key='watchdog_status'").fetchone()
        if row:
            try:
                return json.loads(row[0])
            except:
                pass
        return {
            "status": "unknown",
            "pid": 0,
            "memory_mb": 0.0,
            "limit_mb": 2048.0,
            "last_check_time": "Never",
            "last_restart_time": "Never",
            "last_restart_reason": "None"
        }

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
                try:
                    if child.is_file():
                        child.unlink()
                        cleared_count += 1
                    elif child.is_dir():
                        shutil.rmtree(child)
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

@router.get("/storage-info")
def get_storage_info():
    def get_dir_size(dir_path):
        total = 0
        p = Path(dir_path)
        if p.exists():
            for f in p.rglob("*"):
                if f.is_file():
                    total += f.stat().st_size
        return total

    upload_bytes = get_dir_size(settings.upload_dir)
    output_bytes = get_dir_size(settings.output_dir)
    db_bytes = Path(settings.db_path).stat().st_size if Path(settings.db_path).exists() else 0

    return {
        "upload_mb": round(upload_bytes / (1024 * 1024), 2),
        "output_mb": round(output_bytes / (1024 * 1024), 2),
        "db_mb": round(db_bytes / (1024 * 1024), 2),
        "total_mb": round((upload_bytes + output_bytes + db_bytes) / (1024 * 1024), 2)
    }

@router.post("/auto-cleanup")
def auto_cleanup(days: int = 30):
    from datetime import datetime, timedelta
    cutoff = (datetime.now() - timedelta(days=days)).isoformat()
    cleaned_sessions = 0
    cleaned_files = 0

    with get_db() as db:
        old_sessions = db.execute("SELECT job_id, output_image, print_image, input_image FROM sessions WHERE created_at < ?", (cutoff,)).fetchall()
        for r in old_sessions:
            job_id = r["job_id"]
            cleaned_sessions += 1
            for path in [r["output_image"], r["print_image"], r["input_image"]]:
                if path and os.path.exists(path):
                    try:
                        os.unlink(path)
                        cleaned_files += 1
                    except Exception:
                        pass
            
            # Clean job subfolders
            for d in [settings.upload_dir, settings.output_dir]:
                jdir = Path(d) / job_id
                if jdir.exists() and jdir.is_dir():
                    try:
                        shutil.rmtree(jdir)
                        cleaned_files += 1
                    except Exception:
                        pass

    return {"status": "ok", "retention_days": days, "cleaned_sessions": cleaned_sessions, "cleaned_files": cleaned_files}

@router.get("/stats")
def get_stats(days: int = 30):
    with get_db() as db:
        # Total
        total = db.execute("SELECT COUNT(*) FROM sessions WHERE status='done'").fetchone()[0]
        
        # Today
        from datetime import date, datetime, timedelta
        today = date.today().isoformat()
        today_total = db.execute("SELECT COUNT(*) FROM sessions WHERE status='done' AND date(created_at) = ?", (today,)).fetchone()[0]
        
        # Range total
        cutoff = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        range_total = db.execute("SELECT COUNT(*) FROM sessions WHERE status='done' AND date(created_at) >= ?", (cutoff,)).fetchone()[0]
        
        # Total cost & avg generation time
        cost_row = db.execute("SELECT SUM(cost_money) as total_cost, AVG(cost_time) as avg_time FROM sessions WHERE status='done'").fetchone()
        total_cost = round(cost_row["total_cost"] or 0, 4)
        avg_time = round(cost_row["avg_time"] or 0, 1)

        # By Style
        style_counts = db.execute("SELECT style_id, COUNT(*) as count FROM sessions WHERE status='done' GROUP BY style_id ORDER BY count DESC").fetchall()
        styles_list = [{"style_id": r["style_id"], "count": r["count"]} for r in style_counts]
        
        # By Hour (for today)
        hourly = db.execute("SELECT strftime('%H', created_at) as hr, COUNT(*) as count FROM sessions WHERE status='done' AND date(created_at) = ? GROUP BY hr ORDER BY hr ASC", (today,)).fetchall()
        hourly_list = [{"hour": r["hr"], "count": r["count"]} for r in hourly]

        # Daily trend (last N days)
        daily = db.execute("SELECT date(created_at) as dt, COUNT(*) as count FROM sessions WHERE status='done' AND date(created_at) >= ? GROUP BY dt ORDER BY dt ASC", (cutoff,)).fetchall()
        daily_list = [{"date": r["dt"], "count": r["count"]} for r in daily]
        
        return {
            "total": total,
            "today": today_total,
            "range_total": range_total,
            "total_cost": total_cost,
            "avg_time": avg_time,
            "by_style": styles_list,
            "hourly": hourly_list,
            "daily_trend": daily_list
        }
