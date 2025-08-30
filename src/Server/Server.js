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

import {instrument} from "@socket.io/admin-ui";

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

io.on("connection", (socket) => {
    console.log("User connected: ", socket.id);

    socket.on("createRoom", async ({room_id}) => {
        const res = await db.query("SELECT * FROM rooms WHERE room_id = $1", [room_id]);
        if (res.rows.length === 0) {
            await db.query(
                "INSERT INTO rooms (room_id, playercount) VALUES ($1, 0) ON CONFLICT (room_id) DO NOTHING",
                [room_id]
            );
        }
    });

    socket.on("joinRoom", async ({room, username}) => {
        let host;
        const roomRes = await db.query("SELECT playercount FROM rooms WHERE room_id = $1", [room]);
        if (!roomRes.rows[0]) {
            await db.query(
                "INSERT INTO rooms (room_id, playercount) VALUES ($1, 0) ON CONFLICT (room_id) DO NOTHING",
                [room]
            );
            host = "Host";
        } else if (roomRes.rows[0].playercount === 0) {
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
            "SELECT username, host FROM users WHERE room = $1",
            [room]
        );
        io.to(room).emit("updateUsersList", userList.rows);
    });

    socket.on("changeUsername", async ({newUsername}) => {
        const userRes = await db.query("SELECT host, room FROM users WHERE socket_id = $1", [socket.id]);
        const host = userRes.rows[0]?.host;
        const room = userRes.rows[0]?.room;

        await db.query("UPDATE users SET username = $1, host = $2 WHERE socket_id = $3", [newUsername, host, socket.id]);

        if (room) {
            const result = await db.query("SELECT username, host FROM users WHERE room = $1", [room]);
            io.to(room).emit("updateUsersList", result.rows);
        }
    })

    socket.on("setRounds", async ({room, rounds}) => {
        await db.query("UPDATE rooms SET set_rounds = $1 WHERE room_id = $2", [rounds, room]);
    })

    socket.on("EnterGame", async ({room, isHost}) => {
        io.to(room).emit("enterGame", isHost);
    })

    socket.on("createOrder", async ({room_id}) => {
        const playersInRoomRes = await db.query("SELECT socket_id FROM users WHERE room = $1", [room_id]);
        const playersInRoom = playersInRoomRes.rows.map(row => row.socket_id);
        if (playersInRoom.length > 0) {
            for (let i = 0; i < playersInRoom.length; i++) {
                const player = playersInRoom[i];
                await db.query("UPDATE users SET order_nr = $1 WHERE socket_id = $2", [i + 1, player]);
                io.to(player).emit("getUserOrder", i + 1);
            }
        }
    })

    socket.on("submitSection", async ({room_id, order, section}) => {
        // Section Submission
        const res = await db.query("SELECT sections, section_count FROM users WHERE socket_id = $1", [socket.id]);
        let sections = res.rows[0]?.sections;
        let section_count = res.rows[0]?.section_count;
        if (!sections) {
            sections = [];
        } else if (typeof sections === "string") {
            sections = JSON.parse(sections);
        }
        sections[section_count] = section;
        section_count += 1;
        await db.query("UPDATE users SET section_count = $1 WHERE socket_id = $2", [section_count, socket.id]);
        await db.query("UPDATE users SET sections = $1 WHERE socket_id = $2", [JSON.stringify(sections), socket.id]);

        // Update user turn
        const user_turn_res = await db.query("SELECT playercount, user_turn, total_rounds FROM rooms WHERE room_id = $1", [room_id]);
        let playercount = user_turn_res.rows[0]?.playercount;
        let user_turn = user_turn_res.rows[0]?.user_turn;
        let total_rounds = user_turn_res.rows[0]?.total_rounds;
        if (playercount === user_turn) {
            user_turn = 1;
            total_rounds += 1;
            await db.query("UPDATE rooms SET total_rounds = $1 WHERE room_id = $2", [total_rounds, room_id]);
        } else {
            user_turn += 1;
        }
        await db.query("UPDATE rooms SET user_turn = $1 WHERE room_id = $2", [user_turn, room_id]);
        io.to(room_id).emit("newUserTurn", user_turn);
    })

    async function handleUserLeave(socket) {
        const userRes = await db.query("DELETE FROM users WHERE socket_id = $1 RETURNING room", [socket.id]);
        const room = userRes.rows[0]?.room;
        if (room) {
            await db.query("UPDATE rooms SET playercount = playercount - 1 WHERE room_id = $1", [room]);
            await db.query("DELETE FROM rooms WHERE playercount = 0");
            const result = await db.query("SELECT username, host FROM users WHERE room = $1", [room]);
            io.to(room).emit("updateUsersList", result.rows);
        }
    }

    socket.on("disconnect", async () => {
        await handleUserLeave(socket);
    });

    socket.on("leaveRoom", async ({ room: roomId, username }) => {
        await handleUserLeave(socket);
    });

})
server.listen(3000, () => {
    console.log("Server listening on port 3000");
})