from fastapi import APIRouter
from fastapi.responses import FileResponse
from pydantic import BaseModel
from app.config import settings
from app.db import get_db
from pathlib import Path
import shutil, json, os, sqlite3, tempfile

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
    temp_dir = tempfile.gettempdir()
    backup_path = os.path.join(temp_dir, "photolab_backup.db")
    try:
        src = sqlite3.connect(settings.db_path)
        dst = sqlite3.connect(backup_path)
        with dst:
            src.backup(dst)
        dst.close()
        src.close()
        return FileResponse(backup_path, filename="photolab_backup.db")
    except Exception as e:
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

@router.get("/diagnostics")
def run_diagnostics():
    import httpx, shutil
    results = {}
    
    # 1. RunningHub API Key check
    rh_api = settings.api_key
    if rh_api:
        try:
            with httpx.Client(timeout=5.0) as client:
                r = client.post(f"{settings.rh_base_url}/task/openapi/status", json={"apiKey": rh_api, "taskId": "test"})
                results["runninghub_api"] = {"status": "ok" if r.status_code == 200 else "error", "code": r.status_code}
        except Exception as e:
            results["runninghub_api"] = {"status": "error", "message": str(e)}
    else:
        results["runninghub_api"] = {"status": "warning", "message": "API key not configured"}

    # 2. Disk Storage space check
    try:
        total, used, free = shutil.disk_usage(settings.output_dir)
        results["storage"] = {
            "free_gb": round(free / (1024**3), 2),
            "total_gb": round(total / (1024**3), 2),
            "status": "ok" if free > 5 * 1024**3 else "warning"
        }
    except Exception as e:
        results["storage"] = {"status": "error", "message": str(e)}

    # 3. Database Integrity check
    try:
        with get_db() as db:
            integrity = db.execute("PRAGMA integrity_check").fetchone()[0]
            results["database"] = {"status": "ok" if integrity == "ok" else "error", "message": integrity}
    except Exception as e:
        results["database"] = {"status": "error", "message": str(e)}

    return results

class DBConfigPayload(BaseModel):
    db_mode: str = "local"  # "local" | "remote"
    cf_account_id: str = ""
    cf_d1_database_id: str = ""
    cf_api_token: str = ""

@router.get("/db/config")
def get_db_config():
    with get_db() as db:
        mode = settings.db_mode
        acc = settings.cf_account_id
        db_id = settings.cf_d1_database_id
        token = settings.cf_api_token
        
        # Load from DB settings if stored
        rows = db.execute("SELECT key, value FROM app_settings WHERE key IN ('db_mode', 'cf_account_id', 'cf_d1_database_id', 'cf_api_token')").fetchall()
        kv = {r[0]: r[1] for r in rows}
        if "db_mode" in kv: mode = kv["db_mode"]
        if "cf_account_id" in kv: acc = kv["cf_account_id"]
        if "cf_d1_database_id" in kv: db_id = kv["cf_d1_database_id"]
        if "cf_api_token" in kv: token = kv["cf_api_token"]

        return {
            "db_mode": mode,
            "cf_account_id": acc,
            "cf_d1_database_id": db_id,
            "cf_api_token_configured": bool(token),
            "cf_api_token_preview": token[:6] + "..." if token else ""
        }

@router.post("/db/config")
def update_db_config(payload: DBConfigPayload):
    with get_db() as db:
        db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('db_mode', ?)", (payload.db_mode,))
        db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('cf_account_id', ?)", (payload.cf_account_id,))
        db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('cf_d1_database_id', ?)", (payload.cf_d1_database_id,))
        if payload.cf_api_token and payload.cf_api_token != "KEEP_EXISTING":
            db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('cf_api_token', ?)", (payload.cf_api_token,))
            settings.cf_api_token = payload.cf_api_token

    settings.db_mode = payload.db_mode
    settings.cf_account_id = payload.cf_account_id
    settings.cf_d1_database_id = payload.cf_d1_database_id

    return {"status": "ok", "db_mode": settings.db_mode}

@router.post("/db/test-d1")
def test_cloudflare_d1(payload: DBConfigPayload = None):
    from app.db import CloudflareD1Client
    acc = payload.cf_account_id if payload else settings.cf_account_id
    db_id = payload.cf_d1_database_id if payload else settings.cf_d1_database_id
    token = payload.cf_api_token if (payload and payload.cf_api_token and payload.cf_api_token != "KEEP_EXISTING") else settings.cf_api_token

    client = CloudflareD1Client(acc, db_id, token)
    try:
        res = client.test_connection()
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/db/sync-d1")
def sync_to_cloudflare_d1():
    from app.db import CloudflareD1Client, sync_local_db_to_d1
    try:
        res = sync_local_db_to_d1()
        return res
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
