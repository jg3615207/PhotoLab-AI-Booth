from fastapi import APIRouter, Form, HTTPException, Response
from pydantic import BaseModel
from app.db import get_db

router = APIRouter(prefix="/api/admin/transitions", tags=["transitions"])

# Public router for serving transition CSS and listing transition IDs
public_router = APIRouter(prefix="/api/transitions", tags=["transitions_public"])

@router.get("")
def list_transitions():
    with get_db() as db:
        rows = db.execute("SELECT * FROM transitions ORDER BY is_favorite DESC, created_at DESC").fetchall()
        return [dict(r) for r in rows]

@router.post("")
def create_transition(
    id: str = Form(...),
    name: str = Form(...),
    duration: int = Form(1400),
    css_code: str = Form(""),
    is_favorite: int = Form(0),
):
    id_clean = id.strip().lower()
    if not id_clean:
        raise HTTPException(400, "Invalid transition ID")
    with get_db() as db:
        existing = db.execute("SELECT id FROM transitions WHERE id=?", (id_clean,)).fetchone()
        if existing:
            raise HTTPException(400, "Transition ID already exists")
        db.execute(
            "INSERT INTO transitions (id, name, duration, css_code, active, is_favorite) VALUES (?,?,?,?,1,?)",
            (id_clean, name, duration, css_code, is_favorite),
        )
    return {"status": "created", "id": id_clean}

@router.put("/{tid}")
def update_transition(
    tid: str,
    name: str = Form(...),
    duration: int = Form(1400),
    css_code: str = Form(""),
    active: int = Form(1),
    is_favorite: int = Form(0),
):
    with get_db() as db:
        row = db.execute("SELECT id FROM transitions WHERE id=?", (tid,)).fetchone()
        if not row:
            raise HTTPException(404, "Transition not found")
        db.execute(
            "UPDATE transitions SET name=?, duration=?, css_code=?, active=?, is_favorite=? WHERE id=?",
            (name, duration, css_code, active, is_favorite, tid),
        )
    return {"status": "updated"}

@router.post("/{tid}/favorite")
def toggle_favorite(tid: str, is_favorite: int = Form(...)):
    with get_db() as db:
        row = db.execute("SELECT id FROM transitions WHERE id=?", (tid,)).fetchone()
        if not row:
            raise HTTPException(404, "Transition not found")
        db.execute("UPDATE transitions SET is_favorite=? WHERE id=?", (is_favorite, tid))
    return {"status": "success", "is_favorite": is_favorite}

@router.delete("/{tid}")
def delete_transition(tid: str):
    if tid in ["glitch", "flash", "swipe", "zoom"]:
        raise HTTPException(400, "Cannot delete built-in transition")
    with get_db() as db:
        row = db.execute("SELECT id FROM transitions WHERE id=?", (tid,)).fetchone()
        if not row:
            raise HTTPException(404, "Transition not found")
        db.execute("DELETE FROM transitions WHERE id=?", (tid,))
    return {"status": "deleted"}

@public_router.get("/css")
def get_transitions_css():
    with get_db() as db:
        rows = db.execute("SELECT css_code FROM transitions WHERE active=1").fetchall()
        css = "\n\n".join(r["css_code"] for r in rows if r["css_code"])
        return Response(content=css, media_type="text/css")

@public_router.get("/list")
def get_public_transitions():
    with get_db() as db:
        rows = db.execute("SELECT id, name, duration, is_favorite FROM transitions WHERE active=1 ORDER BY is_favorite DESC, name ASC").fetchall()
        return [dict(r) for r in rows]

