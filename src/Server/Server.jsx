import express from "express"
const app = express();
import http from "http";
import {Server} from "socket.io"
import cors from "cors"
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

io.on("connection", (socket) => {
    console.log("User connected: ", socket.id);
    socket.on("join_room", (data) => {
        socket.join(data);
    })
})

server.listen(3000, () => {
    console.log("Server listening on port 3000");
})