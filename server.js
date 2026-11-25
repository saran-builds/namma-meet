
const socket = io();

// HTML elements
const languageSelect = document.getElementById("language");
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

const endChatBtn = document.getElementById("endChatBtn");
const reportBtn = document.getElementById("reportBtn");
const blockBtn = document.getElementById("blockBtn");

let localStream = null;
let peerConnection = null;
let isInitiator = false;
let currentLanguage = "en";
let pendingCandidates = [];

// Language translations
const translations = {
    en: {
        subtitle: "Meet new people and make friends",
        languageLabel: "Language",
        youLabel: "You",
        strangerLabel: "Stranger",
        chatTitle: "Text Chat",
        welcomeMessage: "Welcome to NammaMeet! Click Start Chat to meet someone.",
        start: "Start Chat",
        next: "Next Stranger",
        send: "Send",
        video: "Start Video",
        endVideo: "End Video",
        endChat: "End Chat",
        report: "Report User",
        block: "Block User",
        placeholder: "Type your message...",
        waiting: "Waiting for a stranger...",
        connected: "Connected to a stranger!",
        disconnected: "Your stranger has left.",
        ended: "You ended the chat.",
        you: "You",
        stranger: "Stranger"
    },

    ta: {
        subtitle: "புதிய நபர்களை சந்தித்து நண்பர்களாகுங்கள்",
        languageLabel: "மொழி",
        youLabel: "நீங்கள்",
        strangerLabel: "அந்நியர்",
        chatTitle: "உரை அரட்டை",
        welcomeMessage: "NammaMeet-க்கு வரவேற்கிறோம்! ஒருவரை சந்திக்க Start Chat அழுத்தவும்.",
        start: "அரட்டையை தொடங்கு",
        next: "அடுத்த நபர்",
        send: "அனுப்பு",
        video: "வீடியோ தொடங்கு",
        endVideo: "வீடியோ முடி",
        endChat: "அரட்டையை முடி",
        report: "புகார் அளி",
        block: "தடு",
        placeholder: "உங்கள் செய்தியை எழுதுங்கள்...",
        waiting: "ஒருவருக்காக காத்திருக்கிறோம்...",
        connected: "ஒருவருடன் இணைக்கப்பட்டுள்ளீர்கள்!",
        disconnected: "மற்ற நபர் வெளியேறிவிட்டார்.",
        ended: "நீங்கள் அரட்டையை முடித்துவிட்டீர்கள்.",
        you: "நீங்கள்",
        stranger: "அந்நியர்"
    }
};

// Update page language
function updateLanguage() {
    currentLanguage = languageSelect.value;
    const t = translations[currentLanguage];

    document.getElementById("subtitle").textContent = t.subtitle;
    document.getElementById("languageLabel").textContent = t.languageLabel;
    document.getElementById("youLabel").textContent = t.youLabel;
    document.getElementById("strangerLabel").textContent = t.strangerLabel;
    document.getElementById("chatTitle").textContent = t.chatTitle;
    document.getElementById("welcomeMessage").textContent = t.welcomeMessage;

    startBtn.textContent = t.start;
    nextBtn.textContent = t.next;
    sendBtn.textContent = t.send;
    videoBtn.textContent = t.video;
    endVideoBtn.textContent = t.endVideo;
    endChatBtn.textContent = t.endChat;
    reportBtn.textContent = t.report;
    blockBtn.textContent = t.block;

    messageInput.placeholder = t.placeholder;
}

languageSelect.addEventListener("change", updateLanguage);
updateLanguage();

// Display a message in the chat
function showMessage(message, sender) {
    const messageElement = document.createElement("div");

    messageElement.className =
        sender === "You" ? "message you-message" : "message stranger-message";

    const senderElement = document.createElement("strong");
    senderElement.textContent =
        sender === "You"
            ? translations[currentLanguage].you
            : translations[currentLanguage].stranger;

    const textElement = document.createElement("span");
    textElement.textContent = message;

    messageElement.appendChild(senderElement);
    messageElement.appendChild(document.createElement("br"));
    messageElement.appendChild(textElement);

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Clear chat messages
function clearChat() {
    chatBox.innerHTML = "";
}

// Start matching
startBtn.addEventListener("click", () => {
    clearChat();
    stopVideo();

    statusText.textContent = translations[currentLanguage].waiting;
    socket.emit("start-chat");
});

// Waiting for stranger
socket.on("waiting", () => {
    statusText.textContent = translations[currentLanguage].waiting;
});

// Matched with stranger
socket.on("matched", data => {
    isInitiator = data.initiator;
    pendingCandidates = [];

    statusText.textContent = translations[currentLanguage].connected;
});

// Find next stranger
nextBtn.addEventListener("click", () => {
    stopVideo();
    clearChat();

    statusText.textContent = translations[currentLanguage].waiting;
    socket.emit("next-stranger");
});

// Stranger left
socket.on("partner-left", () => {
    stopVideo();

    statusText.textContent = translations[currentLanguage].disconnected;
});

// Send text message
function sendMessage() {
    const message = messageInput.value.trim();

    if (message === "") return;

    // IMPORTANT: Display your own message immediately.
    showMessage(message, "You");

    // Send message to the stranger.
    socket.emit("send-message", message);

    messageInput.value = "";
    messageInput.focus();
}

sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        sendMessage();
    }
});

