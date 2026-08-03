from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.config import settings
from app.db import init_db, seed_styles, get_setting
from app.api import styles, capture, gallery, events, admin, ws, transitions, print_manager, agent, frame_maker
from app.services.printing import start_print_worker

from fastapi.middleware.cors import CORSMiddleware
from app.api.gallery import mobile_download_page

app = FastAPI(title="PhotoLab AI Booth")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        settings.public_base_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(styles.router)
app.include_router(capture.router)
app.include_router(gallery.router)
app.include_router(events.router)
app.include_router(admin.router)
app.include_router(ws.router)
app.include_router(transitions.router)
app.include_router(transitions.public_router)
app.include_router(print_manager.router)
app.include_router(agent.router)
app.include_router(frame_maker.router)

@app.get("/download/{job_id}")
def download_alias(job_id: str):
    return mobile_download_page(job_id)

@app.get("/api/health")
def health():
    return {
        "status": "ok", 
        "version": "0.42.0",
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
    from app.db import init_db, seed_styles, seed_transitions
    init_db()
    seed_styles()
    seed_transitions()
    
    # Graceful recovery: fail any pending/processing jobs
    from app.db import get_db
    try:
        with get_db() as db:
            db.execute("UPDATE sessions SET status='failed', error='Server restarted' WHERE status IN ('processing', 'pending')")
    except Exception as e:
        print(f"Failed to run graceful recovery: {e}")
        
    start_print_worker()

    import threading
    def background_cleanup_loop():
        import time
        while True:
            time.sleep(86400)
            try:
                with get_db() as db:
                    db.execute("VACUUM")
                    db.execute("ANALYZE")
                print("[scheduler] Automated DB VACUUM & ANALYZE completed.")
            except Exception as e:
                print(f"[scheduler] DB cleanup error: {e}")

    threading.Thread(target=background_cleanup_loop, daemon=True).start()
