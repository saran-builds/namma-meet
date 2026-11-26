
const socket = io();

// ================================
// HTML ELEMENTS
// ================================

const languageSelect = document.getElementById("language");
const statusText = document.getElementById("status");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");

const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const sendBtn = document.getElementById("sendBtn");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

const endChatBtn = document.getElementById("endChatBtn");
const reportBtn = document.getElementById("reportBtn");
const blockBtn = document.getElementById("blockBtn");

// ================================
// CONNECTION VARIABLES
// ================================

let isMatched = false;
let isSearching = false;
let isInitiator = false;
let partnerVideoReady = false;
let offerCreated = false;
let isVideoConnected = false;

let localStream = null;
let peerConnection = null;
let remoteStream = null;

let pendingCandidates = [];

// ================================
// LANGUAGE TRANSLATIONS
// ================================

const translations = {
    en: {
        subtitle: "Meet and chat with strangers",
        language: "Language:",
        you: "You",
        stranger: "Stranger",
        chatTitle: "Text Chat",
        welcome: "Welcome to ❤️WEMEET! Click Start to connect with a stranger.",
        start: "Start",
        next: "Next Stranger",
        send: "Send",
        endChat: "End Chat",
        report: "Report User",
        block: "Block User",
        placeholder: "Type your message...",
        find: "Click Start to find a stranger.",
        cameraStarting: "Opening your camera and microphone...",
        waiting: "Your camera is on. Searching for a stranger...",
        connecting: "Stranger found! Connecting video and audio...",
        connected: "Video connected! You can now chat.",
        disconnected: "Stranger disconnected. Your camera remains on. Click Start to find another.",
        ended: "You ended the chat.",
        blocked: "User blocked. Click Start to find another stranger.",
        cameraError: "Please allow camera and microphone access.",
        videoFailed: "Video connection failed. Please try another stranger."
    },

    ta: {
        subtitle: "புதிய நண்பர்களை சந்தித்து பேசுங்கள்",
        language: "மொழி:",
        you: "நீங்கள்",
        stranger: "அந்நியர்",
        chatTitle: "குறுஞ்செய்தி அரட்டை",
        welcome: "WEMEET-க்கு வரவேற்கிறோம்! ஒருவருடன் இணைய Start அழுத்தவும்.",
        start: "தொடங்கு",
        next: "அடுத்த நபர்",
        send: "அனுப்பு",
        endChat: "அரட்டையை முடி",
        report: "புகார் செய்",
        block: "தடை செய்",
        placeholder: "உங்கள் செய்தியை எழுதுங்கள்...",
        find: "ஒருவரைத் தேட Start அழுத்தவும்.",
        cameraStarting: "கேமரா மற்றும் மைக்ரோஃபோன் திறக்கப்படுகிறது...",
        waiting: "கேமரா இயக்கத்தில் உள்ளது. ஒருவரைத் தேடுகிறோம்...",
        connecting: "நபர் கிடைத்தார்! வீடியோ இணைக்கப்படுகிறது...",
        connected: "வீடியோ இணைக்கப்பட்டது! இப்போது அரட்டை செய்யலாம்.",
        disconnected: "மற்றவர் வெளியேறிவிட்டார். உங்கள் கேமரா இயக்கத்தில் உள்ளது. புதிய நபரைத் தேட Start அழுத்தவும்.",
        ended: "நீங்கள் அரட்டையை முடித்துவிட்டீர்கள்.",
        blocked: "பயனர் தடுக்கப்பட்டார். புதிய நபரைத் தேடுங்கள்.",
        cameraError: "கேமரா மற்றும் மைக்ரோஃபோன் அனுமதி வழங்கவும்.",
        videoFailed: "வீடியோ இணைப்பு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்."
    }
};

let currentLanguage = "en";

function t(key) {
    return translations[currentLanguage][key];
}

function updateLanguage() {
    currentLanguage = languageSelect.value;

    document.getElementById("subtitle").textContent = t("subtitle");
    document.getElementById("languageLabel").textContent = t("language");
    document.getElementById("youLabel").textContent = t("you");
    document.getElementById("strangerLabel").textContent = t("stranger");
    document.getElementById("chatTitle").textContent = t("chatTitle");
    document.getElementById("welcomeMessage").textContent = t("welcome");

    startBtn.textContent = t("start");
    nextBtn.textContent = t("next");
    sendBtn.textContent = t("send");
    endChatBtn.textContent = t("endChat");
    reportBtn.textContent = t("report");
    blockBtn.textContent = t("block");

    messageInput.placeholder = t("placeholder");
}

languageSelect.addEventListener("change", updateLanguage);

// ================================
// INTERFACE CONTROLS
// ================================

