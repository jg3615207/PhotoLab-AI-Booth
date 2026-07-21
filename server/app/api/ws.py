import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict

router = APIRouter()

main_loop = None

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.admin_connections = []

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_connections[session_id] = websocket

    def disconnect(self, session_id: str):
        if session_id in self.active_connections:
            del self.active_connections[session_id]

    async def connect_admin(self, websocket: WebSocket):
        await websocket.accept()
        self.admin_connections.append(websocket)

    def disconnect_admin(self, websocket: WebSocket):
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)

    async def broadcast_admin(self):
        for ws in self.admin_connections:
            try:
                await ws.send_json({"event": "job_update"})
            except Exception:
                pass

    async def send_status(self, session_id: str, status: str, output_image: str = None, error_message: str = None):
        if session_id in self.active_connections:
            websocket = self.active_connections[session_id]
            data = {"status": status}
            if output_image:
                data["output_image"] = output_image
            if error_message:
                data["error_message"] = error_message
            try:
                await websocket.send_json(data)
            except Exception:
                self.disconnect(session_id)

manager = ConnectionManager()

def broadcast_job_update(job_id: str, status: str, output_image: str = None, error_message: str = None):
    if main_loop:
        if job_id in manager.active_connections:
            main_loop.call_soon_threadsafe(
                lambda: asyncio.create_task(manager.send_status(job_id, status, output_image, error_message))
            )
        if manager.admin_connections:
            main_loop.call_soon_threadsafe(
                lambda: asyncio.create_task(manager.broadcast_admin())
            )

@router.websocket("/ws/jobs/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await manager.connect(websocket, session_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(session_id)

@router.websocket("/ws/admin")
async def websocket_admin_endpoint(websocket: WebSocket):
    await manager.connect_admin(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_admin(websocket)
