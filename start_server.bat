@echo off
set PYTHONPATH=%~dp0server
"%~dp0server\venv\Scripts\python.exe" "%~dp0server\watchdog_runner.py"
