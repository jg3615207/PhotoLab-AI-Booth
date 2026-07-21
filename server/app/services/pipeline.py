import os, json, uuid, time, threading
from pathlib import Path
from datetime import datetime, timezone
from PIL import Image
import qrcode

from app.config import settings
from app.db import get_db
from app.providers.runninghub import RunningHubProvider
from app.providers.runninghub_v2 import RunningHubV2Provider
from app.services.frames import download_image, upscale_image, compose_print_frame
from app.api.ws import broadcast_job_update

PUBLIC_BASE_URL = "https://math-univ-current-statewide.trycloudflare.com"

provider_v1 = RunningHubProvider()
provider_v2 = RunningHubV2Provider()

# ------------------------------------------------------------------
# Race state for generation failsafe: keyed by primary job_id
# Each entry: {"done": threading.Event, "winner": str | None, "cancelled": set}
# ------------------------------------------------------------------
_race_lock = threading.Lock()
_race_state: dict[str, dict] = {}



import base64, httpx, io
def get_dynamic_prompt(image_path: str) -> str:
    from app.db import get_setting
    api_key = get_setting("openai_api_key", settings.openai_api_key)
    base_url = get_setting("openai_base_url", settings.openai_base_url)
    if not api_key:
        return ""
    try:
        pil_img = Image.open(image_path).convert("RGB")
        max_dim = 1024
        if max(pil_img.size) > max_dim:
            ratio = max_dim / max(pil_img.size)
            pil_img = pil_img.resize((int(pil_img.size[0] * ratio), int(pil_img.size[1] * ratio)), Image.LANCZOS)
        buf = io.BytesIO()
        pil_img.save(buf, format="JPEG", quality=85)
        base64_image = base64.b64encode(buf.getvalue()).decode('utf-8')
        vision_prompt = (
            "Analyze this photo of a person. Describe ONLY their clothing, outfit, colors of their clothes, "
            "and their physical pose (e.g., standing with arms crossed, waving, giving a thumbs up). "
            "Keep it extremely concise, under 20 words. Output nothing but the description."
        )
        r = httpx.post(
            f"{base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "mimo-v2.5-free",
                "messages": [
                    {"role": "user", "content": [
                        {"type": "text", "text": vision_prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]}
                ],
                "max_tokens": 100,
                "temperature": 0.5
            },
            timeout=15.0
        )
        if r.status_code == 200:
            return r.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"Vision API error: {e}")
    return ""

