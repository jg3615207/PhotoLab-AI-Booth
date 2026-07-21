@echo off
set PYTHONPATH=%~dp0server
"%~dp0server\venv\Scripts\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8765
