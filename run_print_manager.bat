@echo off
title PhotoLab Standalone Print Manager & Queuer
echo Starting PhotoLab Standalone Print Manager & Queuer...
set PYTHONPATH=%~dp0server
"%~dp0server\venv\Scripts\python.exe" "%~dp0print_manager_app.py"
pause
