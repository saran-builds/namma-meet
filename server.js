
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

function getPairKey(user1, user2) {
    return [user1, user2].sort().join("_");
}

function isBlocked(user1, user2) {
    return blockedPairs.has(getPairKey(user1, user2));
}

function removeFromWaiting(socketId) {
    waitingUsers = waitingUsers.filter(id => id !== socketId);
}

function disconnectPartner(socket, notify = true) {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;

    partners.delete(socket.id);
    partners.delete(partnerId);

    if (notify) {
        io.to(partnerId).emit("partner-left");
    }
}

function findMatch(socket) {
    removeFromWaiting(socket.id);

    const availableUsers = waitingUsers.filter(userId => {
        return (
            io.sockets.sockets.has(userId) &&
            !isBlocked(socket.id, userId)
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
}

io.on("connection", socket => {
    console.log("User connected:", socket.id);

    // Start chat
    socket.on("start-chat", () => {
        findMatch(socket);
    });

    // Find next stranger
    socket.on("next-stranger", () => {
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

        if (
            partnerId &&
            typeof message === "string" &&
            message.trim().length > 0
        ) {
            // Send message to stranger
            io.to(partnerId).emit("chat-message", message);
        }
    });

    // Video chat signaling
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

    // Report user
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

    // Block user
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
    });

    // User disconnects
    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);

        removeFromWaiting(socket.id);
        disconnectPartner(socket);
    });
});

// Hosting-compatible port
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
    console.log(`NammaMeet server running on port ${PORT}`);
});
