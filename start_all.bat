@echo off
title PhotoLab AI Booth - All-In-One (AIO) Launcher v1.0
color 0A

echo ===================================================================
echo             🚀 PhotoLab AI Booth - All-In-One (AIO) Launcher       
echo ===================================================================
echo.
echo Launching all core services in parallel...
echo.

:: 1. Start PhotoLab Backend Server (Watchdog)
echo [1/3] Starting PhotoLab Backend Server (Port 8765)...
start "PhotoLab Backend Server" cmd /k "title PhotoLab Backend Server && set PYTHONPATH=%~dp0server && "%~dp0server\venv\Scripts\python.exe" "%~dp0server\watchdog_runner.py""

:: Short pause for backend to initialize
timeout /t 3 /nobreak >nul

:: 2. Start Cloudflare Tunnel (photolab)
echo [2/3] Starting Cloudflare Tunnel (photolab.techno-film.com)...
start "PhotoLab Cloudflare Tunnel" cmd /k "title PhotoLab Cloudflare Tunnel && cloudflared tunnel run --url http://192.168.1.100:8765 photolab"

:: 3. Start Standalone Python Print Manager App
echo [3/3] Starting Standalone Python Print Manager & Queuer App...
start "PhotoLab Print Manager" cmd /k "title PhotoLab Print Manager && "%~dp0run_print_manager.bat""

echo.
echo ===================================================================
echo               ✅ ALL SERVICES LAUNCHED SUCCESSFULLY!               
echo ===================================================================
echo.
echo   🌐 Web Admin Dashboard : https://photolab.techno-film.com/admin.html
echo   📸 Kiosk User Interface: https://photolab.techno-film.com/
echo   💻 Local Host Access   : http://192.168.1.100:8765/
echo   🖨️ Standalone Print App: Running (Tkinter GUI active)
echo.
echo ===================================================================
echo   [1] Open Web Admin in Browser
echo   [2] Open Kiosk App in Browser
echo   [3] Exit Launcher (Services will remain running)
echo ===================================================================
echo.

:MENU
set /p choice="Enter option [1-3]: "
if "%choice%"=="1" start https://photolab.techno-film.com/admin.html & goto MENU
if "%choice%"=="2" start https://photolab.techno-film.com/ & goto MENU
if "%choice%"=="3" exit
goto MENU
