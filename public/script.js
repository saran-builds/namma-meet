
const socket = io();

// =====================================
// HTML ELEMENTS
// =====================================

const languageSelect = document.getElementById("language");
const statusText = document.getElementById("status");
const chatBox = document.getElementById("chatBox");
const messageInput = document.getElementById("messageInput");

const startBtn = document.getElementById("startBtn");
const nextBtn = document.getElementById("nextBtn");
const sendBtn = document.getElementById("sendBtn");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const youLabel = document.getElementById("youLabel");

const cameraToggleBtn = document.getElementById("cameraToggleBtn");
const micToggleBtn = document.getElementById("micToggleBtn");

const endChatBtn = document.getElementById("endChatBtn");
const reportBtn = document.getElementById("reportBtn");
const blockBtn = document.getElementById("blockBtn");

// =====================================
// CONNECTION VARIABLES
// =====================================

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

let reconnectTimer = null;
let connectionFailureTimer = null;

let iceRestartAttempts = 0;

const MAX_ICE_RESTARTS = 2;

// =====================================
// TRANSLATIONS
// =====================================

const translations = {
    en: {
        subtitle: "Meet and chat with strangers",
        language: "Language:",
        you: "You",
        stranger: "Stranger",
        cameraOffLabel: "Camera Off",

        chatTitle: "Text Chat",
        welcome: "Welcome to MEETON! Click Start to connect with a stranger.",

        start: "Start",
        next: "Next Stranger",
        send: "Send",

        endChat: "End Chat",
        report: "Report User",
        block: "Block User",

        cameraOn: "Turn Camera On",
        cameraOff: "Turn Camera Off",
        micOn: "Unmute Mic",
        micOff: "Mute Microphone",

        placeholder: "Type your message...",

        find: "Click Start to find a stranger.",
        cameraStarting: "Opening your camera and microphone...",
        waiting: "Your camera is on. Searching for a stranger...",
        connecting: "Stranger found! Connecting video and audio...",
        connected: "Video connected! You can now chat.",

        reconnecting: "Connection interrupted. Trying to reconnect...",

        disconnected: "Stranger disconnected. Your camera remains on. Click Start to find another.",
        ended: "You ended the chat.",
        blocked: "User blocked. Click Start to find another stranger.",

        cameraError: "Please allow camera and microphone access.",
        videoFailed: "Video connection failed. Click Next Stranger to try again.",
        socketDisconnected: "Server connection lost. Please check your internet connection."
    },

    ta: {
        subtitle: "புதிய நண்பர்களை சந்தித்து பேசுங்கள்",
        language: "மொழி:",
        you: "நீங்கள்",
        stranger: "அந்நியர்",
        cameraOffLabel: "கேமரா நிறுத்தப்பட்டுள்ளது",

        chatTitle: "குறுஞ்செய்தி அரட்டை",
        welcome: "MEETON-க்கு வரவேற்கிறோம்! ஒருவருடன் இணைய Start அழுத்தவும்.",

        start: "தொடங்கு",
        next: "அடுத்த நபர்",
        send: "அனுப்பு",

        endChat: "அரட்டையை முடி",
        report: "புகார் செய்",
        block: "தடை செய்",

        cameraOn: "கேமராவை இயக்கு",
        cameraOff: "கேமராவை நிறுத்து",
        micOn: "மைக்ரோஃபோனை இயக்கு",
        micOff: "மைக்ரோஃபோனை நிறுத்து",

        placeholder: "உங்கள் செய்தியை எழுதுங்கள்...",

        find: "ஒருவரைத் தேட Start அழுத்தவும்.",
        cameraStarting: "கேமரா மற்றும் மைக்ரோஃபோன் திறக்கப்படுகிறது...",
        waiting: "கேமரா இயக்கத்தில் உள்ளது. ஒருவரைத் தேடுகிறோம்...",
        connecting: "நபர் கிடைத்தார்! வீடியோ இணைக்கப்படுகிறது...",
        connected: "வீடியோ இணைக்கப்பட்டது! இப்போது அரட்டை செய்யலாம்.",

        reconnecting: "இணைப்பு துண்டிக்கப்பட்டது. மீண்டும் இணைக்க முயற்சிக்கிறோம்...",

        disconnected: "மற்றவர் வெளியேறிவிட்டார். உங்கள் கேமரா இயக்கத்தில் உள்ளது. புதிய நபரைத் தேட Start அழுத்தவும்.",
        ended: "நீங்கள் அரட்டையை முடித்துவிட்டீர்கள்.",
        blocked: "பயனர் தடுக்கப்பட்டார். புதிய நபரைத் தேடுங்கள்.",

        cameraError: "கேமரா மற்றும் மைக்ரோஃபோன் அனுமதி வழங்கவும்.",
        videoFailed: "வீடியோ இணைப்பு தோல்வியடைந்தது. மீண்டும் முயற்சிக்கவும்.",
        socketDisconnected: "சர்வர் இணைப்பு துண்டிக்கப்பட்டது. இணைய இணைப்பைச் சரிபார்க்கவும்."
    }
};

