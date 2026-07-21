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
        CREATE TABLE IF NOT EXISTS transitions (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            duration INTEGER DEFAULT 1400,
            css_code TEXT DEFAULT '',
            active INTEGER DEFAULT 1,
            is_favorite INTEGER DEFAULT 0,
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
        conn.execute("ALTER TABLE transitions ADD COLUMN is_favorite INTEGER DEFAULT 0")
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
        "qr_fg_color TEXT DEFAULT '#000000'",
        "enable_gesture_capture INTEGER DEFAULT 1"
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


def seed_transitions():
    with get_db() as db:
        transitions = [
            {
                "id": "glitch",
                "name": "Glitch (故障風)",
                "duration": 1400,
                "css_code": """.transition-glitch-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #111;
  animation: screen-glitch-shake-custom 1.4s forwards ease-in-out;
}
@keyframes screen-glitch-shake-custom {
  0%, 100% { transform: translate(0) scale(1); opacity: 1; }
  10% { transform: translate(-4px, 4px) skew(-2deg); opacity: 0.9; }
  20% { transform: translate(4px, -4px) skew(3deg); opacity: 0.8; }
  35% { transform: translate(-3px, -2px) skew(-3deg); opacity: 0.95; }
  50% { transform: translate(3px, 3px) skew(2deg); opacity: 0.7; }
  70% { transform: translate(-5px, 2px) skew(-1deg); opacity: 0.9; }
  90% { transform: translate(0) scale(1.05); opacity: 0.4; }
  100% { transform: translate(0) scale(1); opacity: 0; }
}"""
            },
            {
                "id": "flash",
                "name": "Flash & Burn (閃光)",
                "duration": 1680,
                "css_code": """.transition-flash-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #fff;
  animation: flash-burn-custom 1.68s forwards cubic-bezier(0.1, 0.8, 0.3, 1);
}
@keyframes flash-burn-custom {
  0% { opacity: 1; background: #fff; }
  30% { opacity: 1; background: #ffaa44; filter: brightness(1.5); }
  100% { opacity: 0; background: transparent; }
}"""
            },
            {
                "id": "swipe",
                "name": "Laser Swipe (雷射)",
                "duration": 1960,
                "css_code": """.transition-swipe-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: rgba(0,0,0,0.8);
  overflow: hidden;
  animation: fade-out-bg-custom 1.96s forwards;
}
.transition-swipe-custom::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  height: 4px;
  background: #667eea;
  box-shadow: 0 0 15px #764ba2, 0 0 30px #667eea;
  animation: laser-swipe-custom 1.96s forwards linear;
}
@keyframes laser-swipe-custom {
  0% { top: 0%; opacity: 1; }
  90% { top: 100%; opacity: 1; }
  100% { top: 100%; opacity: 0; }
}
@keyframes fade-out-bg-custom {
  0% { background: rgba(0,0,0,0.8); }
  90% { background: rgba(0,0,0,0.8); }
  100% { background: transparent; }
}"""
            },
            {
                "id": "zoom",
                "name": "Zoom Reveal (縮放)",
                "duration": 1680,
                "css_code": """.transition-zoom-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: #000;
  animation: zoom-reveal-custom 1.68s forwards cubic-bezier(0.25, 1, 0.5, 1);
}
@keyframes zoom-reveal-custom {
  0% { transform: scale(1.5); opacity: 1; background: #000; }
  50% { transform: scale(1.1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; background: transparent; }
}"""
            },
            {
                "id": "chromatic-radial-split",
                "name": "Chromatic Radial Split (分色雷射)",
                "duration": 2100,
                "css_code": """.transition-chromatic-radial-split-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: transparent;
  pointer-events: none;
  overflow: hidden;
}
.transition-chromatic-radial-split-custom::before,
.transition-chromatic-radial-split-custom::after {
  content: "";
  position: absolute;
  inset: 0;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  mix-blend-mode: screen;
  animation-duration: 2.1s;
  animation-fill-mode: forwards;
  animation-timing-function: ease-out;
}
.transition-chromatic-radial-split-custom::before {
  animation-name: radial-split-red-custom;
}
.transition-chromatic-radial-split-custom::after {
  animation-name: radial-split-cyan-custom;
}
@keyframes radial-split-red-custom {
  0% { transform: scale(1); clip-path: circle(0% at 50% 50%); opacity: 1; }
  40% { transform: scale(1.05) translate(-6px, -4px); clip-path: circle(50% at 50% 50%); opacity: 1; }
  100% { transform: scale(1.2) translate(-15px, -10px); clip-path: circle(120% at 50% 50%); opacity: 0; }
}
@keyframes radial-split-cyan-custom {
  0% { transform: scale(1); clip-path: circle(0% at 50% 50%); opacity: 1; }
  40% { transform: scale(1.03) translate(6px, 4px); clip-path: circle(50% at 50% 50%); opacity: 1; }
  100% { transform: scale(1.15) translate(15px, 10px); clip-path: circle(120% at 50% 50%); opacity: 0; }
}"""
            },
            {
                "id": "cube-3d",
                "name": "3D Cube Flip (3D 立方體)",
                "duration": 2100,
                "css_code": """.transition-cube-3d-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  transform-origin: right center;
  animation: cube-flip-custom 2.1s forwards cubic-bezier(0.55, 0.055, 0.675, 0.19);
}
@keyframes cube-flip-custom {
  0% { transform: perspective(1000px) rotateY(0deg) translateZ(0); opacity: 1; }
  100% { transform: perspective(1000px) rotateY(-90deg) translateZ(-200px); opacity: 0; }
}"""
            },
            {
                "id": "card-flip",
                "name": "3D Card Flip (3D 翻牌)",
                "duration": 1680,
                "css_code": """.transition-card-flip-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  backface-visibility: hidden;
  animation: card-flip-anim-custom 1.68s forwards ease-in-out;
}
@keyframes card-flip-anim-custom {
  0% { transform: perspective(1000px) rotateY(0deg); opacity: 1; }
  50% { transform: perspective(1000px) rotateY(90deg); opacity: 0.5; }
  100% { transform: perspective(1000px) rotateY(180deg); opacity: 0; }
}"""
            },
            {
                "id": "door-3d",
                "name": "3D Swing Doors (3D 開門)",
                "duration": 2100,
                "css_code": """.transition-door-3d-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background: transparent;
  pointer-events: none;
}
.transition-door-3d-custom::before,
.transition-door-3d-custom::after {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50%;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: 200% 100%;
  animation-duration: 2.1s;
  animation-fill-mode: forwards;
  animation-timing-function: cubic-bezier(0.7, 0, 0.3, 1);
}
.transition-door-3d-custom::before {
  left: 0;
  background-position: left center;
  transform-origin: left center;
  animation-name: door-open-left-custom;
}
.transition-door-3d-custom::after {
  right: 0;
  background-position: right center;
  transform-origin: right center;
  animation-name: door-open-right-custom;
}
@keyframes door-open-left-custom {
  0% { transform: perspective(1000px) rotateY(0deg); }
  100% { transform: perspective(1000px) rotateY(-90deg); opacity: 0; }
}
@keyframes door-open-right-custom {
  0% { transform: perspective(1000px) rotateY(0deg); }
  100% { transform: perspective(1000px) rotateY(90deg); opacity: 0; }
}"""
            },
            {
                "id": "fly-3d",
                "name": "3D Fly & Spin (3D 旋轉飛出)",
                "duration": 1960,
                "css_code": """.transition-fly-3d-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  animation: fly-spin-custom 1.96s forwards cubic-bezier(0.25, 1, 0.5, 1);
}
@keyframes fly-spin-custom {
  0% { transform: perspective(1000px) scale(1) rotate(0deg) translateZ(0); opacity: 1; filter: blur(0); }
  30% { transform: perspective(1000px) scale(0.85) rotate(-5deg) translateZ(-50px); opacity: 0.9; filter: blur(2px); }
  100% { transform: perspective(1000px) scale(0.1) rotate(180deg) translateZ(-800px); opacity: 0; filter: blur(8px); }
}"""
            },
            {
                "id": "liquid-distort",
                "name": "Liquid Distortion (液態波紋)",
                "duration": 2100,
                "css_code": """.transition-liquid-distort-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  animation: liquid-warp-custom 2.1s forwards ease-in-out;
}
@keyframes liquid-warp-custom {
  0% { transform: scale(1); border-radius: 0%; opacity: 1; }
  35% { transform: scale(1.1) skewX(8deg) skewY(-4deg); border-radius: 40% 60% 70% 30% / 40% 50% 60% 50%; opacity: 0.9; }
  70% { transform: scale(1.25) skewX(-6deg) skewY(6deg); border-radius: 70% 30% 30% 70% / 50% 60% 40% 50%; opacity: 0.6; }
  100% { transform: scale(1.4) skewX(0) skewY(0); border-radius: 50%; opacity: 0; }
}"""
            },
            {
                "id": "tv-static",
                "name": "CRT TV Shutdown (電視關機)",
                "duration": 1680,
                "css_code": """.transition-tv-static-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  animation: tv-shutdown-custom 1.68s forwards ease-in-out;
}
.transition-tv-static-custom::after {
  content: "";
  position: absolute;
  inset: 0;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,0.08), rgba(255,255,255,0.08) 1px, transparent 1px, transparent 2px);
}
@keyframes tv-shutdown-custom {
  0% { transform: scaleY(1) scaleX(1); filter: brightness(1); opacity: 1; }
  50% { transform: scaleY(0.015) scaleX(1); background-color: #fff; filter: brightness(2.5); opacity: 1; }
  80% { transform: scaleY(0.015) scaleX(0.015); background-color: #fff; filter: brightness(5); opacity: 1; }
  100% { transform: scaleY(0) scaleX(0); opacity: 0; }
}"""
            },
            {
                "id": "mosaic-wipe",
                "name": "Mosaic Polygon (馬賽克折紙)",
                "duration": 1960,
                "css_code": """.transition-mosaic-wipe-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  animation: mosaic-reveal-anim-custom 1.96s forwards cubic-bezier(0.4, 0, 0.2, 1);
}
@keyframes mosaic-reveal-anim-custom {
  0% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); opacity: 1; }
  35% { clip-path: polygon(15% 15%, 85% 5%, 95% 85%, 5% 95%); filter: brightness(1.3); opacity: 0.9; }
  70% { clip-path: polygon(35% 35%, 65% 25%, 75% 75%, 25% 75%); filter: brightness(1.6); opacity: 0.6; }
  100% { clip-path: polygon(50% 50%, 50% 50%, 50% 50%, 50% 50%); opacity: 0; }
}"""
            },
            {
                "id": "page-curl",
                "name": "3D Page Curl (3D 翻頁)",
                "duration": 2100,
                "css_code": """.transition-page-curl-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  transform-origin: left center;
  animation: page-curl-anim-custom 2.1s forwards cubic-bezier(0.25, 1, 0.5, 1);
}
@keyframes page-curl-anim-custom {
  0% { transform: perspective(1200px) rotateY(0deg) skewY(0deg); opacity: 1; }
  100% { transform: perspective(1200px) rotateY(-110deg) skewY(-10deg) translateX(-100px); opacity: 0; }
}"""
            },
            {
                "id": "star-wipe",
                "name": "Retro Star Wipe (經典星星擦除)",
                "duration": 1820,
                "css_code": """.transition-star-wipe-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  animation: star-wipe-anim-custom 1.82s forwards ease-in-out;
}
@keyframes star-wipe-anim-custom {
  0% { clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); opacity: 1; transform: scale(5); }
  100% { clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); opacity: 0; transform: scale(0); }
}"""
            },
            {
                "id": "diamond-wipe",
                "name": "Diamond Iris Wipe (菱形鏡頭擦除)",
                "duration": 1680,
                "css_code": """.transition-diamond-wipe-custom {
  position: fixed;
  inset: 0;
  z-index: 99999;
  background-image: var(--transition-before-img, url('/img/placeholder_before.jpg'));
  background-size: cover;
  background-position: center;
  animation: diamond-wipe-anim-custom 1.68s forwards ease-in-out;
}
@keyframes diamond-wipe-anim-custom {
  0% { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); opacity: 1; transform: scale(3); }
  100% { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); opacity: 0; transform: scale(0); }
}"""
            }
        ]
        for t in transitions:
            db.execute(
                "INSERT OR IGNORE INTO transitions (id, name, duration, css_code, active) VALUES (?,?,?,?,1)",
                (t["id"], t["name"], t["duration"], t["css_code"])
            )
            db.execute(
                "UPDATE transitions SET duration = ?, css_code = ? WHERE id = ?",
                (t["duration"], t["css_code"], t["id"])
            )
