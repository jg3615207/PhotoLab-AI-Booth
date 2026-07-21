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
        import win32print
        pname = name or win32print.GetDefaultPrinter()
        return spool_print_simple(image_path, copies, pname)
    except Exception as e:
        print(f"[print] ERROR: {e}")
        return False

def print_worker():
    from app.db import get_db
    while True:
        try:
            with get_db() as db:
                row = db.execute("SELECT id, image_path, copies FROM print_queue WHERE status='queued' ORDER BY created_at ASC LIMIT 1").fetchone()
                if row:
                    job_id, path, copies = row["id"], row["image_path"], row["copies"]
                    db.execute("UPDATE print_queue SET status='printing' WHERE id=?", (job_id,))
                    
                    success = print_image(path, copies)
                    
                    if success:
                        db.execute("UPDATE print_queue SET status='completed' WHERE id=?", (job_id,))
                    else:
                        db.execute("UPDATE print_queue SET status='failed' WHERE id=?", (job_id,))
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
    except Exception as e:
        print(f"[enqueue_print] DB Error: {e}")
