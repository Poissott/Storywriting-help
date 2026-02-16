import { io } from "socket.io-client";

const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;
console.log("[Socket] Attempting to connect to:", socketUrl);

const socket = io(socketUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
});

socket.on("connect", () => {
    console.log("[Socket] Connected successfully! Socket ID:", socket.id);
});

socket.on("connect_error", (error) => {
    console.error("[Socket] Connection error:", error.message);
    console.error("[Socket] Attempted URL:", socketUrl);
});

socket.on("disconnect", (reason) => {
    console.log("[Socket] Disconnected. Reason:", reason);
});

export default socket;