
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

// =====================================
// SERVER DATA
// =====================================

let waitingUsers = [];

const partners = new Map();
const blockedPairs = new Set();

// =====================================
// BLOCK HELPERS
// =====================================

function getPairKey(user1, user2) {
    return [user1, user2].sort().join("_");
}

function isBlocked(user1, user2) {
    return blockedPairs.has(getPairKey(user1, user2));
}

// =====================================
// WAITING QUEUE HELPERS
// =====================================

function removeFromWaiting(socketId) {
    waitingUsers = waitingUsers.filter(id => id !== socketId);
}

// =====================================
// DISCONNECT PARTNER
// =====================================

function disconnectPartner(socket, notify = true) {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;

    partners.delete(socket.id);
    partners.delete(partnerId);

    if (notify) {
        io.to(partnerId).emit("partner-left");
    }
}

// =====================================
// FIND A STRANGER
// =====================================

function findMatch(socket) {

    if (!io.sockets.sockets.has(socket.id)) return;

    // Already connected to someone.
    if (partners.has(socket.id)) return;

    // Remove duplicate queue entries.
    removeFromWaiting(socket.id);

    const availableUsers = [...new Set(waitingUsers)].filter(userId => {
        return (
            userId !== socket.id &&
            io.sockets.sockets.has(userId) &&
            !isBlocked(socket.id, userId) &&
            !partners.has(userId)
        );
    });

    // No stranger available.
    if (availableUsers.length === 0) {

        if (!waitingUsers.includes(socket.id)) {
            waitingUsers.push(socket.id);
        }

        socket.emit("waiting");

        console.log("User waiting:", socket.id);

        return;
    }

    // Select a random stranger.
    const randomIndex = Math.floor(
        Math.random() * availableUsers.length
    );

    const partnerId = availableUsers[randomIndex];

    // Remove both users from the waiting queue.
    removeFromWaiting(socket.id);
    removeFromWaiting(partnerId);

    // Create the match.
    partners.set(socket.id, partnerId);
    partners.set(partnerId, socket.id);

    io.to(socket.id).emit("matched", {
        initiator: true
    });

    io.to(partnerId).emit("matched", {
        initiator: false
    });

    console.log("Users matched:", socket.id, partnerId);
}

// =====================================
// SOCKET CONNECTION
// =====================================

io.on("connection", socket => {

    console.log("MEETON user connected:", socket.id);

    // =================================
    // START SEARCH
    // =================================

    socket.on("start-chat", () => {

        if (partners.has(socket.id)) return;

        // Avoid duplicate queue entries.
        if (waitingUsers.includes(socket.id)) {
            socket.emit("waiting");
            return;
        }

        findMatch(socket);
    });

    // =================================
    // CANCEL SEARCH
    // =================================

    socket.on("cancel-search", () => {

        console.log("Search cancelled:", socket.id);

        // Remove user from the waiting queue.
        removeFromWaiting(socket.id);

        /*
         * Race-condition protection:
         * If a match happened just before cancellation,
         * disconnect that match as well.
         */
        if (partners.has(socket.id)) {
            disconnectPartner(socket);
        }

        // Confirm cancellation to the same user.
        socket.emit("search-cancelled");
    });

    // =================================
    // NEXT STRANGER
    // =================================

    socket.on("next-stranger", () => {

        removeFromWaiting(socket.id);

        // Disconnect the previous stranger.
        disconnectPartner(socket);

        // Search for another stranger.
        findMatch(socket);
    });

    // =================================
    // END CHAT
    // =================================

    socket.on("end-chat", () => {

        removeFromWaiting(socket.id);

        disconnectPartner(socket);

        socket.emit("chat-ended");
    });

    // =================================
    // TEXT MESSAGES
    // =================================

    socket.on("send-message", message => {

        const partnerId = partners.get(socket.id);

        if (!partnerId || typeof message !== "string") return;

        const cleanMessage = message.trim();

        if (!cleanMessage || cleanMessage.length > 2000) return;

        io.to(partnerId).emit("chat-message", cleanMessage);
    });

    // =================================
    // VIDEO SIGNALING
    // =================================

    socket.on("video-ready", () => {

        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("partner-video-ready");
        }
    });

    socket.on("video-offer", offer => {

        const partnerId = partners.get(socket.id);

        if (partnerId && offer) {
            io.to(partnerId).emit("video-offer", offer);
        }
    });

    socket.on("video-answer", answer => {

        const partnerId = partners.get(socket.id);

        if (partnerId && answer) {
            io.to(partnerId).emit("video-answer", answer);
        }
    });

    socket.on("video-candidate", candidate => {

        const partnerId = partners.get(socket.id);

        if (partnerId && candidate) {
            io.to(partnerId).emit("video-candidate", candidate);
        }
    });

    socket.on("end-video", () => {

        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("partner-video-ended");
        }
    });

    // =================================
    // REPORT USER
    // =================================

    socket.on("report-user", reason => {

        const allowedReasons = [
            "Inappropriate behaviour",
            "Harassment or bullying",
            "Nudity or sexual content",
            "Spam or scam",
            "Other"
        ];

        if (!allowedReasons.includes(reason)) return;

        const partnerId = partners.get(socket.id);

        if (!partnerId) return;

        console.log("MEETON USER REPORT:", {
            reporter: socket.id,
            reportedUser: partnerId,
            reason: reason,
            time: new Date().toISOString()
        });

        socket.emit("report-received");
    });

    // =================================
    // BLOCK USER
    // =================================

    socket.on("block-user", () => {

        const partnerId = partners.get(socket.id);

        if (!partnerId) return;

        // Remember this pair while the server is running.
        blockedPairs.add(getPairKey(socket.id, partnerId));

        partners.delete(socket.id);
        partners.delete(partnerId);

        removeFromWaiting(socket.id);
        removeFromWaiting(partnerId);

        io.to(partnerId).emit("partner-blocked");

        socket.emit("block-confirmed");

        console.log("User blocked:", socket.id, partnerId);
    });

    // =================================
    // USER DISCONNECT
    // =================================

    socket.on("disconnect", () => {

        console.log("MEETON user disconnected:", socket.id);

        removeFromWaiting(socket.id);

        disconnectPartner(socket);
    });

});

// =====================================
// START SERVER
// =====================================

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`MEETON server running on port ${PORT}`);
});
