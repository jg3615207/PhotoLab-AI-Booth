#!/usr/bin/env bash
# ==========================================================
# PhotoLab AI Booth — macOS One-Click Installer Script
# ==========================================================
set -e

echo "----------------------------------------------------"
echo "🚀 Installing PhotoLab AI Booth on macOS..."
echo "----------------------------------------------------"

# 1. Determine script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# 2. Check for Python 3
PYTHON_BIN=""
if command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
elif command -v python &>/dev/null; then
    PYTHON_BIN="python"
else
    echo "❌ Error: Python 3 is not installed."
    echo "Please install Python 3 using Homebrew: brew install python"
    exit 1
fi

echo "✅ Found Python interpreter: $($PYTHON_BIN --version)"

# 3. Create virtual environment in server/venv
SERVER_DIR="$SCRIPT_DIR/server"
VENV_DIR="$SERVER_DIR/venv"

if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating Python virtual environment in server/venv..."
    $PYTHON_BIN -m venv "$VENV_DIR"
else
    echo "✅ Existing Python virtual environment found in server/venv."
fi

# 4. Activate virtual environment & upgrade pip
echo "⚡ Upgrading pip & installing backend requirements..."
source "$VENV_DIR/bin/activate"
pip install --upgrade pip
pip install -r "$SERVER_DIR/requirements.txt"

# 5. Build Frontend assets if Node/npm is present
if [ -d "$SCRIPT_DIR/frontend" ]; then
    if command -v npm &>/dev/null; then
        echo "🌐 Building React Frontend assets..."
        cd "$SCRIPT_DIR/frontend"
        npm install
        npm run build
        cd "$SCRIPT_DIR"
    else
        echo "⚠️ Note: npm is not installed. Using existing pre-built frontend/dist assets."
    fi
fi

# 6. Make launcher scripts executable
echo "🔧 Setting executable permissions for bash scripts..."
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

echo "----------------------------------------------------"
echo "🎉 Installation Complete!"
echo "To start PhotoLab AI Booth on macOS, run:"
echo "   ./start_all_mac.sh"
echo "----------------------------------------------------"
