// Teacher Client JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Parse room code from query params
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room') || 'EXAM001';
    document.getElementById('room-code-display').textContent = `Room: ${roomCode}`;

    const studentsContainer = document.getElementById('students-container');
    let socket = null;

    // For this demo, assume teacher client tracks active producers from students
    let studentFeeds = {}; // Maps studentId to video element

    // Connect to the WebSocket signaling server
    function setupWebSocket() {
        socket = new WebSocket(`ws://${window.location.hostname}:8000/ws`);

        socket.onopen = function () {
            console.log('Teacher WebSocket connected');
            // Join room as teacher
            socket.send(JSON.stringify({
                type: 'joinRoom',
                data: {
                    room: roomCode,
                    username: sessionStorage.getItem('teacherId') || 'Teacher001',
                    role: 'teacher'
                }
            }));
        };

        socket.onmessage = function (event) {
            const message = JSON.parse(event.data);
            console.log('Teacher received:', message);

            switch (message.type) {
                case 'userJoined':
                    // When a student joins, add a placeholder for their video feed
                    addStudentFeed(message.data);
                    break;
                case 'newProducer':
                    // When a student starts producing, teacher may display or update status.
                    updateStudentFeed(message.data);
                    break;
                case 'userLeft':
                    removeStudentFeed(message.data.userId);
                    break;
                case 'error':
                    console.error('Error:', message.data.message);
                    break;
            }
        };

        socket.onclose = function () {
            console.log('Teacher WebSocket disconnected');
        };

        socket.onerror = function (err) {
            console.error('Teacher WebSocket error:', err);
        };
    }

    // Add a placeholder card for new student feed
    function addStudentFeed(data) {
        const studentId = data.id;
        if (studentFeeds[studentId]) return;

        const col = document.createElement('div');
        col.className = 'col-md-4 mb-4';
        col.id = `student-${studentId}`;

        const card = document.createElement('div');
        card.className = 'card shadow-sm';

        const cardBody = document.createElement('div');
        cardBody.className = 'card-body p-2';

        const video = document.createElement('video');
        video.id = `video-${studentId}`;
        video.className = 'w-100 rounded';
        video.autoplay = true;
        video.playsInline = true;
        // In a real-world setup, the teacher's client would consume the student's media stream via WebRTC.
        // Here we use a placeholder.
        video.src = 'https://via.placeholder.com/300x200?text=No+Feed';

        const title = document.createElement('h6');
        title.className = 'mt-2 text-center';
        title.textContent = `Student ${studentId}`;

        cardBody.appendChild(video);
        cardBody.appendChild(title);
        card.appendChild(cardBody);
        col.appendChild(card);

        studentsContainer.appendChild(col);
        studentFeeds[studentId] = video;
    }

    // Update student's feed status (for example, when a new producer is created)
    function updateStudentFeed(data) {
        const studentId = data.producerUserId;
        console.log(`Update feed for student: ${studentId}`);
        // In a real implementation, teacher would consume the student's stream.
    }

    // Remove student's feed if they leave
    function removeStudentFeed(studentId) {
        const el = document.getElementById(`student-${studentId}`);
        if (el) el.remove();
        delete studentFeeds[studentId];
    }

    // Initialize connection
    setupWebSocket();
});