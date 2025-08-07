import express from "express"
const app = express();
import http from "http";
import {Server} from "socket.io"
import cors from "cors"
import {Client} from "pg";
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: ["http://localhost:5173", "https://admin.socket.io"],
        methods: ["GET", "POST"],
        credentials: true
    }
});

import { instrument } from "@socket.io/admin-ui";
instrument(io, {
    auth: false
});


const db = new Client({
    user: process.env.DB_USER,
    password: process.env.DB_KEY,
    host: "localhost",
    port: 5432,
    database: "storytelling"
});
await db.connect();

io.on("connection",  (socket) => {
    console.log("User connected: ", socket.id);

    socket.on("createRoom", async ({room_id}) => {
        if (await db.query("SELECT * FROM rooms WHERE room_id = $1", [room_id]) !== undefined) {
            await db.query(
                "INSERT INTO rooms (room_id, playercount) VALUES ($1, 0) ON CONFLICT (room_id) DO NOTHING",
                [room_id]
            );
        }


        socket.on("joinRoom", async ({room, username}) => {
            let host;
            const roomRes = await db.query("SELECT playercount FROM rooms WHERE room_id = $1", [room]);
            console.log(roomRes);
            if (roomRes.rows[0].playercount === 0) {
                host = "Host";
            } else {
                host = "Guest";
            }
            await db.query(
                "INSERT INTO users (socket_id, username, room, host) VALUES ($1, $2, $3, $4) ON CONFLICT (socket_id) DO UPDATE SET username = $2, room = $3, host = $4",
                [socket.id, username, room, host]
            );
            await db.query(
                "UPDATE rooms SET playercount = playercount + 1 WHERE room_id = $1",
                [room]
            );
            socket.join(room);
            const userList = await db.query(
                "SELECT username FROM users WHERE room = $1",
                [room]
            );
            io.to(room).emit("updateUsersList", userList.rows.map(row => row.username));
        })

        socket.on("changeUsername", async ({newUsername}) => {
            const userRes = await db.query("UPDATE users SET username = $1 WHERE socket_id = $2 RETURNING room", [newUsername, socket.id]);
            const room = userRes.rows[0]?.room;
            if (room) {
                const result = await db.query("SELECT username FROM users WHERE room = $1", [room]);
                io.to(room).emit("updateUsersList", result.rows.map(row => row.username));
            }
        })

        socket.on("disconnect", async () => {
            const userRes = await db.query("DELETE FROM users WHERE socket_id = $1 RETURNING room", [socket.id]);
            const room = userRes.rows[0]?.room;
            if (room) {
                const result = await db.query("SELECT username FROM users WHERE room = $1", [room]);
                io.to(room).emit("updateUsersList", result.rows.map(u => u.username));
            }
            await db.query(
                "UPDATE rooms SET playercount = playercount - 1 WHERE room_id = $1",
                [room]
            );
            await db.query(
                "DELETE FROM rooms WHERE playercount = 0"
            );
        })
    })
})
server.listen(3000, () => {
    console.log("Server listening on port 3000");
})