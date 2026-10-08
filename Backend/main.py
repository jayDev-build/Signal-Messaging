from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import models
from database import engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Signal Messaging Backend")

from auth import router as auth_router
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from ws_manager import manager

@app.get("/")
def read_root():
    return {"status": "Backend is running"}

import json
from database import SessionLocal

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: int):
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_text()
            print(f"Received from {client_id}: {data}")
            
            try:
                payload = json.loads(data)
                if payload.get("type") in ["message_delivered", "message_read"]:
                    msg_id = payload.get("message_id")
                    sender_id = payload.get("sender_id")
                    new_status = payload.get("type").split("_")[1] # 'delivered' or 'read'
                    
                    db = SessionLocal()
                    try:
                        receipt = db.query(models.MessageReceipt).filter(
                            models.MessageReceipt.message_id == msg_id,
                            models.MessageReceipt.user_id == client_id
                        ).first()
                        
                        if receipt:
                            if new_status == "read" or (new_status == "delivered" and receipt.status == "sent"):
                                receipt.status = new_status
                                db.commit()
                                
                                await manager.send_personal_message(json.dumps({
                                    "type": "receipt_update",
                                    "message_id": msg_id,
                                    "status": new_status
                                }), sender_id)
                    finally:
                        db.close()
            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect(client_id)