let currentLanguage = "en";

function t(key) {
    return translations[currentLanguage][key] || key;
}

function setStatus(key) {
    statusText.textContent = t(key);
}

// =====================================
// LANGUAGE UPDATE
// =====================================

function updateLanguage() {
    currentLanguage = languageSelect.value === "ta" ? "ta" : "en";

    document.documentElement.lang = currentLanguage;

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

    // Translate homepage headings and feature cards.
    document.querySelectorAll("[data-en][data-ta]").forEach(element => {
        element.textContent = element.getAttribute("data-" + currentLanguage);
    });

    updateMediaButtons();
}

languageSelect.addEventListener("change", updateLanguage);

// =====================================
// INTERFACE CONTROLS
// =====================================

function setChatEnabled(enabled) {
    const canChat = Boolean(enabled && isMatched);

    messageInput.disabled = !canChat;
    sendBtn.disabled = !canChat;

    isVideoConnected = canChat;
}

function setSafetyEnabled(enabled) {
    endChatBtn.disabled = !enabled;
    reportBtn.disabled = !enabled;
    blockBtn.disabled = !enabled;
}

function clearChat() {
    chatBox.innerHTML = "";
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

    senderElement.textContent =
        (sender === "You" ? t("you") : t("stranger")) + ": ";

    const textElement = document.createElement("span");
    textElement.textContent = message;

    messageElement.appendChild(senderElement);
    messageElement.appendChild(textElement);

    chatBox.appendChild(messageElement);

    chatBox.scrollTop = chatBox.scrollHeight;
}

// =====================================
// SVG ICONS
// =====================================

const icons = {
    cameraOn: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="6" width="13" height="12" rx="2"></rect>
            <path d="m16 10 5-3v10l-5-3z"></path>
        </svg>
    `,

    cameraOff: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="3" y="6" width="13" height="12" rx="2"></rect>
            <path d="m16 10 5-3v10l-5-3z"></path>
            <path d="M2 2 22 22"></path>
        </svg>
    `,

    micOn: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3"></rect>
            <path d="M5 10a7 7 0 0 0 14 0"></path>
            <path d="M12 19v3"></path>
            <path d="M8 22h8"></path>
        </svg>
    `,

    micOff: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="9" y="2" width="6" height="12" rx="3"></rect>
            <path d="M5 10a7 7 0 0 0 14 0"></path>
            <path d="M12 19v3"></path>
            <path d="M8 22h8"></path>
            <path d="M2 2 22 22"></path>
        </svg>
    `
};

// =====================================
// CAMERA AND MICROPHONE ICON UPDATE
// =====================================

