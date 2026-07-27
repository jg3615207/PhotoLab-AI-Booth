"""
PhotoLab - Standalone Python Print Manager & Queuer App
Version: 1.0.0
Author: PhotoLab AI Booth Team
Description: A standalone Python desktop application for real-time print spooling,
             printer configuration, queue management, and test printing.
"""

import os
import sys
import time
import sqlite3
import json
import threading
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime, timezone
from pathlib import Path

# Try importing PIL for image thumbnails
try:
    from PIL import Image, ImageTk
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# Try importing win32 printing modules
try:
    import win32print
    import win32ui
    import win32api
    import win32con
    HAS_WIN32 = True
except ImportError:
    HAS_WIN32 = False

# Determine project base directory & DB Path
BASE_DIR = Path(__file__).resolve().parent
SERVER_DIR = BASE_DIR / "server"

def find_db_path():
    candidates = [
        SERVER_DIR / "data" / "booth.db",
        BASE_DIR / "data" / "booth.db",
        SERVER_DIR / "sqlite.db",
        BASE_DIR / "sqlite.db",
    ]
    for c in candidates:
        if c.exists():
            return str(c)
    return str(candidates[0])

DB_PATH = find_db_path()

class PrintManagerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("🖨️ PhotoLab Print Manager & Queuer v1.0")
        self.geometry("1100x720")
        self.minsize(900, 600)
        self.configure(bg="#0f0f1d")

        # Application state
        self.db_path = find_db_path()
        self.is_paused = False
        self.auto_print = True
        self.current_printer = ""
        self.selected_job_id = None
        self.preview_photo = None
        self.worker_running = True

        # Register external print manager active flag
        self._register_app_active()

        # Configure styles
        self._init_styles()

        # Build UI layout
        self._build_header()
        self._build_toolbar()
        self._build_main_content()
        self._build_log_bar()

        # Load printers
        self._load_printers()

        # Start background polling and worker
        self._start_worker_thread()
        self._schedule_refresh()

        self.protocol("WM_DELETE_WINDOW", self._on_close)

    def _init_styles(self):
        self.style = ttk.Style()
        self.style.theme_use("clam")

        # Colors
        self.bg_dark = "#0f0f1d"
        self.panel_bg = "#1a1a2e"
        self.accent_cyan = "#00d2ff"
        self.accent_purple = "#667eea"
        self.text_light = "#ffffff"
        self.text_dim = "#aaaaaa"

        # Treeview styling
        self.style.configure(
            "Treeview",
            background="#121222",
            foreground="#ffffff",
            fieldbackground="#121222",
            rowheight=32,
            font=("Segoe UI", 10)
        )
        self.style.configure(
            "Treeview.Heading",
            background="#1a1a2e",
            foreground="#00d2ff",
            font=("Segoe UI", 10, "bold")
        )
        self.style.map("Treeview", background=[("selected", "#0055aa")])

    def _build_header(self):
        header_frame = tk.Frame(self, bg=self.panel_bg, height=60, bd=0)
        header_frame.pack(fill=tk.X, side=tk.TOP, padx=0, pady=0)

        # App Title & Icon
        title_label = tk.Label(
            header_frame,
            text="🖨️ PhotoLab Print Manager & Queuer",
            font=("Segoe UI", 16, "bold"),
            fg="#ffffff",
            bg=self.panel_bg
        )
        title_label.pack(side=tk.LEFT, padx=20, pady=12)

        # Status Badge Indicator
        self.status_badge = tk.Label(
            header_frame,
            text="🟢 AUTO-PRINTING ACTIVE",
            font=("Segoe UI", 11, "bold"),
            fg="#00ff88",
            bg="#0d2b1d",
            padx=14,
            pady=4,
            bd=1,
            relief="solid"
        )
        self.status_badge.pack(side=tk.RIGHT, padx=20, pady=12)

    def _build_toolbar(self):
        toolbar = tk.Frame(self, bg="#141428", height=50)
        toolbar.pack(fill=tk.X, side=tk.TOP, padx=0, pady=0)

        # Printer Selector Label & Combobox
        lbl_printer = tk.Label(toolbar, text="Target Printer:", font=("Segoe UI", 10, "bold"), fg="#aaa", bg="#141428")
        lbl_printer.pack(side=tk.LEFT, padx=(20, 6), pady=10)

        self.cb_printer = ttk.Combobox(toolbar, width=32, state="readonly")
        self.cb_printer.pack(side=tk.LEFT, padx=4, pady=10)
        self.cb_printer.bind("<<ComboboxSelected>>", self._on_printer_changed)

        # Pause / Resume Button
        self.btn_pause = tk.Button(
            toolbar,
            text="⏸️ Pause Queue",
            font=("Segoe UI", 10, "bold"),
            bg="#ff4757",
            fg="#ffffff",
            activebackground="#ff6b81",
            activeforeground="#ffffff",
            bd=0,
            padx=12,
            pady=4,
            cursor="hand2",
            command=self._toggle_pause
        )
        self.btn_pause.pack(side=tk.LEFT, padx=10, pady=10)

        # Test Print Button
        btn_test = tk.Button(
            toolbar,
            text="📄 Test Print",
            font=("Segoe UI", 10, "bold"),
            bg="#00d2ff",
            fg="#000000",
            activebackground="#70a1ff",
            bd=0,
            padx=12,
            pady=4,
            cursor="hand2",
            command=self._test_print
        )
        btn_test.pack(side=tk.LEFT, padx=6, pady=10)

        # Manual Print File Button
        btn_add = tk.Button(
            toolbar,
            text="➕ Queue Local Image File",
            font=("Segoe UI", 10, "bold"),
            bg="#667eea",
            fg="#ffffff",
            activebackground="#764ba2",
            bd=0,
            padx=12,
            pady=4,
            cursor="hand2",
            command=self._add_manual_file
        )
        btn_add.pack(side=tk.LEFT, padx=6, pady=10)

        # Refresh Queue Button
        btn_refresh = tk.Button(
            toolbar,
            text="🔄 Refresh",
            font=("Segoe UI", 10),
            bg="#2f3542",
            fg="#ffffff",
            bd=0,
            padx=10,
            pady=4,
            cursor="hand2",
            command=self._refresh_queue
        )
        btn_refresh.pack(side=tk.RIGHT, padx=20, pady=10)

    def _build_main_content(self):
        main_frame = tk.Frame(self, bg=self.bg_dark)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=16, pady=12)

        # Left Column: Queue Table (70% width)
        left_frame = tk.Frame(main_frame, bg=self.bg_dark)
        left_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Table label
        lbl_q = tk.Label(left_frame, text="📋 Print Queue Jobs", font=("Segoe UI", 12, "bold"), fg="#fff", bg=self.bg_dark)
        lbl_q.pack(anchor="w", pady=(0, 6))

        # Scrollbars & Treeview
        tree_scroll_y = ttk.Scrollbar(left_frame, orient="vertical")
        tree_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)

        cols = ("id", "session_id", "copies", "status", "created_at", "printed_at")
        self.tree = ttk.Treeview(
            left_frame,
            columns=cols,
            show="headings",
            yscrollcommand=tree_scroll_y.set,
            selectmode="browse"
        )
        tree_scroll_y.config(command=self.tree.yview)

        self.tree.heading("id", text="Queue #")
        self.tree.heading("session_id", text="Job ID")
        self.tree.heading("copies", text="Copies")
        self.tree.heading("status", text="Status")
        self.tree.heading("created_at", text="Queued Time")
        self.tree.heading("printed_at", text="Printed At")

        self.tree.column("id", width=70, anchor="center")
        self.tree.column("session_id", width=140, anchor="center")
        self.tree.column("copies", width=60, anchor="center")
        self.tree.column("status", width=110, anchor="center")
        self.tree.column("created_at", width=160, anchor="center")
        self.tree.column("printed_at", width=160, anchor="center")

        self.tree.pack(fill=tk.BOTH, expand=True)
        self.tree.bind("<<TreeviewSelect>>", self._on_job_select)

        # Queue Control Buttons Below Table
        btn_bar = tk.Frame(left_frame, bg=self.bg_dark)
        btn_bar.pack(fill=tk.X, pady=(10, 0))

        btn_reprint = tk.Button(
            btn_bar, text="🖨️ Reprint Selected", font=("Segoe UI", 10, "bold"),
            bg="#2ed573", fg="#000", bd=0, padx=12, pady=4, cursor="hand2", command=self._reprint_selected
        )
        btn_reprint.pack(side=tk.LEFT, padx=(0, 8))

        btn_cancel = tk.Button(
            btn_bar, text="❌ Cancel Selected", font=("Segoe UI", 10),
            bg="#ff4757", fg="#fff", bd=0, padx=12, pady=4, cursor="hand2", command=self._cancel_selected
        )
        btn_cancel.pack(side=tk.LEFT, padx=4)

        btn_clear = tk.Button(
            btn_bar, text="🧹 Clear Completed", font=("Segoe UI", 10),
            bg="#747d8c", fg="#fff", bd=0, padx=12, pady=4, cursor="hand2", command=self._clear_completed
        )
        btn_clear.pack(side=tk.LEFT, padx=4)

        # Right Column: Image Preview & Details (30% width)
        right_frame = tk.Frame(main_frame, bg=self.panel_bg, width=320, bd=1, relief="solid")
        right_frame.pack(side=tk.RIGHT, fill=tk.BOTH, padx=(16, 0))

        lbl_p = tk.Label(right_frame, text="🔍 Photo Preview", font=("Segoe UI", 12, "bold"), fg="#fff", bg=self.panel_bg)
        lbl_p.pack(anchor="w", padx=14, pady=10)

        # Image Container Frame
        self.img_container = tk.Label(
            right_frame,
            text="Select a print job to view preview",
            font=("Segoe UI", 10),
            fg="#888888",
            bg="#090914",
            width=36,
            height=16
        )
        self.img_container.pack(fill=tk.BOTH, expand=True, padx=14, pady=6)

        # Selected Job Info Card
        self.lbl_info = tk.Label(
            right_frame,
            text="No job selected",
            font=("Consolas", 9),
            fg="#00d2ff",
            bg=self.panel_bg,
            justify=tk.LEFT,
            anchor="w"
        )
        self.lbl_info.pack(fill=tk.X, padx=14, pady=(6, 14))

    def _build_log_bar(self):
        log_frame = tk.Frame(self, bg="#0a0a14", height=130)
        log_frame.pack(fill=tk.X, side=tk.BOTTOM, padx=16, pady=(0, 12))

        lbl_log = tk.Label(log_frame, text="📝 Real-Time Spooling Log", font=("Segoe UI", 10, "bold"), fg="#8888aa", bg="#0a0a14")
        lbl_log.pack(anchor="w", padx=6, pady=(4, 2))

        self.log_text = tk.Text(log_frame, height=5, bg="#05050b", fg="#00d2ff", font=("Consolas", 9), bd=0, wrap="word")
        self.log_text.pack(fill=tk.BOTH, expand=True, padx=6, pady=(0, 6))

        self._log("Print Manager initialized. Connected to DB: " + self.db_path)

    def _log(self, message: str):
        now_str = datetime.now().strftime("[%H:%M:%S]")
        full_msg = f"{now_str} {message}\n"
        self.log_text.insert(tk.END, full_msg)
        self.log_text.see(tk.END)

    def _load_printers(self):
        printers = []
        default_printer = ""
        if HAS_WIN32:
            try:
                printer_objs = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
                printers = [p[2] for p in printer_objs]
                default_printer = win32print.GetDefaultPrinter()
            except Exception as e:
                self._log(f"Error enumerating Windows printers: {e}")
        else:
            printers = ["Virtual / Software Printer (No win32print)"]
            default_printer = printers[0]

        if printers:
            self.cb_printer["values"] = printers
            if default_printer in printers:
                self.cb_printer.set(default_printer)
                self.current_printer = default_printer
            else:
                self.cb_printer.set(printers[0])
                self.current_printer = printers[0]
            self._log(f"Detected {len(printers)} printers. Selected: {self.current_printer}")
        else:
            self.cb_printer["values"] = ["No Printers Installed"]
            self.cb_printer.set("No Printers Installed")

    def _on_printer_changed(self, event=None):
        self.current_printer = self.cb_printer.get()
        self._log(f"Selected printer changed to: {self.current_printer}")

    def _toggle_pause(self):
        self.is_paused = not self.is_paused
        if self.is_paused:
            self.btn_pause.config(text="▶️ Resume Queue", bg="#2ed573")
            self.status_badge.config(text="⏸️ QUEUE PAUSED", fg="#ffcc00", bg="#332900")
            self._log("Print Queue PAUSED by operator.")
        else:
            self.btn_pause.config(text="⏸️ Pause Queue", bg="#ff4757")
            self.status_badge.config(text="🟢 AUTO-PRINTING ACTIVE", fg="#00ff88", bg="#0d2b1d")
            self._log("Print Queue RESUMED.")

        # Update DB setting
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute(
                "INSERT OR REPLACE INTO app_settings (key, value) VALUES ('print_queue_paused', ?)",
                ("1" if self.is_paused else "0",)
            )
            conn.commit()
            conn.close()
        except Exception as e:
            self._log(f"DB setting update error: {e}")

    def _refresh_queue(self):
        if not os.path.exists(self.db_path):
            return

        try:
            conn = sqlite3.connect(self.db_path, timeout=5.0)
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT id, session_id, image_path, copies, status, created_at, printed_at FROM print_queue ORDER BY id DESC LIMIT 100").fetchall()
            conn.close()

            # Preserve selection
            selected_item = self.tree.selection()
            selected_id = None
            if selected_item:
                selected_id = self.tree.item(selected_item[0])["values"][0]

            self.tree.delete(*self.tree.get_children())

            for r in rows:
                status_str = r["status"].upper() if r["status"] else "QUEUED"
                item_id = self.tree.insert(
                    "",
                    "end",
                    values=(
                        r["id"],
                        r["session_id"] or "-",
                        r["copies"] or 1,
                        status_str,
                        r["created_at"] or "-",
                        r["printed_at"] or "-"
                    )
                )

                if selected_id and r["id"] == selected_id:
                    self.tree.selection_set(item_id)
        except Exception as e:
            pass

    def _on_job_select(self, event=None):
        selected_item = self.tree.selection()
        if not selected_item:
            return

        values = self.tree.item(selected_item[0])["values"]
        queue_id = values[0]
        session_id = values[1]

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM print_queue WHERE id=?", (queue_id,)).fetchone()
            conn.close()

            if row:
                img_path = row["image_path"]
                info_text = f"Queue #: {row['id']}\nJob ID: {row['session_id']}\nCopies: {row['copies']}\nStatus: {row['status']}\nPath: {Path(img_path).name}"
                self.lbl_info.config(text=info_text)
                self.selected_job_id = row["id"]

                # Render Image Thumbnail
                if HAS_PIL and img_path and os.path.exists(img_path):
                    try:
                        im = Image.open(img_path)
                        im.thumbnail((260, 260))
                        self.preview_photo = ImageTk.PhotoImage(im)
                        self.img_container.config(image=self.preview_photo, text="")
                    except Exception as e:
                        self.img_container.config(image="", text=f"Error loading image:\n{e}")
                else:
                    self.img_container.config(image="", text="[Image file not found on disk]")
        except Exception as e:
            self._log(f"Error fetching job detail: {e}")

    def _test_print(self):
        target = self.current_printer
        if not target:
            messagebox.showwarning("No Printer", "Please select a target printer first.")
            return

        self._log(f"Initiating Test Print to printer: {target}...")
        test_img_path = SERVER_DIR / "app" / "static" / "test_print.png"
        
        # Create temporary test print image if it doesn't exist
        if not test_img_path.exists() and HAS_PIL:
            try:
                test_img_path.parent.mkdir(parents=True, exist_ok=True)
                im = Image.new("RGB", (600, 900), color=(18, 18, 34))
                from PIL import ImageDraw, ImageFont
                draw = ImageDraw.Draw(im)
                draw.rectangle([(20, 20), (580, 880)], outline=(0, 210, 255), width=6)
                draw.text((100, 400), "PhotoLab AI Booth", fill=(0, 210, 255))
                draw.text((120, 460), "TEST PRINT OK", fill=(255, 255, 255))
                im.save(test_img_path)
            except Exception as e:
                self._log(f"Failed to create test image: {e}")

        if test_img_path.exists():
            success = self._spool_image_to_printer(str(test_img_path), copies=1, printer_name=target)
            if success:
                messagebox.showinfo("Test Print", f"Test print sent successfully to {target}!")
            else:
                messagebox.showerror("Print Failed", f"Failed to send test print to {target}.")

    def _add_manual_file(self):
        file_path = filedialog.askopenfilename(
            title="Select Image File to Print",
            filetypes=[("Image Files", "*.jpg *.jpeg *.png *.bmp"), ("All Files", "*.*")]
        )
        if file_path:
            try:
                conn = sqlite3.connect(self.db_path)
                conn.execute(
                    "INSERT INTO print_queue (session_id, image_path, copies, status) VALUES (?, ?, ?, ?)",
                    ("MANUAL_" + datetime.now().strftime("%H%M%S"), file_path, 1, "queued")
                )
                conn.commit()
                conn.close()
                self._log(f"Manual print job added: {Path(file_path).name}")
                self._refresh_queue()
            except Exception as e:
                messagebox.showerror("Error", f"Failed to add manual print job: {e}")

    def _reprint_selected(self):
        selected_item = self.tree.selection()
        if not selected_item:
            messagebox.showwarning("No Selection", "Please select a print job from the queue table.")
            return

        queue_id = self.tree.item(selected_item[0])["values"][0]
        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row
            row = conn.execute("SELECT * FROM print_queue WHERE id=?", (queue_id,)).fetchone()
            if row:
                conn.execute(
                    "INSERT INTO print_queue (session_id, image_path, copies, status) VALUES (?, ?, ?, ?)",
                    (row["session_id"], row["image_path"], row["copies"] or 1, "queued")
                )
                conn.commit()
                self._log(f"Queued reprint for Job #{row['session_id']}")
            conn.close()
            self._refresh_queue()
        except Exception as e:
            messagebox.showerror("Reprint Error", str(e))

    def _cancel_selected(self):
        selected_item = self.tree.selection()
        if not selected_item:
            return

        queue_id = self.tree.item(selected_item[0])["values"][0]
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute("UPDATE print_queue SET status='cancelled' WHERE id=?", (queue_id,))
            conn.commit()
            conn.close()
            self._log(f"Cancelled queue job #{queue_id}")
            self._refresh_queue()
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _clear_completed(self):
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute("DELETE FROM print_queue WHERE status IN ('completed', 'cancelled')")
            conn.commit()
            conn.close()
            self._log("Cleared completed/cancelled jobs from queue.")
            self._refresh_queue()
        except Exception as e:
            messagebox.showerror("Error", str(e))

    def _spool_image_to_printer(self, image_path: str, copies: int = 1, printer_name: str = "") -> bool:
        # Sanitize copies to integer
        try:
            copies = int(copies)
            if copies <= 0:
                copies = 1
        except Exception:
            copies = 1

        pname = printer_name or self.current_printer
        self._log(f"Spooling image: {Path(image_path).name} -> Printer: '{pname}' ({copies} copies)...")

        if not os.path.exists(image_path):
            self._log(f"Image file not found on disk: {image_path}")
            return False

        if HAS_WIN32:
            # 1. Try Direct GDI Printing via win32ui & win32print (High Quality, Fast, Direct Spool)
            try:
                if not pname or pname == "No Printers Installed":
                    pname = win32print.GetDefaultPrinter()

                im = Image.open(image_path).convert("RGB")
                img_w, img_h = im.size

                for copy_idx in range(copies):
                    hprinter = win32print.OpenPrinter(pname)
                    try:
                        hdc = win32ui.CreateDC()
                        hdc.CreatePrinterDC(pname)
                        
                        # Start document
                        doc_name = f"PhotoLab_{Path(image_path).stem}"
                        hdc.StartDoc(doc_name)
                        hdc.StartPage()

                        # Get printer device printable resolution
                        prn_w = hdc.GetDeviceCaps(8)   # HORZRES
                        prn_h = hdc.GetDeviceCaps(10)  # VERTRES

                        # Calculate aspect-ratio scale & centering
                        scale_x = prn_w / float(img_w)
                        scale_y = prn_h / float(img_h)
                        scale = min(scale_x, scale_y)

                        dest_w = int(img_w * scale)
                        dest_h = int(img_h * scale)
                        offset_x = int((prn_w - dest_w) / 2)
                        offset_y = int((prn_h - dest_h) / 2)

                        # Draw image onto DC using PIL ImageWin
                        from PIL import ImageWin
                        dib = ImageWin.Dib(im)
                        dib.draw(hdc.GetHandleOutput(), (offset_x, offset_y, offset_x + dest_w, offset_y + dest_h))

                        hdc.EndPage()
                        hdc.EndDoc()
                        hdc.DeleteDC()
                    finally:
                        win32print.ClosePrinter(hprinter)

                self._log(f"✅ Direct GDI Spooling successful to '{pname}'")
                return True
            except Exception as gdi_err:
                self._log(f"GDI Spooling notice: {gdi_err}. Trying ShellExecute fallback...")

            # 2. Fallback to ShellExecute if GDI fails
            try:
                for _ in range(copies):
                    win32api.ShellExecute(0, "printto", image_path, f'"{pname}"', ".", 0)
                self._log(f"✅ ShellExecute command sent to '{pname}'")
                return True
            except Exception as shell_err:
                self._log(f"ShellExecute error: {shell_err}")
                return False
        else:
            self._log(f"[SIMULATION MODE] Simulated print for {image_path}")
            time.sleep(1)
            return True

    def _register_app_active(self):
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('use_external_print_manager', '1')")
            conn.commit()
            conn.close()
        except Exception as e:
            pass

    def _start_worker_thread(self):
        self.worker_thread = threading.Thread(target=self._print_worker_loop, daemon=True)
        self.worker_thread.start()

    def _print_worker_loop(self):
        """Background thread polling SQLite for queued jobs and spooling to printer."""
        while self.worker_running:
            time.sleep(1.5)
            if self.is_paused or not self.auto_print:
                continue

            if not os.path.exists(self.db_path):
                continue

            try:
                conn = sqlite3.connect(self.db_path, timeout=5.0)
                conn.row_factory = sqlite3.Row
                row = conn.execute("SELECT id, session_id, image_path, copies FROM print_queue WHERE status='queued' ORDER BY id ASC LIMIT 1").fetchone()

                if row:
                    job_db_id = row["id"]
                    session_id = row["session_id"]
                    img_path = row["image_path"]
                    copies = row["copies"] or 1

                    # Mark printing
                    conn.execute("UPDATE print_queue SET status='printing' WHERE id=?", (job_db_id,))
                    if session_id:
                        conn.execute("UPDATE sessions SET print_status='printing' WHERE job_id=?", (session_id,))
                    conn.commit()

                    self._log(f"Processing queued Job #{job_db_id} (Session: {session_id})...")

                    # Determine target job_id for folder lookup
                    target_job_id = session_id or (img_path if (img_path and not os.path.exists(img_path)) else "")
                    
                    # Image path fallback check
                    if not img_path or not os.path.exists(img_path):
                        if target_job_id:
                            out_dir = SERVER_DIR / "data" / "outputs" / str(target_job_id)
                            for alt in [out_dir / "print_ready.jpg", out_dir / "framed.jpg", out_dir / "upscaled.jpg", out_dir / "raw.png"]:
                                if alt.exists():
                                    img_path = str(alt)
                                    break

                    if img_path and os.path.exists(img_path):
                        # Spool to Windows printer
                        success = self._spool_image_to_printer(img_path, copies=copies, printer_name=self.current_printer)

                        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                        if success:
                            conn.execute("UPDATE print_queue SET status='completed', printed_at=? WHERE id=?", (now_str, job_db_id))
                            if session_id:
                                conn.execute("UPDATE sessions SET print_status='completed', printed_at=? WHERE job_id=?", (now_str, session_id))
                            self._log(f"✅ Job #{job_db_id} completed successfully!")
                        else:
                            conn.execute("UPDATE print_queue SET status='failed' WHERE id=?", (job_db_id,))
                            if session_id:
                                conn.execute("UPDATE sessions SET print_status='failed' WHERE job_id=?", (session_id,))
                            self._log(f"❌ Job #{job_db_id} failed print spooling!")
                    else:
                        conn.execute("UPDATE print_queue SET status='failed' WHERE id=?", (job_db_id,))
                        if session_id:
                            conn.execute("UPDATE sessions SET print_status='failed' WHERE job_id=?", (session_id,))
                        self._log(f"⚠️ Job #{job_db_id} failed: Image file not found on disk ({img_path})")

                    conn.commit()
                conn.close()
            except Exception as e:
                pass

    def _schedule_refresh(self):
        """Auto-refresh table UI every 2 seconds."""
        self._refresh_queue()
        self.after(2000, self._schedule_refresh)

    def _on_close(self):
        self.worker_running = False
        try:
            conn = sqlite3.connect(DB_PATH, timeout=5.0)
            conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('use_external_print_manager', '0')")
            conn.commit()
            conn.close()
        except Exception:
            pass
        self.destroy()

if __name__ == "__main__":
    app = PrintManagerApp()
    app.mainloop()
