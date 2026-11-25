
const socket = io();

// HTML elements
const language = document.getElementById("language");
const statusText = document.getElementById("status");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");

const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const sendBtn = document.getElementById("sendBtn");

const videoBtn = document.getElementById("videoBtn");
const endVideoBtn = document.getElementById("endVideoBtn");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

// Language translations
const translations = {
    en: {
        subtitle: "Meet new people through random video chat!",
        languageLabel: "Choose Language:",
        youLabel: "You",
        strangerLabel: "Stranger",
        chatTitle: "Text Chat",
        welcomeMessage: "Welcome! Start chatting with a stranger.",
        messagePlaceholder: "Type your message...",
        send: "Send",
        start: "Start Chat",
        next: "Next Stranger",
        video: "📹 Start Video Chat",
        endVideo: "End Video Chat",
        waiting: "Waiting to connect...",
        searching: "Finding a stranger...",
        connected: "Connected to a stranger!",
        disconnected: "Stranger disconnected.",
        enterMessage: "Please type a message.",
        cameraError: "Camera or microphone access failed. Please allow permission.",
        videoStarted: "Video chat started!",
        videoEnded: "Video chat ended."
    },

    ta: {
        subtitle: "புதிய நபர்களுடன் வீடியோ அரட்டை செய்யுங்கள்!",
        languageLabel: "மொழியைத் தேர்ந்தெடுக்கவும்:",
        youLabel: "நீங்கள்",
        strangerLabel: "அந்நியர்",
        chatTitle: "உரை அரட்டை",
        welcomeMessage: "வரவேற்கிறோம்! அரட்டையைத் தொடங்குங்கள்.",
        messagePlaceholder: "உங்கள் செய்தியை எழுதுங்கள்...",
        send: "அனுப்பு",
        start: "அரட்டையைத் தொடங்கு",
        next: "அடுத்த நபர்",
        video: "📹 வீடியோ அரட்டையைத் தொடங்கு",
        endVideo: "வீடியோ அரட்டையை முடி",
        waiting: "இணைப்பிற்காக காத்திருக்கிறது...",
        searching: "ஒருவரைத் தேடுகிறது...",
        connected: "ஒருவருடன் இணைக்கப்பட்டுள்ளீர்கள்!",
        disconnected: "மற்ற நபர் வெளியேறிவிட்டார்.",
        enterMessage: "ஒரு செய்தியை எழுதுங்கள்.",
        cameraError: "கேமரா அல்லது மைக்ரோஃபோன் அனுமதியை வழங்கவும்.",
        videoStarted: "வீடியோ அரட்டை தொடங்கியது!",
        videoEnded: "வீடியோ அரட்டை முடிந்தது."
    }
};

// Apply selected language
function updateLanguage() {
    const t = translations[language.value];

    document.getElementById("subtitle").textContent = t.subtitle;
    document.getElementById("languageLabel").textContent = t.languageLabel;
    document.getElementById("youLabel").textContent = t.youLabel;
    document.getElementById("strangerLabel").textContent = t.strangerLabel;
    document.getElementById("chatTitle").textContent = t.chatTitle;
    document.getElementById("welcomeMessage").textContent = t.welcomeMessage;
    messageInput.placeholder = t.messagePlaceholder;

    sendBtn.textContent = t.send;
    startBtn.textContent = t.start;
    nextBtn.textContent = t.next;
    videoBtn.textContent = t.video;
    endVideoBtn.textContent = t.endVideo;
}

language.addEventListener("change", updateLanguage);
updateLanguage();

// WebRTC variables
let localStream = null;
let peerConnection = null;
let isInitiator = false;
let partnerReady = false;
let pendingCandidates = [];

const configuration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

// Start random chat
startBtn.addEventListener("click", () => {
    socket.emit("start-chat");
    statusText.textContent = translations[language.value].searching;
});

// Find next stranger
nextBtn.addEventListener("click", () => {
    stopVideo();
    socket.emit("next-stranger");
    chatBox.innerHTML = "";
    statusText.textContent = translations[language.value].searching;
});