function updateMediaButtons() {
    const videoTrack = localStream
        ? localStream.getVideoTracks().find(
            track => track.readyState === "live"
        )
        : null;

    const audioTrack = localStream
        ? localStream.getAudioTracks().find(
            track => track.readyState === "live"
        )
        : null;

    const cameraIsOn = Boolean(
        videoTrack && videoTrack.enabled
    );

    const microphoneIsOn = Boolean(
        audioTrack && audioTrack.enabled
    );

    // Enable controls only when usable tracks exist.
    cameraToggleBtn.disabled = !videoTrack;
    micToggleBtn.disabled = !audioTrack;

    // CAMERA BUTTON
    cameraToggleBtn.innerHTML = cameraIsOn
        ? icons.cameraOn
        : icons.cameraOff;

    cameraToggleBtn.title = t(
        cameraIsOn ? "cameraOff" : "cameraOn"
    );

    cameraToggleBtn.setAttribute(
        "aria-label",
        cameraToggleBtn.title
    );

    // Pressed means that the camera is OFF.
    cameraToggleBtn.setAttribute(
        "aria-pressed",
        String(!cameraIsOn)
    );

    cameraToggleBtn.classList.toggle(
        "is-off",
        Boolean(videoTrack && !cameraIsOn)
    );

    // MICROPHONE BUTTON
    micToggleBtn.innerHTML = microphoneIsOn
        ? icons.micOn
        : icons.micOff;

    micToggleBtn.title = t(
        microphoneIsOn ? "micOff" : "micOn"
    );

    micToggleBtn.setAttribute(
        "aria-label",
        micToggleBtn.title
    );

    // Pressed means that the microphone is muted.
    micToggleBtn.setAttribute(
        "aria-pressed",
        String(Boolean(audioTrack && !microphoneIsOn))
    );

    micToggleBtn.classList.toggle(
        "is-off",
        Boolean(audioTrack && !microphoneIsOn)
    );

    // Update local video label.
    youLabel.textContent = cameraIsOn
        ? t("you")
        : (videoTrack ? t("cameraOffLabel") : t("you"));
}

// =====================================
// CAMERA AND MICROPHONE
// =====================================

async function startVideo() {
    // Reuse already active local media.
    if (
        localStream &&
        localStream.getTracks().some(
            track => track.readyState === "live"
        )
    ) {
        localVideo.srcObject = localStream;

        updateMediaButtons();
        return;
    }

    stopLocalCamera();

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        throw new Error("Camera access requires HTTPS or localhost.");
    }

    localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
    });

    localVideo.srcObject = localStream;

    try {
        await localVideo.play();
    } catch (error) {
        console.warn("Local video playback:", error);
    }

    updateMediaButtons();

    console.log("Camera and microphone started.");
}

function stopLocalCamera() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    localVideo.srcObject = null;

    updateMediaButtons();
}

// =====================================
// CAMERA ON / OFF
// =====================================

cameraToggleBtn.addEventListener("click", () => {
    if (!localStream) return;

    const videoTrack = localStream
        .getVideoTracks()
        .find(track => track.readyState === "live");

    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;

    updateMediaButtons();

    console.log("Camera enabled:", videoTrack.enabled);
});

// =====================================
// MICROPHONE MUTE / UNMUTE
// =====================================

micToggleBtn.addEventListener("click", () => {
    if (!localStream) return;

    const audioTrack = localStream
        .getAudioTracks()
        .find(track => track.readyState === "live");

    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;

    updateMediaButtons();

    console.log("Microphone enabled:", audioTrack.enabled);
});

// =====================================
// WEBRTC CONFIGURATION
// =====================================

const rtcConfiguration = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: "stun:stun1.l.google.com:19302"
        }
    ]
};

// =====================================
// CONNECTION TIMER HELPERS
// =====================================

function clearConnectionTimers() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    if (connectionFailureTimer) {
        clearTimeout(connectionFailureTimer);
        connectionFailureTimer = null;
    }
}

