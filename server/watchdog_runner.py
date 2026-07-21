import subprocess
import psutil
import time
import os
import sys
import sqlite3
import json
from datetime import datetime

# Adjust working directory to backend server dir
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

DB_PATH = os.path.join(BASE_DIR, "sqlite.db")
LOG_PATH = os.path.join(BASE_DIR, "watchdog.log")
MEMORY_LIMIT_BYTES = 2 * 1024 * 1024 * 1024  # 2GB

def log_message(msg):
    timestamp = datetime.now().strftime("[%Y-%m-%d %H:%M:%S]")
    line = f"{timestamp} {msg}\n"
    print(f"[Watchdog] {msg}")
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(line)
    except Exception as e:
        print(f"Failed to write log: {e}")

def update_watchdog_status(status, pid, memory_mb, last_restart_time=None, last_restart_reason=None):
    try:
        conn = sqlite3.connect(DB_PATH, timeout=10.0)
        conn.execute("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        
        row = conn.execute("SELECT value FROM app_settings WHERE key='watchdog_status'").fetchone()
        current = {}
        if row:
            try:
                current = json.loads(row[0])
            except:
                pass
        
        current["status"] = status
        current["pid"] = pid
        current["memory_mb"] = round(memory_mb, 2)
        current["limit_mb"] = 2048.0
        current["last_check_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if last_restart_time:
            current["last_restart_time"] = last_restart_time
        if last_restart_reason:
            current["last_restart_reason"] = last_restart_reason
            
        val_json = json.dumps(current)
        conn.execute("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('watchdog_status', ?)", (val_json,))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Watchdog] DB Error: {e}")

def get_process_memory(pid):
    try:
        parent = psutil.Process(pid)
        total_rss = parent.memory_info().rss
        for child in parent.children(recursive=True):
            try:
                total_rss += child.memory_info().rss
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return total_rss
    except psutil.NoSuchProcess:
        return 0

def start_backend():
    python_exe = os.path.join(BASE_DIR, "venv", "Scripts", "python.exe")
    if not os.path.exists(python_exe):
        python_exe = sys.executable  # Fallback to current interpreter
        
    cmd = [python_exe, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765"]
    log_message(f"Starting backend: {' '.join(cmd)}")
    
    # Run uvicorn in a separate process group or shell to ensure signals propagate correctly
    p = subprocess.Popen(
        cmd,
        cwd=BASE_DIR,
        env=os.environ.copy()
    )
    return p

def main():
    log_message("Watchdog Auto-Restarter active.")
    p = start_backend()
    
    last_restart_time = None
    last_restart_reason = None
    
    try:
        while True:
            time.sleep(10)
            
            # Check if backend process is alive
            if p.poll() is not None:
                exit_code = p.returncode
                log_message(f"Backend process terminated unexpectedly with code {exit_code}. Restarting...")
                last_restart_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                last_restart_reason = f"Process terminated unexpectedly (exit code {exit_code})"
                p = start_backend()
                continue
                
            # Measure memory usage
            rss = get_process_memory(p.pid)
            memory_mb = rss / (1024 * 1024)
            
            # Check memory threshold
            if rss > MEMORY_LIMIT_BYTES:
                log_message(f"Memory threshold exceeded: {memory_mb:.2f}MB > 2048MB. Initiating clean restart...")
                
                # Graceful termination
                p.terminate()
                try:
                    p.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    log_message("Backend did not terminate in 5s. Forcing kill...")
                    p.kill()
                    p.wait()
                    
                last_restart_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                last_restart_reason = f"Memory threshold exceeded: {memory_mb:.2f}MB > 2048MB"
                
                # Restart backend
                p = start_backend()
                update_watchdog_status("restarting", p.pid, memory_mb, last_restart_time, last_restart_reason)
            else:
                update_watchdog_status("healthy", p.pid, memory_mb)
                
    except KeyboardInterrupt:
        log_message("Watchdog stopped by user keyboard interrupt.")
        p.terminate()
        p.wait()
    except Exception as e:
        log_message(f"Fatal error in watchdog loop: {e}")
        if p.poll() is None:
            p.terminate()
            p.wait()

if __name__ == "__main__":
    main()
