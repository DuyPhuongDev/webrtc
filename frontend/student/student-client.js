// Student Client JavaScript
document.addEventListener('DOMContentLoaded', async function () {
    // DOM Elements
    const permissionScreen = document.getElementById('permission-screen');
    const examContent = document.getElementById('exam-content');
    const webcamPreview = document.getElementById('webcam-preview');
    const localVideo = document.getElementById('local-video');
    const consentCheckbox = document.getElementById('consent-checkbox');
    const startExamBtn = document.getElementById('start-exam-btn');
    const submitExamBtn = document.getElementById('submit-exam-btn');
    const confirmSubmitBtn = document.getElementById('confirm-submit-btn');
    const questionContainer = document.getElementById('question-container');
    const questionCounter = document.getElementById('question-counter');
    const prevQuestionBtn = document.getElementById('prev-question-btn');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const questionButtons = document.getElementById('question-buttons');
    const examTimer = document.getElementById('exam-timer');
    const examName = document.getElementById('exam-name');
    const cameraStatus = document.getElementById('camera-status');
    const micStatus = document.getElementById('mic-status');
    const webrtcStatus = document.getElementById('webrtc-status');
    const proctorMessages = document.getElementById('proctor-messages');

    // Modals
    const warningModal = new bootstrap.Modal(document.getElementById('warningModal'));
    const submitModal = new bootstrap.Modal(document.getElementById('submitModal'));

    // Get exam info from session storage
    const studentId = sessionStorage.getItem('studentId') || 'student123';
    const examCode = sessionStorage.getItem('examCode') || 'EXAM001';

    // WebRTC variables
    let stream = null;
    let webrtcConnection = null;
    let socket = null;

    // Exam state variables
    let currentExam = null;
    let currentQuestionIndex = 0;
    let answersData = {};
    let timerInterval = null;
    let remainingTime = 0; // in seconds

    // Initialize webcam preview
    async function initializeWebcam() {
        try {
            // Request permission for camera and microphone
            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            // Set up preview videos
            webcamPreview.srcObject = stream;
            localVideo.srcObject = stream;

            // Enable start exam button when consent is given
            consentCheckbox.addEventListener('change', function () {
                startExamBtn.disabled = !this.checked;
            });

            // Update status elements
            cameraStatus.innerHTML = 'Connected';
            micStatus.innerHTML = 'Connected';

        } catch (err) {
            console.error('Error accessing media devices:', err);
            showWarning('Camera or microphone access denied. This is required for the exam.');
            cameraStatus.innerHTML = 'Failed';
            cameraStatus.className = 'badge bg-danger rounded-pill';
            micStatus.innerHTML = 'Failed';
            micStatus.className = 'badge bg-danger rounded-pill';
        }
    }

    // Connect to signaling server and setup WebRTC
    async function setupWebRTC() {
        try {
            webrtcStatus.innerHTML = 'Connecting...';
            webrtcStatus.className = 'badge bg-warning rounded-pill';

            // Create WebSocket connection
            socket = new WebSocket(`ws://${window.location.hostname}:8000/ws`);

            socket.onopen = function () {
                console.log('WebSocket connection established');

                // Join exam room
                socket.send(JSON.stringify({
                    type: 'joinRoom',
                    data: {
                        room: examCode,
                        username: studentId,
                        role: 'student'
                    }
                }));
            };

            socket.onmessage = async function (event) {
                const message = JSON.parse(event.data);

                switch (message.type) {
                    case 'roomJoined':
                        webrtcStatus.innerHTML = 'Connected';
                        webrtcStatus.className = 'badge bg-success rounded-pill';

                        // Initialize WebRTC with the received RTP capabilities
                        await initializeRTC(message.data);
                        break;

                    case 'transportCreated':
                        await handleTransportCreated(message.data);
                        break;

                    case 'transportConnected':
                        console.log('Transport connected:', message.data);
                        break;

                    case 'producerCreated':
                        console.log('Producer created:', message.data);
                        break;

                    case 'newProducer':
                        // This would be for teacher's webcam if we want to show it
                        console.log('New producer available:', message.data);
                        break;

                    case 'userJoined':
                        // A teacher has joined the room
                        if (message.data.role === 'teacher') {
                            addProctorMessage(`Teacher ${message.data.name} has joined the monitoring session`);
                        }
                        break;

                    case 'userLeft':
                        console.log('User left:', message.data);
                        break;

                    case 'error':
                        console.error('Error from server:', message.data);
                        showWarning(`Connection error: ${message.data.message}`);
                        break;

                    case 'proctorMessage':
                        // Display a message from the proctor
                        addProctorMessage(message.data.message);
                        break;
                }
            };

            socket.onclose = function () {
                console.log('WebSocket connection closed');
                webrtcStatus.innerHTML = 'Disconnected';
                webrtcStatus.className = 'badge bg-danger rounded-pill';
                showWarning('Connection to server lost. Please refresh to reconnect.');
            };

            socket.onerror = function (error) {
                console.error('WebSocket error:', error);
                webrtcStatus.innerHTML = 'Error';
                webrtcStatus.className = 'badge bg-danger rounded-pill';
            };

        } catch (error) {
            console.error('Error setting up WebRTC:', error);
            showWarning('Failed to connect to exam server. Please refresh the page.');
            webrtcStatus.innerHTML = 'Failed';
            webrtcStatus.className = 'badge bg-danger rounded-pill';
        }
    }

    // Initialize WebRTC connection
    async function initializeRTC(roomData) {
        // Create WebRTC device
        // Note: In a real implementation, this would use mediasoup-client
        console.log('Initializing WebRTC with room data:', roomData);

        // Request a WebRTC transport for sending our media
        socket.send(JSON.stringify({
            type: 'createWebRtcTransport',
            data: { sender: true }
        }));
    }

    // Handle the created transport
    async function handleTransportCreated(transportData) {
        console.log('Transport created:', transportData);

        // Connect transport (this would include SDP exchange in a real implementation)
        socket.send(JSON.stringify({
            type: 'connectTransport',
            data: {
                transportId: transportData.id,
                dtlsParameters: {
                    // In a real implementation, these would be real DTLS parameters
                    role: 'client',
                    fingerprints: [
                        {
                            algorithm: 'sha-256',
                            value: 'E7:2E:F8:8B:27:3F:D8:DE:95:AA:DA:77:6C:32:69:9D:93:AE:3D:16:4A:CF:44:3D:85:5E:41:43:AD:51:7B:10'
                        }
                    ]
                }
            }
        }));

        // Start producing video and audio
        if (stream) {
            // In a real implementation, we'd get the tracks from the stream
            // and create producers for them
            stream.getTracks().forEach(track => {
                socket.send(JSON.stringify({
                    type: 'produce',
                    data: {
                        transportId: transportData.id,
                        kind: track.kind,
                        rtpParameters: {
                            // Real RTP parameters would go here
                            codecs: [
                                {
                                    mimeType: track.kind === 'video' ? 'video/VP8' : 'audio/opus',
                                    payloadType: track.kind === 'video' ? 96 : 111,
                                    clockRate: track.kind === 'video' ? 90000 : 48000,
                                    parameters: {}
                                }
                            ],
                            encodings: [{ ssrc: Math.floor(Math.random() * 1000000) }]
                        }
                    }
                }));
            });
        }
    }

    // Fetch exam details and questions
    async function fetchExamDetails() {
        try {
            // This would normally be an API call to your backend
            // For now, we'll use mock data

            // Simulate API call delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            currentExam = {
                id: 'exam123',
                title: 'Computer Science Final Exam',
                duration: 60, // minutes
                questions: [
                    {
                        id: 'q1',
                        text: 'What is the time complexity of a binary search?',
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
                        text: 'Which of the following is not a primitive data type in JavaScript?',
                        type: 'multiple-choice',
                        options: [
                            { id: 'a', text: 'String' },
                            { id: 'b', text: 'Number' },
                            { id: 'c', text: 'Object' },
                            { id: 'd', text: 'Boolean' }
                        ]
                    },
                    {
                        id: 'q3',
                        text: 'Explain the concept of recursion and provide a simple example.',
                        type: 'essay'
                    },
                    {
                        id: 'q4',
                        text: 'Which of the following data structures uses LIFO (Last In First Out)?',
                        type: 'multiple-choice',
                        options: [
                            { id: 'a', text: 'Queue' },
                            { id: 'b', text: 'Stack' },
                            { id: 'c', text: 'Linked List' },
                            { id: 'd', text: 'Binary Tree' }
                        ]
                    },
                    {
                        id: 'q5',
                        text: 'What is the purpose of the "this" keyword in JavaScript?',
                        type: 'essay'
                    }
                ]
            };

            // Update UI with exam details
            examName.textContent = currentExam.title;

            // Set up the exam timer
            remainingTime = currentExam.duration * 60; // convert to seconds
            updateTimerDisplay();

            // Create question navigation buttons
            generateQuestionButtons();

            // Load the first question
            loadQuestion(0);

        } catch (error) {
            console.error('Error fetching exam details:', error);
            showWarning('Failed to load exam details. Please refresh the page.');
        }
    }

    // Load a question by index
    function loadQuestion(index) {
        if (!currentExam || !currentExam.questions[index]) return;

        currentQuestionIndex = index;
        const question = currentExam.questions[index];

        // Update question counter
        questionCounter.textContent = `Question ${index + 1} of ${currentExam.questions.length}`;

        // Enable/disable navigation buttons
        prevQuestionBtn.disabled = index === 0;
        nextQuestionBtn.disabled = index === currentExam.questions.length - 1;

        // Update question navigation buttons
        updateQuestionButtonStyles();

        // Clear previous question
        questionContainer.innerHTML = '';

        // Create question element
        const questionElement = document.createElement('div');
        questionElement.className = 'question-item';

        // Question text
        const questionText = document.createElement('div');
        questionText.className = 'question-text mb-4';
        questionText.textContent = question.text;
        questionElement.appendChild(questionText);

        // Create input based on question type
        if (question.type === 'multiple-choice') {
            const optionsContainer = document.createElement('div');
            optionsContainer.className = 'options-container';

            question.options.forEach(option => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'form-check mb-2';

                const input = document.createElement('input');
                input.type = 'radio';
                input.name = `question-${question.id}`;
                input.id = `option-${question.id}-${option.id}`;
                input.value = option.id;
                input.className = 'form-check-input';

                // Check if this option is selected in our answers data
                if (answersData[question.id] === option.id) {
                    input.checked = true;
                }

                // Add change event listener
                input.addEventListener('change', () => {
                    answersData[question.id] = option.id;
                    updateQuestionButtonStyles();
                });

                const label = document.createElement('label');
                label.htmlFor = `option-${question.id}-${option.id}`;
                label.className = 'form-check-label';
                label.textContent = option.text;

                optionDiv.appendChild(input);
                optionDiv.appendChild(label);
                optionsContainer.appendChild(optionDiv);
            });

            questionElement.appendChild(optionsContainer);
        } else if (question.type === 'essay') {
            const textareaContainer = document.createElement('div');
            textareaContainer.className = 'essay-container';

            const textarea = document.createElement('textarea');
            textarea.className = 'form-control';
            textarea.rows = 6;
            textarea.id = `answer-${question.id}`;
            textarea.placeholder = 'Type your answer here...';

            // Set value if we have an answer
            if (answersData[question.id]) {
                textarea.value = answersData[question.id];
            }

            // Add input event listener
            textarea.addEventListener('input', () => {
                answersData[question.id] = textarea.value;
                updateQuestionButtonStyles();
            });

            textareaContainer.appendChild(textarea);
            questionElement.appendChild(textareaContainer);
        }

        // Add save button for this question
        const saveButton = document.createElement('button');
        saveButton.className = 'btn btn-sm btn-outline-success mt-3';
        saveButton.textContent = 'Save Answer';
        saveButton.addEventListener('click', () => {
            saveAnswer(question.id);
        });
        questionElement.appendChild(saveButton);

        // Add the question to the container
        questionContainer.appendChild(questionElement);
    }

    // Generate buttons for question navigation
    function generateQuestionButtons() {
        questionButtons.innerHTML = '';

        if (!currentExam) return;

        currentExam.questions.forEach((question, index) => {
            const button = document.createElement('button');
            button.className = 'btn btn-outline-secondary question-nav-btn';
            button.textContent = index + 1;
            button.setAttribute('data-index', index);
            button.setAttribute('data-question-id', question.id);

            button.addEventListener('click', () => {
                loadQuestion(index);
            });

            questionButtons.appendChild(button);
        });

        updateQuestionButtonStyles();
    }

    // Update the styles of question navigation buttons
    function updateQuestionButtonStyles() {
        if (!currentExam) return;

        const buttons = questionButtons.querySelectorAll('.question-nav-btn');

        buttons.forEach((button, index) => {
            // Remove all existing classes except the base
            button.className = 'btn question-nav-btn';

            const questionId = button.getAttribute('data-question-id');

            if (index === currentQuestionIndex) {
                button.classList.add('btn-primary');
            } else if (answersData[questionId]) {
                button.classList.add('btn-success');
            } else {
                button.classList.add('btn-outline-secondary');
            }
        });
    }

    // Save answer for the current question
    function saveAnswer(questionId) {
        const question = currentExam.questions.find(q => q.id === questionId);
        if (!question) return;

        if (question.type === 'multiple-choice') {
            const selectedOption = document.querySelector(`input[name="question-${questionId}"]:checked`);
            if (selectedOption) {
                answersData[questionId] = selectedOption.value;
            }
        } else if (question.type === 'essay') {
            const textarea = document.getElementById(`answer-${questionId}`);
            if (textarea) {
                answersData[questionId] = textarea.value;
            }
        }

        updateQuestionButtonStyles();
    }

    // Update timer display
    function updateTimerDisplay() {
        const hours = Math.floor(remainingTime / 3600);
        const minutes = Math.floor((remainingTime % 3600) / 60);
        const seconds = remainingTime % 60;

        examTimer.textContent = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        // Change color when time is running out (less than 5 minutes)
        if (remainingTime < 300) {
            examTimer.classList.add('text-danger');
        } else {
            examTimer.classList.remove('text-danger');
        }
    }

    // Start the exam timer
    function startTimer() {
        if (timerInterval) clearInterval(timerInterval);

        timerInterval = setInterval(() => {
            remainingTime--;

            if (remainingTime <= 0) {
                // Time's up, force submission
                clearInterval(timerInterval);
                submitExam();
            } else {
                updateTimerDisplay();
            }
        }, 1000);
    }

    // Submit the exam
    async function submitExam() {
        clearInterval(timerInterval);

        // Here, you would send answers to the server
        console.log('Submitting exam answers:', answersData);

        // Send exam data to server
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                type: 'submitExam',
                data: {
                    examId: currentExam.id,
                    studentId: studentId,
                    answers: answersData,
                    remainingTime: remainingTime
                }
            }));
        }

        // Close the connection
        if (socket) {
            socket.close();
        }

        // Stop all tracks in the stream
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        // Redirect to completion page or show completion message
        alert('Exam submitted successfully!');
        window.location.href = '../index.html';
    }

    // Show a warning message
    function showWarning(message) {
        const warningMessageElem = document.getElementById('warning-message');
        warningMessageElem.textContent = message;
        warningModal.show();
    }

    // Add a message from the proctor
    function addProctorMessage(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'proctor-message mb-2';

        const timestamp = new Date();
        const timeStr = `${timestamp.getHours().toString().padStart(2, '0')}:${timestamp.getMinutes().toString().padStart(2, '0')}`;

        messageElement.innerHTML = `<span class="time">[${timeStr}]</span> <span class="message">${message}</span>`;

        // Clear "no messages" text
        if (proctorMessages.querySelector('.text-muted')) {
            proctorMessages.innerHTML = '';
        }

        proctorMessages.appendChild(messageElement);

        // Scroll to bottom
        proctorMessages.scrollTop = proctorMessages.scrollHeight;
    }

    // Initialize the application
    async function init() {
        await initializeWebcam();

        // Set up event listeners
        startExamBtn.addEventListener('click', async () => {
            // Show exam content, hide permission screen
            permissionScreen.style.display = 'none';
            examContent.style.display = 'block';

            // Set up WebRTC connection
            await setupWebRTC();

            // Fetch exam details and start exam
            await fetchExamDetails();

            // Start the timer
            startTimer();
        });

        submitExamBtn.addEventListener('click', () => {
            // Show confirmation modal
            submitModal.show();
        });

        confirmSubmitBtn.addEventListener('click', () => {
            submitModal.hide();
            submitExam();
        });

        prevQuestionBtn.addEventListener('click', () => {
            if (currentQuestionIndex > 0) {
                loadQuestion(currentQuestionIndex - 1);
            }
        });

        nextQuestionBtn.addEventListener('click', () => {
            if (currentQuestionIndex < currentExam?.questions.length - 1) {
                loadQuestion(currentQuestionIndex + 1);
            }
        });
    }

    // Start the app
    init();
});