// Receive message from stranger
socket.on("chat-message", message => {
    showMessage(message, "Stranger");
});

// -----------------------------
// VIDEO CHAT
// -----------------------------

const rtcConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

function createPeerConnection() {
    if (peerConnection) return;

    peerConnection = new RTCPeerConnection(rtcConfiguration);

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("video-candidate", event.candidate);
        }
    };

    peerConnection.ontrack = event => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onconnectionstatechange = () => {
        if (
            peerConnection &&
            ["failed", "closed", "disconnected"].includes(
                peerConnection.connectionState
            )
        ) {
            console.log("Video connection:", peerConnection.connectionState);
        }
    };

    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }
}

// Start camera and microphone
async function startVideo() {
    try {
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            localVideo.srcObject = localStream;
        }

        createPeerConnection();

        socket.emit("video-ready");

        videoBtn.disabled = true;
        endVideoBtn.disabled = false;

    } catch (error) {
        console.error("Camera or microphone error:", error);
        alert("Please allow camera and microphone access.");
    }
}

// Start video button
videoBtn.addEventListener("click", startVideo);

// Stranger is ready for video
socket.on("partner-video-ready", async () => {
    try {
        if (!peerConnection || !localStream) return;
        if (!isInitiator) return;

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        socket.emit("video-offer", offer);

    } catch (error) {
        console.error("Video offer error:", error);
    }
});

// Receive video offer
socket.on("video-offer", async offer => {
    try {
        if (!peerConnection) {
            await startVideo();
        }

        if (!peerConnection) return;

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );

        const answer = await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(answer);

        socket.emit("video-answer", answer);

        await processPendingCandidates();

    } catch (error) {
        console.error("Video offer handling error:", error);
    }
});

// Receive video answer
socket.on("video-answer", async answer => {
    try {
        if (!peerConnection) return;

        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
        );

        await processPendingCandidates();

    } catch (error) {
        console.error("Video answer error:", error);
    }
});

// Receive ICE candidates
socket.on("video-candidate", async candidate => {
    try {
        if (!peerConnection || !peerConnection.remoteDescription) {
            pendingCandidates.push(candidate);
            return;
        }

        await peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
        );

    } catch (error) {
        console.error("ICE candidate error:", error);
    }
});

// Process candidates received before remote description
async function processPendingCandidates() {
    if (!peerConnection || !peerConnection.remoteDescription) return;

    for (const candidate of pendingCandidates) {
        try {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } catch (error) {
            console.error("Pending ICE candidate error:", error);
        }
    }

    pendingCandidates = [];
}

// Stop video and microphone
function stopVideo() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    localVideo.srcObject = null;
    remoteVideo.srcObject = null;

    pendingCandidates = [];

    videoBtn.disabled = false;
    endVideoBtn.disabled = true;
}

// End video button
endVideoBtn.addEventListener("click", () => {
    socket.emit("end-video");
    stopVideo();
});

// Stranger ended video
socket.on("partner-video-ended", () => {
    stopVideo();
});

// -----------------------------
// SAFETY CONTROLS
// -----------------------------

// End chat
endChatBtn.addEventListener("click", () => {
    socket.emit("end-chat");

    stopVideo();
    clearChat();

    statusText.textContent = translations[currentLanguage].ended;
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

    statusText.textContent =
        "User blocked. You can find another stranger.";
});

socket.on("block-confirmed", () => {
    alert("User blocked successfully.");
});

socket.on("partner-blocked", () => {
    stopVideo();
    statusText.textContent = "This chat has ended.";
});

socket.on("chat-ended", () => {
    statusText.textContent = translations[currentLanguage].ended;
});
