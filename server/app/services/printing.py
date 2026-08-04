import os, time
from pathlib import Path
from threading import Thread
from app.config import settings

print_queue = []

def spool_print(image_path: str, copies: int = 1, printer_name: str = ""):
    png_path = image_path
    if not image_path.lower().endswith(".png"):
        from PIL import Image
        png_path = image_path.rsplit(".", 1)[0] + "_print.png"
        Image.open(image_path).convert("RGB").save(png_path, "PNG")

    name = printer_name or settings.printer_name
    try:
        import win32print
        import win32ui
        from PIL import Image

        im = Image.open(png_path)
        width, height = im.size

        for _ in range(copies):
            printer = name or win32print.GetDefaultPrinter()
            hprinter = win32print.OpenPrinter(printer)
            try:
                hdc = win32ui.CreateDC()
                hdc.CreatePrinterDC(printer)
                hdc.StartDoc(png_path)
                hdc.StartPage()

                hdc.SetMapMode(8)
                printable_area = hdc.GetDeviceCaps(110), hdc.GetDeviceCaps(111)
                printer_size = hdc.GetDeviceCaps(8), hdc.GetDeviceCaps(10)

                scale_x = printable_area[0] / width
                scale_y = printable_area[1] / height
                scale = min(scale_x, scale_y)

                from win32gui import StretchBlt, SRCPAINT

                dib = Image.frombuffer("RGB", (width, height), im.tobytes(), "raw", "BGRX", 0, 1)
                hdc.EndPage()
                hdc.EndDoc()
                hdc.DeleteDC()
            finally:
                win32print.ClosePrinter(hprinter)
        return True
    except ImportError:
        pass
    return False

def spool_print_simple(image_path: str, copies: int = 1, printer_name: str = ""):
    name = printer_name or settings.printer_name
    try:
        import win32print
        import win32ui
        import win32con
        from PIL import Image

        img = Image.open(image_path).convert("RGB")
        width, height = img.size
        pname = name or win32print.GetDefaultPrinter()

        hprinter = win32print.OpenPrinter(pname)
        try:
            hdc = win32ui.CreateDC()
            hdc.CreatePrinterDC(pname)
            hdc.StartDoc(image_path)

            for _ in range(copies):
                hdc.StartPage()
                hdc.StretchBlt(
                    (0, 0, width, height),
                    img.tobytes(),
                    0, 0, width, height,
                    win32con.SRCCOPY,
                )
                hdc.EndPage()

            hdc.EndDoc()
            hdc.DeleteDC()
            return True
        finally:
            win32print.ClosePrinter(hprinter)
    except ImportError:
        pass
    return False

def print_image(image_path: str, copies: int = 1):
    name = settings.printer_name
    try:
        # Try direct GDI printing first
        if spool_print_simple(image_path, copies, name):
            print(f"[print] Direct GDI print successful for {image_path}")
            return True
    except Exception as e:
        print(f"[print] GDI print attempt exception: {e}")

    try:
        import win32api
        import win32print
        pname = name or win32print.GetDefaultPrinter()
        if not pname:
            print("[print] No default printer configured or found.")
            return False
        
        for _ in range(copies):
            win32api.ShellExecute(0, "printto", image_path, f'"{pname}"', ".", 0)
        return True
    except Exception as e:
        print(f"[print] ShellExecute ERROR: {e}")
        return False

def print_worker():
    from app.db import get_db, get_setting, acquire_next_print_job
    from datetime import datetime, timezone
    while True:
        try:
            if get_setting("print_queue_paused", "0") == "1" or get_setting("use_external_print_manager", "0") == "1":
                time.sleep(2)
                continue

            job = acquire_next_print_job()
            if job:
                job_db_id, session_id, path, copies = job["id"], job["session_id"], job["image_path"], job["copies"]
                if session_id:
                    with get_db() as db:
                        db.execute("UPDATE sessions SET print_status='printing' WHERE job_id=?", (session_id,))
                
                success = print_image(path, copies)
                now_str = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")
                
                with get_db() as db:
                    if success:
                        db.execute("UPDATE print_queue SET status='completed', printed_at=? WHERE id=?", (now_str, job_db_id))
                        if session_id:
                            db.execute("UPDATE sessions SET print_status='completed', printed_at=? WHERE job_id=?", (now_str, session_id))
                        try:
                            curr_val = int(db.execute("SELECT value FROM app_settings WHERE key='prints_remaining'").fetchone()[0] or 400)
                            new_val = max(0, curr_val - copies)
                            db.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('prints_remaining', ?)", (str(new_val),))
                        except Exception:
                            pass
                    else:
                        db.execute("UPDATE print_queue SET status='failed' WHERE id=?", (job_db_id,))
                        if session_id:
                            db.execute("UPDATE sessions SET print_status='failed' WHERE job_id=?", (session_id,))
        except Exception as e:
            print(f"[print_worker] ERROR: {e}")
        time.sleep(2)

def start_print_worker():
    t = Thread(target=print_worker, daemon=True)
    t.start()

def enqueue_print(image_path: str, copies: int = 1, session_id: str = ""):
    from app.db import get_db
    try:
        with get_db() as db:
            db.execute("INSERT INTO print_queue (session_id, image_path, copies, status) VALUES (?,?,?,?)", (session_id, image_path, copies, 'queued'))
            if session_id:
                db.execute("UPDATE sessions SET print_status='queued' WHERE job_id=?", (session_id,))
    except Exception as e:
        print(f"[enqueue_print] DB Error: {e}")
