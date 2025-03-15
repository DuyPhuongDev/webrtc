# Online Exam System

This project is an online exam system that uses WebRTC SFU for video/audio monitoring. The student takes exams with webcam and microphone streams being sent to the proctor, while the teacher can join the exam room to oversee all students.

## Prerequisites

- Docker and Docker Compose installed on your machine.
- (Optional) A compatible browser with support for WebRTC.
- (Optional) A `.env` file in the project root if you need to adjust environment variables (such as `ANNOUNCED_IP`).

## Project Structure

```
online-exam-system/
├── backend/              # FastAPI-based backend with signaling server and exam services
│   ├── Dockerfile
│   ├── main.py
│   ├── exam_service.py
│   ├── signaling.py
│   ├── webrtc.py
│   └── requirements.txt
├── frontend/             # Frontend code in HTML, CSS, JS with Bootstrap
│   ├── index.html
│   ├── student/
│   │   ├── exam.html
│   │   └── js/
│   │       └── student-client.js
│   ├── teacher/
│   │   ├── dashboard.html
│   │   ├── monitor.html
│   │   └── js/
│   │       └── teacher-client.js
│   ├── css/
│   │   └── main.css
│   └── js/
│       ├── common.js
│       └── webrtc-handler.js
├── docker-compose.yml    # Docker Compose file for the project
└── README.md             # This file
```

## Running the Project

1. **Clone the Repository**

   Clone the repository from GitHub:

   ```bash
   git clone https://github.com/DuyPhuongDev/webrtc.git
   cd webrtc
   ```

2. **Set Up Environment Variables (Optional)**

   If needed, create a `.env` file in the project root with environment variables required by the backend. Example:

   ```dotenv
   ANNOUNCED_IP=127.0.0.1
   ENVIRONMENT=production
   ```

3. **Build and Run Using Docker Compose**

   The project uses Docker Compose to run both the backend and frontend services. Run the following command in the project root:

   ```bash
   docker-compose up --build
   ```

   This will build the backend image, start the FastAPI backend on port 8000, and the frontend will be served via an Nginx container on port 80.

4. **Access the Application**

   - **Student Portal:** Open your browser to `http://localhost` and click on the "Student Portal" card.
   - **Teacher Portal:** Open your browser to `http://localhost` and click on the "Teacher Portal" card.
   - The backend API will be available at `http://localhost:8000/api`.

5. **Stopping the Project**

   To stop the running containers, use:

   ```bash
   docker-compose down
   ```

## Additional Notes

- The project uses WebRTC for real-time streaming. Make sure you use a supported browser (Chrome, Firefox, Edge).
- For development, you can run the backend without Docker using:
  ```bash
  pip install -r backend/requirements.txt
  cd backend
  uvicorn main:app --host 0.0.0.0 --port 8000
  ```
- If you make changes to the code, re-run `docker-compose up --build` to rebuild the Docker images.

Happy testing!
