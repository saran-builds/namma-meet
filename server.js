
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

app.use(express.static("public"));

let waitingUsers = [];
let partners = new Map();
let blockedPairs = new Set();

// Generate a unique key for a pair of users
function getPairKey(user1, user2) {
    return [user1, user2].sort().join("_");
}

// Check whether two users have blocked each other
function isBlocked(user1, user2) {
    return blockedPairs.has(getPairKey(user1, user2));
}

// Remove a user from the waiting list
function removeFromWaiting(socketId) {
    waitingUsers = waitingUsers.filter(id => id !== socketId);
}

// Disconnect two users from each other
function disconnectPartner(socket, notify = true) {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;

    partners.delete(socket.id);
    partners.delete(partnerId);

    if (notify) {
        io.to(partnerId).emit("partner-left");
    }
}

// Find a random stranger
function findMatch(socket) {
    removeFromWaiting(socket.id);

    const availableUsers = waitingUsers.filter(userId => {
        return (
            io.sockets.sockets.has(userId) &&
            !isBlocked(socket.id, userId) &&
            !partners.has(userId)
        );
    });

    if (availableUsers.length === 0) {
        waitingUsers.push(socket.id);
        socket.emit("waiting");
        return;
    }

    const randomIndex = Math.floor(
        Math.random() * availableUsers.length
    );

    const partnerId = availableUsers[randomIndex];

    removeFromWaiting(partnerId);

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

// Socket connections
io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // Start chat
    socket.on("start-chat", () => {
        if (partners.has(socket.id)) return;
        findMatch(socket);
    });

    // Find next stranger
    socket.on("next-stranger", () => {
        removeFromWaiting(socket.id);
        disconnectPartner(socket);
        findMatch(socket);
    });

    // End chat
    socket.on("end-chat", () => {
        removeFromWaiting(socket.id);
        disconnectPartner(socket);

        socket.emit("chat-ended");
    });

    // Send text message
    socket.on("send-message", message => {
        const partnerId = partners.get(socket.id);

        if (!partnerId) {
            console.log("Message rejected: user has no partner");
            return;
        }

        if (typeof message !== "string") return;

        const cleanMessage = message.trim();

        if (cleanMessage.length === 0 || cleanMessage.length > 2000) {
            return;
        }

        // Send message to the stranger
        io.to(partnerId).emit("chat-message", cleanMessage);

        console.log("Message delivered:", socket.id, "to", partnerId);
    });

    // -----------------------------
    // VIDEO CHAT SIGNALING
    // -----------------------------

    socket.on("video-ready", () => {
        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("partner-video-ready");
        }
    });

    socket.on("video-offer", offer => {
        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("video-offer", offer);
        }
    });

    socket.on("video-answer", answer => {
        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("video-answer", answer);
        }
    });

    socket.on("video-candidate", candidate => {
        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("video-candidate", candidate);
        }
    });

    socket.on("end-video", () => {
        const partnerId = partners.get(socket.id);

        if (partnerId) {
            io.to(partnerId).emit("partner-video-ended");
        }
    });

    // -----------------------------
    // REPORT USER
    // -----------------------------

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

        console.log("USER REPORT:", {
            reporter: socket.id,
            reportedUser: partnerId,
            reason: reason,
            time: new Date().toISOString()
        });

        socket.emit("report-received");
    });

    // -----------------------------
    // BLOCK USER
    // -----------------------------

    socket.on("block-user", () => {
        const partnerId = partners.get(socket.id);

        if (!partnerId) return;

        blockedPairs.add(getPairKey(socket.id, partnerId));

        partners.delete(socket.id);
        partners.delete(partnerId);

        removeFromWaiting(socket.id);
        removeFromWaiting(partnerId);

        io.to(partnerId).emit("partner-blocked");

        socket.emit("block-confirmed");

        console.log("User blocked:", socket.id, partnerId);
    });

    // -----------------------------
    // USER DISCONNECT
    // -----------------------------

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        removeFromWaiting(socket.id);
        disconnectPartner(socket);
    });
});

// Render hosting port
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`NammaMeet server running on port ${PORT}`);
});
