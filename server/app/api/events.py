from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional
from app.db import get_db
from app.config import settings
from pathlib import Path
import json, os, shutil

router = APIRouter(prefix="/api/events", tags=["events"])

class EventCreate(BaseModel):
    id: str
    name: str
    allowed_styles: Optional[List[str]] = []
    allow_auto_print: Optional[int] = 1
    logo_path: Optional[str] = ""
    event_name_overlay: Optional[str] = ""
    frame_cap: Optional[int] = 0
    expire_date: Optional[str] = ""
    active: Optional[int] = 1
    frame_path: Optional[str] = ""
    enable_filters: Optional[int] = 0
    retake_limit: Optional[int] = 3
    qr_bg_color: Optional[str] = "#ffffff"
    qr_fg_color: Optional[str] = "#000000"
    enable_gesture_capture: Optional[int] = 1
    gen_failsafe_enabled: Optional[int] = 0
    gen_failsafe_timeout: Optional[int] = 35

class EventUpdate(BaseModel):
    name: Optional[str] = None
    allowed_styles: Optional[List[str]] = None
    allow_auto_print: Optional[int] = None
    logo_path: Optional[str] = None
    event_name_overlay: Optional[str] = None
    frame_cap: Optional[int] = None
    expire_date: Optional[str] = None
    active: Optional[int] = None
    frame_path: Optional[str] = None
    enable_filters: Optional[int] = None
    retake_limit: Optional[int] = None
    qr_bg_color: Optional[str] = None
    qr_fg_color: Optional[str] = None
    enable_gesture_capture: Optional[int] = None
    gen_failsafe_enabled: Optional[int] = None
    gen_failsafe_timeout: Optional[int] = None

@router.get("")
def list_events():
    with get_db() as db:
        rows = db.execute("SELECT * FROM events ORDER BY created_at DESC").fetchall()
        
        results = []
        for row in rows:
            event_dict = dict(row)
            try:
                event_dict["allowed_styles"] = json.loads(event_dict["allowed_styles"])
            except:
                event_dict["allowed_styles"] = []
            
            # Count completed jobs
            count = db.execute("SELECT COUNT(*) FROM sessions WHERE event_id=?", (event_dict["id"],)).fetchone()[0]
            event_dict["jobs_count"] = count
            
            results.append(event_dict)
            
        return results

@router.get("/{event_id}")
def get_event(event_id: str):
    with get_db() as db:
        row = db.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Event not found")
        
        event_dict = dict(row)
        try:
            event_dict["allowed_styles"] = json.loads(event_dict["allowed_styles"])
        except:
            event_dict["allowed_styles"] = []
            
        count = db.execute("SELECT COUNT(*) FROM sessions WHERE event_id=?", (event_id,)).fetchone()[0]
        event_dict["jobs_count"] = count
        
        return event_dict