function scheduleConnectionFailure(pc) {
    if (connectionFailureTimer) return;

    connectionFailureTimer = setTimeout(() => {
        connectionFailureTimer = null;

        if (peerConnection !== pc || !isMatched) return;

        const state = pc.iceConnectionState;

        if (state !== "connected" && state !== "completed") {
            setChatEnabled(false);
            setStatus("videoFailed");
        }
    }, 15000);
}

// =====================================
// ICE RECONNECTION
// =====================================

async function restartIceConnection(pc) {
    if (
        !isMatched ||
        peerConnection !== pc ||
        !isInitiator ||
        iceRestartAttempts >= MAX_ICE_RESTARTS
    ) {
        return;
    }

    if (pc.signalingState !== "stable") {
        if (!reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;

                if (
                    peerConnection === pc &&
                    pc.signalingState === "stable"
                ) {
                    restartIceConnection(pc);
                }
            }, 1500);
        }

        return;
    }

    iceRestartAttempts++;

    try {
        setStatus("reconnecting");

        console.log(
            "Attempting ICE reconnection:",
            iceRestartAttempts
        );

        const offer = await pc.createOffer({
            iceRestart: true
        });

        if (peerConnection !== pc || !isMatched) return;

        await pc.setLocalDescription(offer);

        socket.emit("video-offer", pc.localDescription);

    } catch (error) {
        console.error("ICE restart error:", error);
    }
}

// =====================================
// ICE CONNECTION STATE
// =====================================

function handleIceConnectionState(pc) {
    if (peerConnection !== pc || !isMatched) return;

    const state = pc.iceConnectionState;

    console.log("ICE connection state:", state);

    if (state === "connected" || state === "completed") {
        clearConnectionTimers();

        iceRestartAttempts = 0;

        setChatEnabled(true);
        setStatus("connected");

        return;
    }

    if (state === "checking") {
        setChatEnabled(false);
        setStatus("connecting");

        scheduleConnectionFailure(pc);

        return;
    }

    if (state === "disconnected") {
        setChatEnabled(false);
        setStatus("reconnecting");

        scheduleConnectionFailure(pc);

        if (isInitiator && !reconnectTimer) {
            reconnectTimer = setTimeout(() => {
                reconnectTimer = null;

                if (
                    peerConnection === pc &&
                    pc.iceConnectionState === "disconnected"
                ) {
                    restartIceConnection(pc);
                }
            }, 4000);
        }

        return;
    }

    if (state === "failed") {
        setChatEnabled(false);
        setStatus("reconnecting");

        scheduleConnectionFailure(pc);

        if (isInitiator) {
            restartIceConnection(pc);
        }
    }
}

// =====================================
// PENDING ICE CANDIDATES
// =====================================

async function flushPendingCandidates(pc) {
    if (
        peerConnection !== pc ||
        !pc.remoteDescription
    ) {
        return;
    }

    const candidates = pendingCandidates.splice(0);

    for (const candidate of candidates) {
        try {
            await pc.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } catch (error) {
            console.error("Pending ICE candidate error:", error);
        }
    }
}

// =====================================
// CREATE PEER CONNECTION
// =====================================

function createPeerConnection() {
    if (peerConnection) {
        return peerConnection;
    }

    if (!localStream) {
        throw new Error("Local camera is not available.");
    }

    const pc = new RTCPeerConnection(rtcConfiguration);

    peerConnection = pc;

    remoteStream = new MediaStream();
    remoteVideo.srcObject = remoteStream;

    // Send local camera and microphone.
    localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
    });

    // Receive stranger media.
    pc.ontrack = event => {
        const incomingTracks =
            event.streams && event.streams.length > 0
                ? event.streams[0].getTracks()
                : [event.track];

        incomingTracks.forEach(track => {
            const alreadyAdded = remoteStream
                .getTracks()
                .some(existingTrack => existingTrack.id === track.id);

            if (!alreadyAdded) {
                remoteStream.addTrack(track);
            }
        });

        remoteVideo.play().catch(error => {
            console.log("Remote video playback:", error);
        });
    };

    // Send ICE candidates.
    pc.onicecandidate = event => {
        if (
            event.candidate &&
            isMatched &&
            peerConnection === pc
        ) {
            socket.emit(
                "video-candidate",
                event.candidate.toJSON()
            );
        }
    };

    // Monitor ICE connection.
    pc.oniceconnectionstatechange = () => {
        handleIceConnectionState(pc);
    };

    pc.onconnectionstatechange = () => {
        console.log(
            "WebRTC connection state:",
            pc.connectionState
        );
    };

    return pc;
}