function setChatEnabled(enabled) {
    messageInput.disabled = !enabled;
    sendBtn.disabled = !enabled;
    isVideoConnected = enabled;
}

function setSafetyEnabled(enabled) {
    endChatBtn.disabled = !enabled;
    reportBtn.disabled = !enabled;
    blockBtn.disabled = !enabled;
}

function showMessage(message, sender) {
    const messageElement = document.createElement("div");
    messageElement.classList.add("message");

    if (sender === "You") {
        messageElement.classList.add("you-message");
    } else {
        messageElement.classList.add("stranger-message");
    }

    const senderElement = document.createElement("strong");
    senderElement.textContent = sender + ": ";

    const textElement = document.createElement("span");
    textElement.textContent = message;

    messageElement.appendChild(senderElement);
    messageElement.appendChild(textElement);

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function clearChat() {
    chatBox.innerHTML = "";
}

// ================================
// CAMERA AND MICROPHONE
// ================================

async function startVideo() {
    // Reuse camera if it is already active.
    if (localStream) {
        return;
    }

    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    localVideo.srcObject = localStream;
    await localVideo.play();

    console.log("Camera and microphone started.");
}

function stopLocalCamera() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;
}

// ================================
// WEBRTC CONNECTION
// ================================

const rtcConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

function createPeerConnection() {
    if (peerConnection) {
        return peerConnection;
    }

    const pc = new RTCPeerConnection(rtcConfiguration);
    peerConnection = pc;

    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    // Send local camera and microphone.
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    // Receive stranger's media.
    pc.ontrack = event => {
        event.streams[0].getTracks().forEach(track => {
            const alreadyAdded = remoteStream
                .getTracks()
                .some(existingTrack => existingTrack.id === track.id);

            if (!alreadyAdded) {
                remoteStream.addTrack(track);
            }
        });

        remoteVideo.play().catch(error => {
            console.log("Remote video playback error:", error);
        });
    };

    // Send ICE candidates.
    pc.onicecandidate = event => {
        if (event.candidate && isMatched) {
            socket.emit("video-candidate", event.candidate);
        }
    };

    // Check video connection status.
    pc.onconnectionstatechange = () => {
        if (peerConnection !== pc) return;

        console.log("Connection:", pc.connectionState);

        if (pc.connectionState === "connected" && isMatched) {
            setChatEnabled(true);
            statusText.textContent = t("connected");
        }

        if (
            pc.connectionState === "failed" ||
            pc.connectionState === "disconnected"
        ) {
            setChatEnabled(false);
            statusText.textContent = t("videoFailed");
        }

        if (pc.connectionState === "closed") {
            setChatEnabled(false);
        }
    };

    return pc;
}

function closePeerConnection() {
    if (peerConnection) {
        peerConnection.onconnectionstatechange = null;
        peerConnection.onicecandidate = null;
        peerConnection.ontrack = null;

        peerConnection.close();
        peerConnection = null;
    }

    remoteStream = null;
    pendingCandidates = [];

    remoteVideo.srcObject = null;

    partnerVideoReady = false;
    offerCreated = false;

    setChatEnabled(false);
}

// ================================
// CREATE VIDEO OFFER
// ================================

async function maybeCreateOffer() {
    if (
        !isMatched ||
        !isInitiator ||
        !partnerVideoReady ||
        !localStream ||
        !peerConnection ||
        offerCreated
    ) {
        return;
    }

    try {
        offerCreated = true;

        const offer = await peerConnection.createOffer();

        await peerConnection.setLocalDescription(offer);

        socket.emit("video-offer", offer);

    } catch (error) {
        offerCreated = false;
        console.error("Offer error:", error);
    }
}

// ================================
// START BUTTON
// ================================

startBtn.addEventListener("click", async () => {
    if (isSearching || isMatched) return;

    startBtn.disabled = true;

    statusText.textContent = t("cameraStarting");

    try {
        // Camera opens immediately when Start is clicked.
        await startVideo();

        clearChat();

        isSearching = true;
        statusText.textContent = t("waiting");

        socket.emit("start-chat");

    } catch (error) {
        console.error("Camera error:", error);

        stopLocalCamera();

        startBtn.disabled = false;
        statusText.textContent = t("find");

        alert(t("cameraError"));
    }
});

// ================================
// MATCH FOUND
// ================================

socket.on("waiting", () => {
    isSearching = true;
    statusText.textContent = t("waiting");
});