@router.post("")
def create_event(event: EventCreate):
    with get_db() as db:
        try:
            db.execute("""
                INSERT INTO events (id, name, allowed_styles, allow_auto_print, logo_path, event_name_overlay, frame_cap, expire_date, active, frame_path, enable_filters, retake_limit, qr_bg_color, qr_fg_color, enable_gesture_capture, gen_failsafe_enabled, gen_failsafe_timeout)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (event.id, event.name, json.dumps(event.allowed_styles), event.allow_auto_print, event.logo_path, event.event_name_overlay, event.frame_cap, event.expire_date, event.active, event.frame_path, event.enable_filters, event.retake_limit, event.qr_bg_color, event.qr_fg_color, event.enable_gesture_capture, event.gen_failsafe_enabled, event.gen_failsafe_timeout))
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    return {"status": "ok"}

@router.put("/{event_id}")
def update_event(event_id: str, event: EventUpdate):
    updates = []
    values = []
    
    if event.name is not None:
        updates.append("name=?")
        values.append(event.name)
    if event.allowed_styles is not None:
        updates.append("allowed_styles=?")
        values.append(json.dumps(event.allowed_styles))
    if event.allow_auto_print is not None:
        updates.append("allow_auto_print=?")
        values.append(event.allow_auto_print)
    if event.logo_path is not None:
        updates.append("logo_path=?")
        values.append(event.logo_path)
    if event.event_name_overlay is not None:
        updates.append("event_name_overlay=?")
        values.append(event.event_name_overlay)
    if event.frame_cap is not None:
        updates.append("frame_cap=?")
        values.append(event.frame_cap)
    if event.expire_date is not None:
        updates.append("expire_date=?")
        values.append(event.expire_date)
    if event.active is not None:
        updates.append("active=?")
        values.append(event.active)
    if event.frame_path is not None:
        updates.append("frame_path=?")
        values.append(event.frame_path)
    if event.enable_filters is not None:
        updates.append("enable_filters=?")
        values.append(event.enable_filters)
    if event.retake_limit is not None:
        updates.append("retake_limit=?")
        values.append(event.retake_limit)
    if event.qr_bg_color is not None:
        updates.append("qr_bg_color=?")
        values.append(event.qr_bg_color)
    if event.qr_fg_color is not None:
        updates.append("qr_fg_color=?")
        values.append(event.qr_fg_color)
    if event.enable_gesture_capture is not None:
        updates.append("enable_gesture_capture=?")
        values.append(event.enable_gesture_capture)
    if event.gen_failsafe_enabled is not None:
        updates.append("gen_failsafe_enabled=?")
        values.append(event.gen_failsafe_enabled)
    if event.gen_failsafe_timeout is not None:
        updates.append("gen_failsafe_timeout=?")
        values.append(event.gen_failsafe_timeout)

    if not updates:
        return {"status": "ok"}

    values.append(event_id)
    with get_db() as db:
        db.execute(f"UPDATE events SET {', '.join(updates)} WHERE id=?", tuple(values))
    return {"status": "ok"}

@router.delete("/{event_id}")
def delete_event(event_id: str):
    with get_db() as db:
        db.execute("DELETE FROM events WHERE id=?", (event_id,))
    return {"status": "ok"}

@router.post("/{event_id}/logo")
def upload_event_logo(event_id: str, image: UploadFile = File(...)):
    event_dir = Path(settings.upload_dir).parent / "events" / event_id
    event_dir.mkdir(parents=True, exist_ok=True)
    logo_path = event_dir / f"logo_{uuid_file_part()}{Path(image.filename).suffix}"
    with open(logo_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    with get_db() as db:
        db.execute("UPDATE events SET logo_path=? WHERE id=?", (str(logo_path), event_id))
    return {"status": "ok", "logo_path": str(logo_path)}

@router.post("/{event_id}/frame")
def upload_event_frame(event_id: str, image: UploadFile = File(...)):
    event_dir = Path(settings.upload_dir).parent / "events" / event_id
    event_dir.mkdir(parents=True, exist_ok=True)
    frame_path = event_dir / f"frame_{uuid_file_part()}{Path(image.filename).suffix}"
    with open(frame_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)
    
    with get_db() as db:
        db.execute("UPDATE events SET frame_path=? WHERE id=?", (str(frame_path), event_id))
    return {"status": "ok", "frame_path": str(frame_path)}

@router.get("/{event_id}/logo")
def get_event_logo(event_id: str):
    with get_db() as db:
        row = db.execute("SELECT logo_path FROM events WHERE id=?", (event_id,)).fetchone()
        if row and row["logo_path"] and os.path.exists(row["logo_path"]):
            return FileResponse(row["logo_path"])
    raise HTTPException(404, "Logo not found")

@router.get("/{event_id}/frame")
def get_event_frame(event_id: str):
    with get_db() as db:
        row = db.execute("SELECT frame_path FROM events WHERE id=?", (event_id,)).fetchone()
        if row and row["frame_path"] and os.path.exists(row["frame_path"]):
            return FileResponse(row["frame_path"])
    raise HTTPException(404, "Frame not found")

def uuid_file_part():
    import uuid
    return uuid.uuid4().hex[:8]