// Send text message
function sendMessage() {
    const message = messageInput.value.trim();

    if (message === "") {
        alert(translations[language.value].enterMessage);
        return;
    }

    socket.emit("send-message", message);
    messageInput.value = "";
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// Receive text messages
socket.on("chat-message", (message) => {
    const p = document.createElement("p");
    p.textContent = message;
    chatBox.appendChild(p);
    chatBox.scrollTop = chatBox.scrollHeight;
});

// Matching events
socket.on("waiting", () => {
    statusText.textContent = translations[language.value].waiting;
});

socket.on("matched", (data) => {
    isInitiator = data.initiator;
    partnerReady = false;
    pendingCandidates = [];

    statusText.textContent = translations[language.value].connected;
});

socket.on("partner-left", () => {
    stopVideo();
    statusText.textContent = translations[language.value].disconnected;
});

// Start camera and microphone
videoBtn.addEventListener("click", async () => {
    try {
        if (localStream) return;

        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        localVideo.srcObject = localStream;

        partnerReady = false;
        pendingCandidates = [];

        socket.emit("video-ready");

        statusText.textContent =
            translations[language.value].videoStarted;

    } catch (error) {
        console.error("Camera error:", error);
        alert(translations[language.value].cameraError);
    }
});

// Create WebRTC connection
function createPeerConnection() {
    if (peerConnection) return;

    peerConnection = new RTCPeerConnection(configuration);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("video-candidate", event.candidate);
        }
    };

    peerConnection.onconnectionstatechange = () => {
        console.log("Video connection:", peerConnection.connectionState);

        if (
            peerConnection.connectionState === "failed" ||
            peerConnection.connectionState === "disconnected"
        ) {
            remoteVideo.srcObject = null;
        }
    };
}

// Both users must enable video
socket.on("partner-video-ready", async () => {
    partnerReady = true;

    if (!localStream) return;

    createPeerConnection();

    if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        socket.emit("video-offer", offer);
    }
});

// Receive video offer
socket.on("video-offer", async (offer) => {
    if (!localStream) return;

    createPeerConnection();

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer)
    );

    const answer = await peerConnection.createAnswer();

    await peerConnection.setLocalDescription(answer);

    socket.emit("video-answer", answer);

    for (const candidate of pendingCandidates) {
        await peerConnection.addIceCandidate(candidate);
    }

    pendingCandidates = [];
});

// Receive video answer
socket.on("video-answer", async (answer) => {
    if (!peerConnection) return;

    await peerConnection.setRemoteDescription(
        new RTCSessionDescription(answer)
    );

    for (const candidate of pendingCandidates) {
        await peerConnection.addIceCandidate(candidate);
    }

    pendingCandidates = [];
});

// Receive ICE candidates
socket.on("video-candidate", async (candidate) => {
    if (!peerConnection || !peerConnection.remoteDescription) {
        pendingCandidates.push(candidate);
        return;
    }

    try {
        await peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
        );
    } catch (error) {
        console.error("ICE candidate error:", error);
    }
});

// Stop video
function stopVideo() {
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    partnerReady = false;
    pendingCandidates = [];
}

// End video button
endVideoBtn.addEventListener("click", () => {
    socket.emit("end-video");
    stopVideo();

    statusText.textContent =
        translations[language.value].videoEnded;
});

const endChatBtn = document.getElementById("endChatBtn");
const reportBtn = document.getElementById("reportBtn");
const blockBtn = document.getElementById("blockBtn");

// End current chat
endChatBtn.addEventListener("click", () => {
    socket.emit("end-chat");

    stopVideo();

    chatBox.innerHTML = "";
    statusText.textContent = "You ended the chat.";
});

// Report user
reportBtn.addEventListener("click", () => {
    const reason = prompt(
        "Why are you reporting this user?\n\n" +
        "1. Inappropriate behaviour\n" +
        "2. Harassment or bullying\n" +
        "3. Nudity or sexual content\n" +
        "4. Spam or scam\n" +
        "5. Other\n\n" +
        "Enter a number from 1 to 5:"
    );

    const reasons = {
        "1": "Inappropriate behaviour",
        "2": "Harassment or bullying",
        "3": "Nudity or sexual content",
        "4": "Spam or scam",
        "5": "Other"
    };

    if (!reason) return;

    if (!reasons[reason]) {
        alert("Please enter a number from 1 to 5.");
        return;
    }

    socket.emit("report-user", reasons[reason]);
});

// Report confirmation
socket.on("report-received", () => {
    alert("Thank you. Your report has been received.");
});

// Block user
blockBtn.addEventListener("click", () => {
    const confirmBlock = confirm(
        "Are you sure you want to block this user?"
    );

    if (!confirmBlock) return;

    socket.emit("block-user");
    stopVideo();

    statusText.textContent = "User blocked. You can find another stranger.";
});

// Block confirmation
socket.on("block-confirmed", () => {
    alert("User blocked successfully.");
});

// Other user was blocked
socket.on("partner-blocked", () => {
    stopVideo();
    statusText.textContent = "This chat has ended.";
});

// Chat ended confirmation
socket.on("chat-ended", () => {
    statusText.textContent = "You ended the chat.";
});