socket.on("matched", async data => {
    isMatched = true;
    isSearching = false;

    isInitiator = Boolean(data && data.initiator);

    startBtn.disabled = true;
    nextBtn.disabled = false;

    setChatEnabled(false);
    setSafetyEnabled(true);

    clearChat();

    statusText.textContent = t("connecting");

    try {
        // Camera should already be running.
        if (!localStream) {
            await startVideo();
        }

        if (!isMatched) return;

        createPeerConnection();

        socket.emit("video-ready");

        await maybeCreateOffer();

    } catch (error) {
        console.error("Match video error:", error);

        socket.emit("end-chat");

        resetChat(true);
        statusText.textContent = t("cameraError");
    }
});

// ================================
// PARTNER VIDEO READY
// ================================

socket.on("partner-video-ready", async () => {
    if (!isMatched) return;

    partnerVideoReady = true;

    await maybeCreateOffer();
});

// ================================
// RECEIVE OFFER
// ================================

socket.on("video-offer", async offer => {
    if (!isMatched || !peerConnection) return;

    try {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(offer)
        );

        const answer = await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(answer);

        socket.emit("video-answer", answer);

        for (const candidate of pendingCandidates) {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        }

        pendingCandidates = [];

    } catch (error) {
        console.error("Offer handling error:", error);
    }
});

// ================================
// RECEIVE ANSWER
// ================================

socket.on("video-answer", async answer => {
    if (!peerConnection || !isMatched) return;

    try {
        await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
        );

        for (const candidate of pendingCandidates) {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        }

        pendingCandidates = [];

    } catch (error) {
        console.error("Answer handling error:", error);
    }
});

// ================================
// RECEIVE ICE CANDIDATES
// ================================

socket.on("video-candidate", async candidate => {
    if (!isMatched) return;

    try {
        if (peerConnection && peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } else {
            pendingCandidates.push(candidate);
        }
    } catch (error) {
        console.error("Candidate error:", error);
    }
});

// ================================
// TEXT CHAT
// ================================

function sendMessage() {
    const message = messageInput.value.trim();

    if (
        !isMatched ||
        !isVideoConnected ||
        !peerConnection ||
        peerConnection.connectionState !== "connected" ||
        !message
    ) {
        return;
    }

    showMessage(message, "You");

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

socket.on("chat-message", message => {
    if (!isMatched || !isVideoConnected) return;

    showMessage(message, "Stranger");
});

// ================================
// RESET CHAT
// ================================

function resetChat(stopCamera = false) {
    isMatched = false;
    isSearching = false;
    isInitiator = false;
    partnerVideoReady = false;
    offerCreated = false;

    closePeerConnection();

    // Stop camera only when explicitly requested.
    if (stopCamera) {
        stopLocalCamera();
    }

    setSafetyEnabled(false);
    setChatEnabled(false);

    startBtn.disabled = false;
    nextBtn.disabled = true;

    messageInput.value = "";
}

// ================================
// NEXT STRANGER
// CAMERA REMAINS ON FOR BOTH USERS
// ================================

nextBtn.addEventListener("click", () => {
    if (!isMatched && !isSearching) return;

    // Close old video connection, but do not stop camera.
    resetChat(false);

    clearChat();

    isSearching = true;
    startBtn.disabled = true;

    statusText.textContent = t("waiting");

    socket.emit("next-stranger");
});

// ================================
// END CHAT
// CAMERA OFF
// ================================

endChatBtn.addEventListener("click", () => {
    if (!isMatched) return;

    socket.emit("end-chat");

    resetChat(true);

    statusText.textContent = t("ended");
});

// ================================
// PARTNER LEFT
// IMPORTANT: CAMERA STAYS ON
// ================================

socket.on("partner-left", () => {
    // false means keep camera and microphone running.
    resetChat(false);

    clearChat();

    statusText.textContent = t("disconnected");
});

// ================================
// CHAT ENDED
// ================================

socket.on("chat-ended", () => {
    resetChat(true);

    statusText.textContent = t("ended");
});

// ================================
// REPORT USER
// ================================

reportBtn.addEventListener("click", () => {
    if (!isMatched) return;

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

// ================================
// BLOCK USER
// ================================

blockBtn.addEventListener("click", () => {
    if (!isMatched) return;

    const confirmed = confirm(
        "Are you sure you want to block this user?"
    );

    if (!confirmed) return;

    socket.emit("block-user");

    resetChat(true);

    statusText.textContent = t("blocked");
});

socket.on("block-confirmed", () => {
    alert("User blocked successfully.");
});

socket.on("partner-blocked", () => {
    resetChat(true);

    clearChat();

    statusText.textContent = t("disconnected");
});

// ================================
// INITIAL SETTINGS
// ================================

setChatEnabled(false);
setSafetyEnabled(false);

startBtn.disabled = false;
nextBtn.disabled = true;

updateLanguage();