// =====================================
// CLOSE PEER CONNECTION
// =====================================

function closePeerConnection() {
    clearConnectionTimers();

    if (peerConnection) {
        peerConnection.onconnectionstatechange = null;
        peerConnection.oniceconnectionstatechange = null;
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
    iceRestartAttempts = 0;

    setChatEnabled(false);
}

// =====================================
// CREATE VIDEO OFFER
// =====================================

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

    const pc = peerConnection;

    try {
        offerCreated = true;

        const offer = await pc.createOffer();

        if (peerConnection !== pc || !isMatched) return;

        await pc.setLocalDescription(offer);

        socket.emit("video-offer", pc.localDescription);

    } catch (error) {
        offerCreated = false;
        console.error("Offer error:", error);
    }
}

// =====================================
// START BUTTON
// =====================================

startBtn.addEventListener("click", async () => {
    if (isSearching || isMatched) return;

    startBtn.disabled = true;

    setStatus("cameraStarting");

    try {
        // Open camera immediately.
        await startVideo();

        if (!socket.connected) {
            startBtn.disabled = false;
            setStatus("socketDisconnected");
            return;
        }

        clearChat();

        isSearching = true;

        setStatus("waiting");

        socket.emit("start-chat");

    } catch (error) {
        console.error("Camera error:", error);

        stopLocalCamera();

        startBtn.disabled = false;

        setStatus("cameraError");

        alert(t("cameraError"));
    }
});

// =====================================
// WAITING
// =====================================

socket.on("waiting", () => {
    if (!isSearching) return;

    isSearching = true;
    setStatus("waiting");
});

// =====================================
// MATCH FOUND
// =====================================

socket.on("matched", async data => {
    isMatched = true;
    isSearching = false;

    isInitiator = Boolean(data && data.initiator);

    startBtn.disabled = true;
    nextBtn.disabled = false;

    setChatEnabled(false);
    setSafetyEnabled(true);

    clearChat();
    clearConnectionTimers();

    iceRestartAttempts = 0;

    setStatus("connecting");

    try {
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
        setStatus("cameraError");
    }
});

// =====================================
// PARTNER VIDEO READY
// =====================================

socket.on("partner-video-ready", async () => {
    if (!isMatched) return;

    partnerVideoReady = true;

    await maybeCreateOffer();
});

// =====================================
// RECEIVE VIDEO OFFER
// =====================================

socket.on("video-offer", async offer => {
    if (!isMatched) return;

    try {
        const pc = peerConnection || createPeerConnection();

        if (pc.signalingState !== "stable") {
            console.warn(
                "Offer received while negotiation is busy:",
                pc.signalingState
            );
            return;
        }

        await pc.setRemoteDescription(
            new RTCSessionDescription(offer)
        );

        await flushPendingCandidates(pc);

        const answer = await pc.createAnswer();

        if (peerConnection !== pc || !isMatched) return;

        await pc.setLocalDescription(answer);

        socket.emit("video-answer", pc.localDescription);

    } catch (error) {
        console.error("Offer handling error:", error);
    }
});

// =====================================
// RECEIVE VIDEO ANSWER
// =====================================

