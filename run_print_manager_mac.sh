#!/usr/bin/env bash
# ==========================================================
# PhotoLab AI Booth — macOS Standalone Print Manager Launcher
# ==========================================================
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "----------------------------------------------------"
echo "🖨️ Starting PhotoLab Standalone Print Manager (macOS)..."
echo "----------------------------------------------------"

PYTHON_EXEC="$SCRIPT_DIR/server/venv/bin/python"
if [ ! -f "$PYTHON_EXEC" ]; then
    PYTHON_EXEC="python3"
fi

$PYTHON_EXEC "$SCRIPT_DIR/print_manager_app.py"
