import uuid
from typing import Dict, List, Optional
from datetime import datetime
import random
import string
from pydantic import BaseModel

class ExamService:
    def __init__(self):
        self.exams = {}  # In-memory store for exams
    
    def list_exams(self) -> List[Dict]:
        """Return list of all exams"""
        return list(self.exams.values())
    
    def get_exam(self, exam_id: str) -> Optional[Dict]:
        """Get exam by ID"""
        return self.exams.get(exam_id)
    
    def create_exam(self, exam_data) -> Dict:
        """Create a new exam"""
        exam_id = str(uuid.uuid4())
        
        new_exam = {
            "id": exam_id,
            "title": exam_data.title,
            "duration": exam_data.duration,  # in minutes
            "questions": exam_data.questions,
            "scheduledFor": exam_data.scheduledFor or datetime.now().isoformat(),
            "createdAt": datetime.now().isoformat(),
            "status": "pending",  # pending, active, completed
            "roomCode": self.generate_room_code(),
            "participants": []  # will store participant IDs
        }
        
        self.exams[exam_id] = new_exam
        return new_exam
    
    def generate_room_code(self) -> str:
        """Generate a 6-character alphanumeric room code"""
        chars = string.ascii_uppercase + string.digits
        while True:
            code = ''.join(random.choice(chars) for _ in range(6))
            # Make sure code is unique
            if not any(exam.get('roomCode') == code for exam in self.exams.values()):
                return code