def run_pipeline(job_id: str, style_id: str, image_path: str, style_ref_path: str | None = None,
                 prompt_override: str = None, model_override: str = None,
                 resolution_override: str = None, quality_override: str = None,
                 aspect_override: str = None, seed_override: str = None,
                 primary_job_id: str = None):
    """Run the AI generation pipeline for a job.

    Args:
        primary_job_id: When set, this job is a failsafe retry. Results are
                        broadcast under primary_job_id if this job wins the race.
    """
    # Check if this job has already been cancelled by the race coordinator
    _primary = primary_job_id or job_id
    with _race_lock:
        state = _race_state.get(_primary)
        if state and job_id in state.get("cancelled", set()):
            print(f"[failsafe] Job {job_id} was already cancelled before starting. Skipping.")
            return

    with get_db() as db:
        row = db.execute(
            "SELECT prompt_template, aspect_ratio, resolution, seed, rh_ref_file, rh_ref_url, provider, v2_model, v2_quality, dynamic_prompt_enabled FROM styles WHERE id=?",
            (style_id,),
        ).fetchone()
        if not row:
            db.execute("UPDATE sessions SET status='failed', error_message='Style not found', updated_at=datetime('now') WHERE job_id=?", (job_id,))
            broadcast_job_update(job_id, "failed", error_message="Style not found")
            return
        prompt = row["prompt_template"] or "keep faces identical, beautiful style"
        if prompt_override:
            prompt = prompt_override
        aspect = row["aspect_ratio"] or "2:3"
        if aspect_override:
            aspect = aspect_override
        resolution = row["resolution"] or "2k"
        if resolution_override:
            resolution = resolution_override
        seed_val = int(row["seed"]) if row["seed"] and row["seed"].isdigit() else None
        if seed_override and seed_override.isdigit():
            seed_val = int(seed_override)
        rh_ref_file = row["rh_ref_file"]
        rh_ref_url = row["rh_ref_url"]
        use_v2 = row["provider"] == "v2"
        v2_model = row["v2_model"] or "nb2-cheap"
        if model_override:
            v2_model = model_override
        v2_quality = row["v2_quality"] or None
        
        dynamic_prompt = row.keys() and "dynamic_prompt_enabled" in row.keys() and row["dynamic_prompt_enabled"] == 1
        # In sqlite.Row, checking keys might be tricky. Let's just use try-except or check.
        try:
            dynamic_prompt = row["dynamic_prompt_enabled"] == 1
        except:
            dynamic_prompt = False
            
        if dynamic_prompt and not prompt_override:
            broadcast_job_update(job_id, "processing", error_message="Analyzing guest posture for dynamic prompt...")
            dynamic_desc = get_dynamic_prompt(image_path)
            if dynamic_desc:
                prompt = f"{prompt}, wearing {dynamic_desc}"
                print(f"Dynamically injected prompt: {prompt}")

        if quality_override:
            v2_quality = quality_override

        # v2: upload local style ref image if URL not yet cached
        if use_v2 and not rh_ref_url:
            ref_path = Path(__file__).parent.parent.parent / "styles" / style_id / "ref.jpg"
            if ref_path.exists():
                try:
                    v2_url = provider_v2.upload_image(str(ref_path))
                    db.execute("UPDATE styles SET rh_ref_url=? WHERE id=?", (v2_url, style_id))
                    rh_ref_url = v2_url
                except Exception:
                    pass  # will fall back to v1 below

        # Update status
        db.execute("UPDATE sessions SET status='processing' WHERE job_id=?", (job_id,))
        broadcast_job_update(job_id, "processing")

    try:
        if use_v2 and rh_ref_url:
            result = provider_v2.generate(
                guest_image_path=image_path,
                rh_ref_file=rh_ref_url,  # v2 uses public URL
                prompt=prompt,
                seed=seed_val,
                resolution=resolution,
                aspect_ratio=aspect,
                v2_model=v2_model,
                v2_quality=v2_quality,
            )
        elif use_v2:
            import logging
            logging.getLogger(__name__).warning(
                "v2 provider for style '%s' has no rh_ref_url; falling back to v1", style_id
            )
            result = provider_v1.generate(
                guest_image_path=image_path,
                rh_ref_file=rh_ref_file,
                prompt=prompt,
                seed=seed_val,
                resolution=resolution,
                aspect_ratio=aspect,
            )
        else:
            result = provider_v1.generate(
                guest_image_path=image_path,
                rh_ref_file=rh_ref_file,
                prompt=prompt,
                seed=seed_val,
                resolution=resolution,
                aspect_ratio=aspect,
            )
    except Exception as e:
        with get_db() as db:
            db.execute(
                "UPDATE sessions SET status='failed', error_message=?, updated_at=datetime('now') WHERE job_id=?",
                (str(e), job_id),
            )
            broadcast_job_update(job_id, "failed", error_message=str(e))
        raise

    output_dir = Path(settings.output_dir) / job_id
    output_dir.mkdir(parents=True, exist_ok=True)
    raw_path = str(output_dir / "raw.png")
    upscaled_path = str(output_dir / "upscaled.jpg")
    framed_path = str(output_dir / "framed.jpg")

    import asyncio
    asyncio.run(download_image(result.image_url, raw_path))
    upscale_image(raw_path, upscaled_path, target_size=(1200, 1800))

    # Find event custom frame or style default frame
    frame_img = None
    allow_auto_print = 1
    with get_db() as db:
        sess = db.execute("SELECT event_id FROM sessions WHERE job_id=?", (job_id,)).fetchone()
        event_id = sess["event_id"] if sess else None
        
    if event_id:
        with get_db() as db:
            event = db.execute("SELECT frame_path, allow_auto_print FROM events WHERE id=?", (event_id,)).fetchone()
            if event:
                if event["frame_path"] and os.path.exists(event["frame_path"]):
                    frame_img = event["frame_path"]
                if "allow_auto_print" in event.keys() and event["allow_auto_print"] is not None:
                    allow_auto_print = int(event["allow_auto_print"])
                
    if not frame_img:
        style_frame = str(Path(settings.upload_dir).parent.parent / "styles" / style_id / "frame.png")
        if os.path.exists(style_frame):
            frame_img = style_frame

    if frame_img:
        compose_print_frame(upscaled_path, framed_path, frame_path=frame_img)
    else:
        compose_print_frame(upscaled_path, framed_path)

    print_path = str(output_dir / "print_ready.jpg")
    if frame_img:
        compose_print_frame(upscaled_path, print_path, frame_path=frame_img, target_size=(1200, 1800))
    else:
        compose_print_frame(upscaled_path, print_path, target_size=(1200, 1800))

    # ---------------------------------------------------------------
    # Race coordinator: claim winner, cancel the other job if needed
    # ---------------------------------------------------------------
    _primary = primary_job_id or job_id
    broadcast_job_id = _primary  # always broadcast under primary job_id

    with _race_lock:
        state = _race_state.get(_primary)
        if state:
            if job_id in state.get("cancelled", set()):
                # We lost the race — discard result
                print(f"[failsafe] Job {job_id} lost the race (already cancelled). Discarding result.")
                return
            if state.get("winner") is None:
                # We win the race
                state["winner"] = job_id
                # Cancel all other jobs in the race
                for other_jid in list(state.get("jobs", set())):
                    if other_jid != job_id:
                        state.setdefault("cancelled", set()).add(other_jid)
                        print(f"[failsafe] Job {job_id} won. Cancelling {other_jid}.")
                state["done"].set()
            else:
                # Another job already won
                print(f"[failsafe] Job {job_id} finished but {state['winner']} already won. Discarding.")
                return

    with get_db() as db:
        db.execute(
            "UPDATE sessions SET status='done', output_image=?, print_image=?, cost_time=?, cost_money=?, updated_at=datetime('now') WHERE job_id=?",
            (raw_path, print_path, result.cost_time, result.cost_money, job_id),
        )
        # If this was a retry (secondary) job, also update the primary session row
        # so the kiosk's poll on primary_job_id sees 'done'
        if primary_job_id and primary_job_id != job_id:
            db.execute(
                "UPDATE sessions SET status='done', output_image=?, print_image=?, cost_time=?, cost_money=?, updated_at=datetime('now') WHERE job_id=?",
                (raw_path, print_path, result.cost_time, result.cost_money, primary_job_id),
            )
    broadcast_job_update(broadcast_job_id, "done", output_image=raw_path)

    if allow_auto_print:
        with get_db() as db:
            sess_check = db.execute("SELECT capture_source FROM sessions WHERE job_id=?", (job_id,)).fetchone()
            if sess_check and sess_check["capture_source"] == "test":
                allow_auto_print = 0

    if allow_auto_print:
        from app.services.printing import enqueue_print
        enqueue_print(print_path, copies=1, session_id=job_id)
        print(f"[pipeline] Auto-print is ON. Enqueued print job for session {job_id}.")
    else:
        print(f"[pipeline] Auto-print is OFF (allow_auto_print=0) for session {job_id}. Skipping automatic print spooling.")

    # Save a copy locally if configured by admin (session-based folder structure)
    try:
        from app.db import get_setting
        local_dir_setting = get_setting("local_save_dir", "")
        if local_dir_setting:
            target_base = Path(local_dir_setting)
            session_folder = event_id if event_id else "default"
            target_dir = target_base / session_folder
            target_dir.mkdir(parents=True, exist_ok=True)
            
            timestamp = datetime.now(timezone.utc).astimezone().strftime("%Y%m%d_%H%M%S")
            target_filename = f"{timestamp}_{style_id}_{job_id}.jpg"
            target_path = target_dir / target_filename
            
            # If auto-print is OFF, save the generated photo (raw_path / framed_path) instead of the 4x6 print frame layout
            save_source = print_path if allow_auto_print else (framed_path if os.path.exists(framed_path) else raw_path)
            
            import shutil
            shutil.copy2(save_source, target_path)
            print(f"Successfully saved local copy to {target_path} (source: {save_source})")
    except Exception as e:
        print(f"Failed to save copy to local directory: {e}")

    # Generate QR code
    try:
        pr = print_path.replace("\\", "/").split("/")[-2:]
        result_url = f"{PUBLIC_BASE_URL}/api/images/{pr[0]}/{pr[1]}"
        
        qr_bg = "white"
        qr_fg = "black"
        with get_db() as db:
            sess = db.execute("SELECT event_id FROM sessions WHERE job_id=?", (job_id,)).fetchone()
            event_id = sess["event_id"] if sess else None
            if event_id:
                event = db.execute("SELECT qr_bg_color, qr_fg_color FROM events WHERE id=?", (event_id,)).fetchone()
                if event:
                    qr_bg = event["qr_bg_color"] or "white"
                    qr_fg = event["qr_fg_color"] or "black"
        
        qr = qrcode.QRCode(version=1, box_size=10, border=4)
        qr.add_data(result_url)
        qr.make(fit=True)
        qr_img = qr.make_image(fill_color=qr_fg, back_color=qr_bg)
        qr_path = str(output_dir / "qr.png")
        qr_img.save(qr_path)
        with get_db() as db:
            db.execute("UPDATE sessions SET qr_code=? WHERE job_id=?", (qr_path, job_id))
    except Exception as e:
        with get_db() as db:
            db.execute("UPDATE sessions SET error_message=COALESCE(error_message,'') || ' [QR:' || ? || ']' WHERE job_id=?", (str(e)[:100], job_id))


