import os
import uuid
from typing import Optional, Dict, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Import modules
from signaling import WebRTCSignaling
from exam_service import ExamService

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(title="Online Exam System API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize services
signaling_service = WebRTCSignaling()
exam_service = ExamService()

# Models
class ExamCreate(BaseModel):
    title: str
    duration: int
    questions: List[Dict]
    scheduledFor: Optional[str] = None


@app.get("/")
async def root():
    return {"message": "Online Exam System API"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Exam management endpoints
@app.get("/api/exams")
async def list_exams():
    return exam_service.list_exams()


@app.get("/api/exams/{exam_id}")
async def get_exam(exam_id: str):
    exam = exam_service.get_exam(exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found")
    return exam


@app.post("/api/exams")
async def create_exam(exam: ExamCreate):
    return exam_service.create_exam(exam)


# WebSocket for WebRTC signaling
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    client_id = str(uuid.uuid4())
    
    try:
        # Register the WebSocket connection
        await signaling_service.register_connection(client_id, websocket)
        
        while True:
            data = await websocket.receive_json()
            await signaling_service.handle_message(client_id, data)
    except WebSocketDisconnect:
        # Handle WebSocket disconnect
        await signaling_service.handle_disconnect(client_id)
    except Exception as e:
        print(f"Error in WebSocket: {e}")
        await signaling_service.handle_disconnect(client_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)