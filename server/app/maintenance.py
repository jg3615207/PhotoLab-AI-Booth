"""
PhotoLab - Out-of-Process System Maintenance CLI
Runs scheduled database VACUUM, ANALYZE, and old temporary image cleanup.
Can be executed via Windows Task Scheduler or cron during off-peak hours.
Usage: python -m app.maintenance [--days 7] [--vacuum]
"""

import os
import sys
import time
import argparse
from pathlib import Path
from datetime import datetime, timedelta

# Ensure parent directory is on python path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings
from app.db import get_db

def cleanup_old_files(days: int = 7):
    cutoff = time.time() - (days * 86400)
    cleaned_files = 0
    cleaned_bytes = 0

    target_dirs = [
        Path(settings.upload_dir),
        Path(settings.output_dir),
        Path(settings.print_dir),
    ]

    print(f"[Maintenance] Scanning temp directories for files older than {days} days...")
    for d in target_dirs:
        if not d.exists():
            continue
        for p in d.rglob("*"):
            if p.is_file() and p.stat().st_mtime < cutoff:
                try:
                    cleaned_bytes += p.stat().st_size
                    p.unlink()
                    cleaned_files += 1
                except Exception as e:
                    print(f"Failed to remove {p}: {e}")

    mb = cleaned_bytes / (1024 * 1024)
    print(f"[Maintenance] Cleaned {cleaned_files} files ({mb:.2f} MB).")

def run_db_maintenance():
    print("[Maintenance] Starting SQLite VACUUM and ANALYZE...")
    start_t = time.time()
    try:
        with get_db() as db:
            db.execute("VACUUM")
            db.execute("ANALYZE")
        cost = time.time() - start_t
        print(f"[Maintenance] SQLite VACUUM & ANALYZE completed in {cost:.2f}s.")
    except Exception as e:
        print(f"[Maintenance] DB maintenance error: {e}")

def main():
    parser = argparse.ArgumentParser(description="PhotoLab Maintenance Tool")
    parser.add_argument("--days", type=int, default=7, help="Retention period in days for temp files")
    parser.add_argument("--vacuum", action="store_true", help="Run SQLite VACUUM and ANALYZE")
    args = parser.parse_args()

    cleanup_old_files(days=args.days)
    if args.vacuum:
        run_db_maintenance()

if __name__ == "__main__":
    main()