def run_pipeline_with_failsafe(
    job_id: str,
    style_id: str,
    image_path: str,
    style_ref_path: str | None = None,
    prompt_override: str = None,
    model_override: str = None,
    resolution_override: str = None,
    quality_override: str = None,
    aspect_override: str = None,
    seed_override: str = None,
    failsafe_timeout: int = 35,
):
    """
    Orchestrate a generation with parallel failsafe retry.

    Fires job_id (primary) immediately. If it hasn't completed within
    failsafe_timeout seconds, fires a second retry job. Whichever finishes
    first wins; the other is silently cancelled. The kiosk always receives
    the result broadcast under the original job_id.
    """
    pipeline_kwargs = dict(
        style_id=style_id,
        image_path=image_path,
        style_ref_path=style_ref_path,
        prompt_override=prompt_override,
        model_override=model_override,
        resolution_override=resolution_override,
        quality_override=quality_override,
        aspect_override=aspect_override,
        seed_override=seed_override,
    )

    # Set up race state for this primary job
    done_event = threading.Event()
    with _race_lock:
        _race_state[job_id] = {
            "done": done_event,
            "winner": None,
            "cancelled": set(),
            "jobs": {job_id},
        }

    print(f"[failsafe] Starting primary job {job_id} with failsafe timeout={failsafe_timeout}s")

    # Launch primary pipeline thread
    t1 = threading.Thread(
        target=run_pipeline,
        args=(job_id,),
        kwargs={**pipeline_kwargs, "primary_job_id": None},
        daemon=True,
    )
    t1.start()

    # Wait for either completion or timeout
    finished = done_event.wait(timeout=failsafe_timeout)

    if finished:
        # Primary finished in time — clean up and we're done
        print(f"[failsafe] Primary job {job_id} completed within {failsafe_timeout}s. No retry needed.")
        with _race_lock:
            _race_state.pop(job_id, None)
        return

    # Timeout hit — fire secondary retry job
    retry_job_id = uuid.uuid4().hex[:12]
    print(f"[failsafe] Primary job {job_id} exceeded {failsafe_timeout}s. Firing retry job {retry_job_id}.")

    # Insert a secondary session row (internal, not shown to kiosk)
    with get_db() as db:
        primary_sess = db.execute(
            "SELECT style_id, capture_source, input_image, ref_image, event_id, v2_model FROM sessions WHERE job_id=?",
            (job_id,),
        ).fetchone()
        if primary_sess:
            db.execute(
                "INSERT INTO sessions (job_id, style_id, capture_source, input_image, ref_image, status, event_id, v2_model) VALUES (?,?,?,?,?,?,?,?)",
                (
                    retry_job_id,
                    primary_sess["style_id"],
                    primary_sess["capture_source"],
                    primary_sess["input_image"],
                    primary_sess["ref_image"],
                    "created",
                    primary_sess["event_id"],
                    primary_sess["v2_model"],
                ),
            )

    with _race_lock:
        _race_state[job_id]["jobs"].add(retry_job_id)

    t2 = threading.Thread(
        target=run_pipeline,
        args=(retry_job_id,),
        kwargs={**pipeline_kwargs, "primary_job_id": job_id},
        daemon=True,
    )
    t2.start()

    # Wait indefinitely for either thread to finish via the shared event
    # (The winner will set done_event; no extra wait needed since threads are daemon)
    done_event.wait(timeout=600)  # hard safety cap of 10 min

    # Cleanup race state
    with _race_lock:
        state = _race_state.pop(job_id, {})
        winner = state.get("winner", "unknown")
    print(f"[failsafe] Race for {job_id} complete. Winner: {winner}")
