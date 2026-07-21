from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.db import init_db, seed_styles
from app.api import styles, capture, gallery, events, admin, ws
from app.services.printing import start_print_worker

app = FastAPI(title="PhotoLab AI Booth")

app.include_router(styles.router)
app.include_router(capture.router)
app.include_router(gallery.router)
app.include_router(events.router)
app.include_router(admin.router)
app.include_router(ws.router)

from app.db import init_db, seed_styles, get_setting

@app.get("/api/health")
def health():
    return {
        "status": "ok", 
        "version": "0.12.7",
        "custom_css": get_setting("custom_css", "")
    }

dist_dir = Path(__file__).parent.parent.parent / "frontend" / "dist"
if dist_dir.exists():
    app.mount("/", StaticFiles(directory=str(dist_dir), html=True), name="frontend")

@app.on_event("startup")
def startup():
    import asyncio
    ws.main_loop = asyncio.get_running_loop()
    for d in ["upload_dir", "output_dir", "print_dir"]:
        Path(getattr(settings, d)).mkdir(parents=True, exist_ok=True)
    init_db()
    seed_styles()
    
    # Graceful recovery: fail any pending/processing jobs
    from app.db import get_db
    try:
        with get_db() as db:
            db.execute("UPDATE sessions SET status='failed', error='Server restarted' WHERE status IN ('processing', 'pending')")
    except Exception as e:
        print(f"Failed to run graceful recovery: {e}")
        
    start_print_worker()
