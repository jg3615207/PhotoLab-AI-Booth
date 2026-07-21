import sqlite3, json, threading
from pathlib import Path
from datetime import datetime, timezone
from contextlib import contextmanager
from app.config import settings

_local = threading.local()

def get_conn() -> sqlite3.Connection:
    if not hasattr(_local, "conn") or _local.conn is None:
        _local.conn = sqlite3.connect(settings.db_path, timeout=60.0)
        _local.conn.row_factory = sqlite3.Row
        _local.conn.execute("PRAGMA journal_mode=WAL")
        _local.conn.execute("PRAGMA busy_timeout=60000")
        _local.conn.execute("PRAGMA foreign_keys=ON")
    return _local.conn

@contextmanager
def get_db():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise

def init_db():
    Path(settings.db_path).parent.mkdir(parents=True, exist_ok=True)
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS styles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            max_people INTEGER DEFAULT 1,
            aspect_ratio TEXT DEFAULT '2:3',
            prompt_template TEXT DEFAULT '',
            style_ref TEXT DEFAULT '',
            thumbnail TEXT DEFAULT '',
            print_frame TEXT DEFAULT '',
            rh_ref_file TEXT DEFAULT '',
            rh_ref_url TEXT DEFAULT '',
            provider TEXT DEFAULT 'v1',
            v2_model TEXT DEFAULT 'nb2-cheap',
            v2_quality TEXT,
            seed TEXT DEFAULT '',
            resolution TEXT DEFAULT '2k',
            workflows TEXT DEFAULT '{}',
            transition_type TEXT DEFAULT 'glitch',
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id TEXT UNIQUE,
            style_id TEXT,
            status TEXT DEFAULT 'created',
            capture_source TEXT DEFAULT 'webcam',
            input_image TEXT,
            ref_image TEXT,
            output_image TEXT,
            print_image TEXT,
            print_status TEXT DEFAULT 'none',
            qr_code TEXT,
            error_message TEXT,
            cost_time INTEGER DEFAULT 0,
            cost_money REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS print_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            image_path TEXT,
            copies INTEGER DEFAULT 1,
            status TEXT DEFAULT 'queued',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            allowed_styles TEXT DEFAULT '[]',
            allow_auto_print INTEGER DEFAULT 1,
            logo_path TEXT DEFAULT '',
            event_name_overlay TEXT DEFAULT '',
            frame_cap INTEGER DEFAULT 0,
            expire_date TEXT DEFAULT '',
            active INTEGER DEFAULT 1,
            frame_path TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS style_tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            style_id TEXT,
            input_image TEXT,
            ref_image TEXT,
            output_image TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    # Migration: add v2_model and v2_quality columns (v0.4.0)
    try:
        conn.execute("ALTER TABLE styles ADD COLUMN v2_model TEXT DEFAULT 'nb2-cheap'")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE styles ADD COLUMN v2_quality TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE sessions ADD COLUMN event_id TEXT")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE styles ADD COLUMN transition_type TEXT DEFAULT 'glitch'")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE events ADD COLUMN frame_path TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE styles ADD COLUMN sort_order INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    try:
        conn.execute("ALTER TABLE events ADD COLUMN archived INTEGER DEFAULT 0")
    except sqlite3.OperationalError:
        pass
    
    # New columns for Comprehensive Upgrade
    for col in [
        "enable_filters INTEGER DEFAULT 0",
        "retake_limit INTEGER DEFAULT 3",
        "qr_bg_color TEXT DEFAULT '#ffffff'",
        "qr_fg_color TEXT DEFAULT '#000000'"
    ]:
        try:
            conn.execute(f"ALTER TABLE events ADD COLUMN {col}")
        except sqlite3.OperationalError:
            pass

    for col in [
        "animated_thumbnail TEXT DEFAULT ''",
        "dynamic_prompt_enabled INTEGER DEFAULT 0"
    ]:
        try:
            conn.execute(f"ALTER TABLE styles ADD COLUMN {col}")
        except sqlite3.OperationalError:
            pass
    # Backfill existing v2 styles to default model
    conn.execute("UPDATE styles SET v2_model='nb2-cheap' WHERE provider='v2' AND v2_model IS NULL")

    conn.commit()

def seed_styles():
    with get_db() as db:
        existing = db.execute("SELECT COUNT(*) FROM styles").fetchone()[0]
        if existing > 0:
            return
        styles = [
            {"id": "ghibli-dream", "name": "Ghibli Dream", "max_people": 1, "prompt_template": "Studio Ghibli anime style, soft pastels, whimsical, magical atmosphere. Transform ONLY the person from the guest photo into this style. Do NOT add extra people. Use the reference image ONLY for style/colors — ignore any people in it.", "rh_ref_file": "api/d98407626a464e5da871f29b8796d37e712b7c7afbf1d5d253e0fe42608c8f43.jpg"},
            {"id": "oil-portrait", "name": "Oil Portrait", "max_people": 1, "prompt_template": "Oil painting, Renaissance classical portrait, rich textures, dramatic lighting. Paint ONLY the person from the guest photo. Keep the exact number of people from the input. Reference image is for style only — ignore its content.", "rh_ref_file": "api/dd1650205ba05bbc0b9f86e2df3891af3393d4f1d34045694f0c7995f92b4d1b.jpg"},
            {"id": "cyberpunk-neon", "name": "Cyberpunk Neon", "max_people": 4, "prompt_template": "Cyberpunk, neon lights reflecting on rain-soaked streets, futuristic city, vibrant purple and cyan. Transform the person/people from the guest photo into this style. Do NOT add people from the reference image. Reference is for atmosphere/lighting only.", "rh_ref_file": "api/d01ebaaccd4d7b987808fab53e9e6e7a6851dc9b4a3a8c9d5aa4fcf1a21e7f92.jpg"},
        ]
        for s in styles:
            wf = json.dumps({"workflow_id": settings.rh_workflow_id, "input_nodes": {"image": "2", "style_ref": "3", "prompt": "1"}})
            db.execute("INSERT OR IGNORE INTO styles (id, name, max_people, prompt_template, rh_ref_file, workflows) VALUES (?,?,?,?,?,?)",
                       (s["id"], s["name"], s["max_people"], s["prompt_template"], s["rh_ref_file"], wf))


def get_setting(key: str, default: str = None) -> str:
    try:
        conn = get_conn()
        row = conn.execute("SELECT value FROM app_settings WHERE key=?", (key,)).fetchone()
        if row:
            return row["value"]
    except Exception:
        pass
    return default


def set_setting(key: str, value: str):
    conn = get_conn()
    conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?,?)", (key, value))
    conn.commit()
