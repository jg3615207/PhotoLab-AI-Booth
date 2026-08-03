import os, json, uuid, time
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image
import qrcode

from app.config import settings
from app.db import get_db
from app.services.frames import upscale_image, compose_print_frame
from app.services.filters import apply_filter_file
from app.api.ws import broadcast_job_update

PUBLIC_BASE_URL = settings.public_base_url if settings.public_base_url else "http://localhost:8000"


def run_normal_pipeline(job_id: str, style_id: str, image_path: str):
    """Run the Normal (No AI) photo booth processing pipeline.

    Bypasses AI generation completely. Applies optional photo filters,
    composite decorative frames/watermarks/logos, generates QR codes,
    saves local copies, and enqueues print jobs.
    """
    output_dir = Path(settings.output_dir) / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    with get_db() as db:
        db.execute("UPDATE sessions SET status='processing' WHERE job_id=?", (job_id,))
        broadcast_job_update(job_id, "processing")

        style_row = db.execute(
            "SELECT id, filter_preset, filter_params, layout_type FROM styles WHERE id=?",
            (style_id,)
        ).fetchone()

        filter_preset = style_row["filter_preset"] if style_row and style_row["filter_preset"] else "none"
        filter_params = style_row["filter_params"] if style_row and style_row["filter_params"] else "{}"

    # Step 1: Apply Photo Filter
    filtered_path = str(output_dir / "filtered.jpg")
    try:
        apply_filter_file(image_path, filtered_path, filter_preset, filter_params=filter_params)
    except Exception as e:
        print(f"[normal_pipeline] Filter error: {e}, falling back to original")
        filtered_path = image_path

    # Step 2: Upscale / fit to standard 1200x1800 resolution
    upscaled_path = str(output_dir / "upscaled.jpg")
    upscale_image(filtered_path, upscaled_path, target_size=(1200, 1800))

    # Step 3: Frame, Logo, Watermark Compositing
    frame_img = None
    logo_path = None
    watermark_text = None
    watermark_pos = 'bottom-right'
    watermark_op = 0.5
    allow_auto_print = 1

    with get_db() as db:
        sess = db.execute("SELECT event_id FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        event_id = sess["event_id"] if sess else None

    if event_id:
        with get_db() as db:
            event = db.execute(
                "SELECT frame_path, logo_path, watermark_text, watermark_position, watermark_opacity, allow_auto_print FROM events WHERE id=?",
                (event_id,)
            ).fetchone()
            if event:
                if event["frame_path"] and os.path.exists(event["frame_path"]):
                    frame_img = event["frame_path"]
                if "logo_path" in event.keys() and event["logo_path"] and os.path.exists(event["logo_path"]):
                    logo_path = event["logo_path"]
                if "watermark_text" in event.keys() and event["watermark_text"]:
                    watermark_text = event["watermark_text"]
                    watermark_pos = event["watermark_position"] or 'bottom-right'
                    watermark_op = float(event["watermark_opacity"] or 0.5)
                if "allow_auto_print" in event.keys() and event["allow_auto_print"] is not None:
                    allow_auto_print = int(event["allow_auto_print"])

    if not frame_img:
        style_frame = str(Path(settings.upload_dir).parent.parent / "styles" / style_id / "frame.png")
        if os.path.exists(style_frame):
            frame_img = style_frame

    print_path = str(output_dir / "print_ready.jpg")
    framed_path = str(output_dir / "framed.jpg")

    compose_print_frame(
        upscaled_path if os.path.exists(upscaled_path) else filtered_path,
        print_path,
        frame_path=frame_img,
        target_size=(1200, 1800),
        watermark_text=watermark_text,
        watermark_position=watermark_pos,
        watermark_opacity=watermark_op,
        logo_path=logo_path
    )
    
    # Save a copy as framed.jpg as well for consistency
    import shutil
    shutil.copy2(print_path, framed_path)

    # Save meta.json metadata file
    meta_dict = {
        "job_id": job_id,
        "style_id": style_id,
        "booth_mode": "normal",
        "filter_preset": filter_preset,
        "cost_time_ms": 0,
        "cost_money_usd": 0.0,
        "created_at": datetime.now(timezone.utc).astimezone().isoformat()
    }
    meta_file = output_dir / "meta.json"
    with open(meta_file, "w", encoding="utf-8") as f:
        json.dump(meta_dict, f, ensure_ascii=False, indent=2)

    # Step 4: Update Session Status to Done
    with get_db() as db:
        db.execute(
            "UPDATE sessions SET status='done', output_image=?, print_image=?, cost_time=0, cost_money=0, updated_at=datetime('now') WHERE job_id=?",
            (filtered_path, print_path, job_id),
        )
    broadcast_job_update(job_id, "done", output_image=filtered_path)

    # Step 5: Auto-Print
    if allow_auto_print:
        with get_db() as db:
            sess_check = db.execute("SELECT capture_source FROM sessions WHERE job_id=?", (job_id,)).fetchone()
            if sess_check and sess_check["capture_source"] == "test":
                allow_auto_print = 0

    if allow_auto_print:
        from app.services.printing import enqueue_print
        enqueue_print(print_path, copies=1, session_id=job_id)
        print(f"[normal_pipeline] Auto-print is ON. Enqueued print job for session {job_id}.")

    # Step 6: Save local backup copy if configured
    try:
        from app.db import get_setting
        local_dir_setting = get_setting("local_save_dir", "")
        if local_dir_setting:
            target_base = Path(local_dir_setting)
            session_folder = event_id if event_id else "default"
            target_dir = target_base / session_folder
            target_dir.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now(timezone.utc).astimezone().strftime("%Y%m%d_%H%M%S")
            target_filename_jpg = f"{timestamp}_{style_id}_{job_id}.jpg"
            target_path_jpg = target_dir / target_filename_jpg

            shutil.copy2(print_path, target_path_jpg)

            # 2. Save untouched processed photo into RAW/ subfolder
            if filtered_path and os.path.exists(filtered_path):
                raw_dir = target_dir / "RAW"
                raw_dir.mkdir(parents=True, exist_ok=True)
                raw_filename_jpg = f"{timestamp}_{style_id}_{job_id}_raw.jpg"
                shutil.copy2(filtered_path, raw_dir / raw_filename_jpg)
                print(f"Successfully saved untouched RAW copy to {raw_dir / raw_filename_jpg}")

            # 3. Save original guest camera input photo into INPUT/ subfolder
            if image_path and os.path.exists(image_path):
                input_dir = target_dir / "INPUT"
                input_dir.mkdir(parents=True, exist_ok=True)
                input_filename_jpg = f"{timestamp}_{style_id}_{job_id}_input.jpg"
                shutil.copy2(image_path, input_dir / input_filename_jpg)
                print(f"Successfully saved original camera INPUT copy to {input_dir / input_filename_jpg}")
    except Exception as e:
        print(f"[normal_pipeline] Local save error: {e}")

    # Step 7: QR Code Generation
    try:
        result_url = f"{PUBLIC_BASE_URL}/download/{job_id}"
        qr_bg = "white"
        qr_fg = "black"
        if event_id:
            with get_db() as db:
                ev = db.execute("SELECT qr_bg_color, qr_fg_color FROM events WHERE id=?", (event_id,)).fetchone()
                if ev:
                    qr_bg = ev["qr_bg_color"] or "white"
                    qr_fg = ev["qr_fg_color"] or "black"

        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(result_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color=qr_fg, back_color=qr_bg)
        qr_path = str(output_dir / "qr.png")
        qr_img.save(qr_path)
        with get_db() as db:
            db.execute("UPDATE sessions SET qr_code=? WHERE job_id=?", (qr_path, job_id))
    except Exception as e:
        print(f"[normal_pipeline] QR generation error: {e}")
