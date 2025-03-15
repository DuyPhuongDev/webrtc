// Student Client JavaScript

document.addEventListener('DOMContentLoaded', async function () {
    const permissionScreen = document.getElementById('permission-screen');
    const examContent = document.getElementById('exam-content');
    const webcamPreview = document.getElementById('webcam-preview');
    const localVideo = document.getElementById('local-video');
    const consentCheckbox = document.getElementById('consent-checkbox');
    const startExamBtn = document.getElementById('start-exam-btn');
    const questionContainer = document.getElementById('question-container');
    const questionCounter = document.getElementById('question-counter');
    const prevQuestionBtn = document.getElementById('prev-question-btn');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const examTimer = document.getElementById('exam-timer');
    const examName = document.getElementById('exam-name');
    const cameraStatus = document.getElementById('camera-status');
    const micStatus = document.getElementById('mic-status');
    const webrtcStatus = document.getElementById('webrtc-status');
    const proctorMessages = document.getElementById('proctor-messages');

    let stream = null;
    let socket = null;
    let currentExam = null;
    let currentQuestionIndex = 0;
    let answersData = {};
    let timerInterval = null;
    let remainingTime = 0; // in seconds

    // Initialize webcam preview and request media
    async function initializeWebcam() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            webcamPreview.srcObject = stream;
            localVideo.srcObject = stream;
            cameraStatus.textContent = 'Connected';
            micStatus.textContent = 'Connected';
        } catch (err) {
            console.error('Error accessing media devices:', err);
            cameraStatus.textContent = 'Failed';
            micStatus.textContent = 'Failed';
        }
    }

    // Enable start exam button when user consents
    consentCheckbox.addEventListener('change', function () {
        startExamBtn.disabled = !this.checked;
    });

    // Setup WebSocket and WebRTC signaling (simplified)
    async function setupWebRTC() {
        webrtcStatus.textContent = 'Connecting...';
        socket = new WebSocket(`ws://${window.location.hostname}:8000/ws`);

        socket.onopen = function () {
            socket.send(JSON.stringify({
                type: 'joinRoom',
                data: {
                    room: sessionStorage.getItem('examCode'),
                    username: sessionStorage.getItem('studentId'),
                    role: 'student'
                }
            }));
        };

        socket.onmessage = async function (event) {
            const message = JSON.parse(event.data);
            switch (message.type) {
                case 'roomJoined':
                    webrtcStatus.textContent = 'Connected';
                    // Initialize RTC here using message.data.rtpCapabilities
                    break;
                case 'transportCreated':
                    // Handle transport creation (exchange DTLS parameters here)
                    break;
                case 'newProducer':
                    // Handle new producer (if teacher media shows up)
                    break;
                case 'error':
                    console.error('Error:', message.data.message);
                    break;
            }
        };

        socket.onclose = () => {
            webrtcStatus.textContent = 'Disconnected';
        };

        socket.onerror = (err) => {
            console.error('WebSocket error:', err);
            webrtcStatus.textContent = 'Error';
        };
    }

    // Simulate fetching exam details with questions
    async function fetchExamDetails() {
        await new Promise(resolve => setTimeout(resolve, 1000));
        currentExam = {
            id: 'exam123',
            title: 'Computer Science Final Exam',
            duration: 60,
            questions: [
                {
                    id: 'q1',
                    text: 'What is the time complexity of binary search?',
                    type: 'multiple-choice',
                    options: [
                        { id: 'a', text: 'O(1)' },
                        { id: 'b', text: 'O(log n)' },
                        { id: 'c', text: 'O(n)' },
                        { id: 'd', text: 'O(n²)' }
                    ]
                },
                {
                    id: 'q2',
                    text: 'Explain recursion with a simple example.',
                    type: 'essay'
                }
            ]
        };

        examName.textContent = currentExam.title;
        remainingTime = currentExam.duration * 60;
        updateTimerDisplay();
        generateQuestionButtons();
        loadQuestion(0);
    }

    // Update exam timer display
    function updateTimerDisplay() {
        timerInterval = setInterval(() => {
            if (remainingTime <= 0) {
                clearInterval(timerInterval);
                // Auto submit exam logic here
            } else {
                remainingTime--;
                const hrs = String(Math.floor(remainingTime / 3600)).padStart(2, '0');
                const mins = String(Math.floor((remainingTime % 3600) / 60)).padStart(2, '0');
                const secs = String(remainingTime % 60).padStart(2, '0');
                examTimer.textContent = `${hrs}:${mins}:${secs}`;
            }
        }, 1000);
    }

    // Generate question navigation buttons
    function generateQuestionButtons() {
        const container = document.getElementById('question-buttons');
        container.innerHTML = '';
        currentExam.questions.forEach((q, index) => {
            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-primary';
            btn.textContent = index + 1;
            btn.addEventListener('click', () => loadQuestion(index));
            container.appendChild(btn);
        });
    }

    // Load a specific question into the container
    function loadQuestion(index) {
        if (!currentExam || !currentExam.questions[index]) return;
        currentQuestionIndex = index;
        const question = currentExam.questions[index];
        questionCounter.textContent = `Question ${index + 1} of ${currentExam.questions.length}`;
        prevQuestionBtn.disabled = index === 0;
        nextQuestionBtn.disabled = index === currentExam.questions.length - 1;
        questionContainer.innerHTML = '';

        const questionElem = document.createElement('div');
        questionElem.className = 'question';

        const questionText = document.createElement('h4');
        questionText.textContent = question.text;
        questionElem.appendChild(questionText);

        if (question.type === 'multiple-choice') {
            question.options.forEach(option => {
                const optionGroup = document.createElement('div');
                optionGroup.className = 'form-check mt-2';
                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `question-${question.id}`;
                input.id = `option-${question.id}-${option.id}`;
                input.value = option.id;
                if (answersData[question.id] === option.id) input.checked = true;

                const label = document.createElement('label');
                label.className = 'form-check-label';
                label.htmlFor = input.id;
                label.textContent = option.text;

                optionGroup.appendChild(input);
                optionGroup.appendChild(label);
                questionElem.appendChild(optionGroup);
            });
        }
        else if (question.type === 'essay') {
            const textarea = document.createElement('textarea');
            textarea.className = 'form-control mt-2';
            textarea.rows = 5;
            textarea.placeholder = 'Write your answer here...';
            textarea.value = answersData[question.id] || '';
            questionElem.appendChild(textarea);
        }

        questionContainer.appendChild(questionElem);
    }

    // Navigation button handlers
    prevQuestionBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) loadQuestion(currentQuestionIndex - 1);
    });
    nextQuestionBtn.addEventListener('click', () => {
        if (currentQuestionIndex < currentExam.questions.length - 1) loadQuestion(currentQuestionIndex + 1);
    });

    // Start Exam button handler
    startExamBtn.addEventListener('click', async function () {
        permissionScreen.style.display = 'none';
        examContent.style.display = 'block';
        await setupWebRTC();
        fetchExamDetails();
    });

    // Initialize webcam as soon as the page loads
    initializeWebcam();
});