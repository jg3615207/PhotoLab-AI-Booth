#!/usr/bin/env bash
# ==========================================================
# PhotoLab AI Booth — macOS All-In-One Launcher Script
# ==========================================================
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

PYTHON_EXEC="$SCRIPT_DIR/server/venv/bin/python"
if [ ! -f "$PYTHON_EXEC" ]; then
    PYTHON_EXEC="python3"
fi

echo "===================================================="
echo "      🚀 PhotoLab AI Booth v0.43.0 (macOS)         "
echo "===================================================="
echo ""

# 1. Start Server Watchdog in background
echo "1️⃣ Launching Backend Server Watchdog..."
$PYTHON_EXEC "$SCRIPT_DIR/server/watchdog_runner.py" &
SERVER_PID=$!
sleep 2

# 2. Check for Cloudflare Tunnel
if command -v cloudflared &>/dev/null; then
    echo "2️⃣ Launching Cloudflare Tunnel..."
    cloudflared tunnel run --url http://127.0.0.1:8765 photolab &
    TUNNEL_PID=$!
else
    echo "ℹ️ Cloudflare Tunnel (cloudflared) not installed. Running in local mode."
fi

# 3. Start Standalone Print Manager GUI
if [ "$1" != "--no-gui" ]; then
    echo "3️⃣ Launching Standalone Print Manager GUI..."
    $PYTHON_EXEC "$SCRIPT_DIR/print_manager_app.py" &
    PRINT_PID=$!
fi

echo ""
echo "===================================================="
echo "       PhotoLab AI Booth is RUNNING! 🚀            "
echo "===================================================="
echo "🌐 Local Kiosk URL:   http://127.0.0.1:8765/kiosk/"
echo "⚙️ Local Admin URL:   http://127.0.0.1:8765/admin/"
echo "🌐 Cloudflare Tunnel: https://photolab.techno-film.com/"
echo "===================================================="
echo ""

while true; do
    echo "Options:"
    echo " [1] Open Local Kiosk (Browser)"
    echo " [2] Open Local Admin (Browser)"
    echo " [3] Open Cloudflare Tunnel (Browser)"
    echo " [q] Quit All Services"
    read -p "Select option: " opt
    case $opt in
        1) open "http://127.0.0.1:8765/kiosk/" ;;
        2) open "http://127.0.0.1:8765/admin/" ;;
        3) open "https://photolab.techno-film.com/" ;;
        q|Q)
            echo "Stopping all services..."
            kill $SERVER_PID 2>/dev/null || true
            if [ -n "$TUNNEL_PID" ]; then kill $TUNNEL_PID 2>/dev/null || true; fi
            if [ -n "$PRINT_PID" ]; then kill $PRINT_PID 2>/dev/null || true; fi
            exit 0
            ;;
        *) echo "Invalid choice." ;;
    esac
done