socket.on("video-answer", async answer => {
    const pc = peerConnection;

    if (
        !pc ||
        !isMatched ||
        pc.signalingState !== "have-local-offer"
    ) {
        return;
    }

    try {
        await pc.setRemoteDescription(
            new RTCSessionDescription(answer)
        );

        await flushPendingCandidates(pc);

    } catch (error) {
        console.error("Answer handling error:", error);
    }
});

// =====================================
// RECEIVE ICE CANDIDATES
// =====================================

socket.on("video-candidate", async candidate => {
    if (!isMatched) return;

    try {
        if (
            peerConnection &&
            peerConnection.remoteDescription
        ) {
            await peerConnection.addIceCandidate(
                new RTCIceCandidate(candidate)
            );
        } else {
            pendingCandidates.push(candidate);
        }

    } catch (error) {
        console.error("ICE candidate error:", error);
    }
});

// =====================================
// TEXT CHAT
// =====================================

function sendMessage() {
    const message = messageInput.value.trim();

    if (
        !isMatched ||
        !isVideoConnected ||
        !peerConnection ||
        !message
    ) {
        return;
    }

    const iceState = peerConnection.iceConnectionState;

    if (iceState !== "connected" && iceState !== "completed") {
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

// =====================================
// RESET CHAT
// =====================================

function resetChat(stopCamera = false) {
    isMatched = false;
    isSearching = false;
    isInitiator = false;

    partnerVideoReady = false;
    offerCreated = false;

    closePeerConnection();

    // Stop local media only when requested.
    if (stopCamera) {
        stopLocalCamera();
    }

    setSafetyEnabled(false);
    setChatEnabled(false);

    startBtn.disabled = false;
    nextBtn.disabled = true;

    messageInput.value = "";

    updateMediaButtons();
}

// =====================================
// NEXT STRANGER
// KEEP LOCAL CAMERA ON
// =====================================

nextBtn.addEventListener("click", () => {
    if (!isMatched) return;

    resetChat(false);

    clearChat();

    isSearching = true;

    startBtn.disabled = true;

    setStatus("waiting");

    socket.emit("next-stranger");
});

// =====================================
// END CHAT
// TURN LOCAL CAMERA AND MIC OFF
// =====================================

endChatBtn.addEventListener("click", () => {
    if (!isMatched) return;

    socket.emit("end-chat");

    resetChat(true);

    setStatus("ended");
});

// =====================================
// PARTNER LEFT
// KEEP OUR CAMERA ON
// =====================================

socket.on("partner-left", () => {
    resetChat(false);

    clearChat();

    setStatus("disconnected");
});

// =====================================
// CHAT ENDED
// =====================================

socket.on("chat-ended", () => {
    resetChat(true);

    setStatus("ended");
});

// =====================================
// REPORT USER
// =====================================

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

// =====================================
// BLOCK USER
// =====================================

blockBtn.addEventListener("click", () => {
    if (!isMatched) return;

    const confirmed = confirm(
        "Are you sure you want to block this user?"
    );

    if (!confirmed) return;

    socket.emit("block-user");

    resetChat(true);

    setStatus("blocked");
});

socket.on("block-confirmed", () => {
    alert("User blocked successfully.");
});

// If the stranger blocks us, keep our own camera active.
socket.on("partner-blocked", () => {
    resetChat(false);

    clearChat();

    setStatus("disconnected");
});

// =====================================
// SOCKET CONNECTION STATUS
// =====================================

socket.on("disconnect", () => {
    if (isMatched || isSearching) {
        resetChat(false);
        clearChat();
    }

    setStatus("socketDisconnected");
});

socket.on("connect", () => {
    if (!isMatched && !isSearching) {
        setStatus("find");
    }
});

// =====================================
// INITIAL SETTINGS
// =====================================

setChatEnabled(false);
setSafetyEnabled(false);

startBtn.disabled = false;
nextBtn.disabled = true;

updateLanguage();
updateMediaButtons();

setStatus("find");
