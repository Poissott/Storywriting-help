import express from "express"

const app = express();
import http from "http";
import {Server} from "socket.io"
import cors from "cors"
import {Client} from "pg";

const rawAllowed = process.env.ALLOWED_ORIGINS;
const allowedOrigins = rawAllowed.split(",").map(s => s.trim()).filter(Boolean);

app.use(cors({
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
}));

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

import {instrument} from "@socket.io/admin-ui";

if (process.env.ENABLE_SOCKET_ADMIN === "true") {
    if (!process.env.SOCKET_ADMIN_USER || !process.env.SOCKET_ADMIN_PASS) {
        console.error("ENABLE_SOCKET_ADMIN is true but SOCKET_ADMIN_USER/PASS is missing. Exiting.");
        process.exit(1);
    }

    instrument(io, {
        auth: {
            type: "basic",
            username: process.env.SOCKET_ADMIN_USER,
            password: process.env.SOCKET_ADMIN_PASS
        }
    });
    console.log("Socket admin UI enabled (protected)");
} else {
    console.log("Socket admin UI disabled");
}

const connectionString = process.env.DATABASE_URL || (() => {
    const user = process.env.DB_USER;
    const password = process.env.DB_KEY;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const database = process.env.DB_NAME;
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
})();
const db = new Client({connectionString});

await db.connect().then(() => {
    console.log("Connected to database");
}).catch((err) => {
    console.error("Failed to connect to database:", err);
    process.exit(1);
});


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
        await touchRoom(room);

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
        await touchRoom(room);

        await db.query("UPDATE rooms SET set_rounds = $1 WHERE room_id = $2", [rounds, room]);
    })

    socket.on("setTimerPerRound", async ({room, timerPerRound}) => {
        await touchRoom(room);

        if (timerPerRound != null) {
            timerPerRound = timerPerRound * 1000;
        }
        await db.query("UPDATE rooms SET set_timer_per_round = $1 WHERE room_id = $2", [timerPerRound, room]);
    })

    socket.on("getTimerPerRound", async (room) => {
        await touchRoom(room);

        const res = await db.query("SELECT set_timer_per_round FROM rooms WHERE room_id = $1", [room]);
        const timerPerRound = res.rows[0]?.set_timer_per_round;
        io.to(socket.id).emit("receiveTimerPerRound", timerPerRound);
    })

    socket.on("setRandomWords", async ({room, randomWords}) => {
        await touchRoom(room);

        await db.query("UPDATE rooms SET set_allow_random_words = $1 WHERE room_id = $2", [randomWords, room]);
    })

    socket.on("getSelectedRandomWords", async (room) => {
        await touchRoom(room);

        const res = await db.query("SELECT set_allow_random_words FROM rooms WHERE room_id = $1", [room]);
        const randomWords = res.rows[0]?.set_allow_random_words;
        io.to(socket.id).emit("receiveSelectedRandomWords", randomWords);
    })

    socket.on("EnterGame", async ({room, isHost}) => {
        await touchRoom(room);

        io.to(room).emit("enterGame", isHost);
    })

    socket.on("createOrder", async ({room_id}) => {
        await touchRoom(room_id);

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
        await touchRoom(room_id);

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
        const user_turn_res = await db.query("SELECT playercount, user_turn, total_rounds, set_rounds FROM rooms WHERE room_id = $1", [room_id]);
        let playercount = user_turn_res.rows[0]?.playercount;
        let user_turn = user_turn_res.rows[0]?.user_turn;
        let total_rounds = user_turn_res.rows[0]?.total_rounds;
        let set_rounds = user_turn_res.rows[0]?.set_rounds;
        if (playercount === user_turn) {
            user_turn = 1;
            total_rounds += 1;
            await db.query("UPDATE rooms SET total_rounds = $1 WHERE room_id = $2", [total_rounds, room_id]);
            if (set_rounds === total_rounds ) {
                io.to(room_id).emit("gameOver");
                return;
            }
        } else {
            user_turn += 1;
        }
        await db.query("UPDATE rooms SET user_turn = $1 WHERE room_id = $2", [user_turn, room_id]);
        io.to(room_id).emit("newUserTurn", user_turn);
    })

    socket.on("getResults", async ({room_id}) => {
        await touchRoom(room_id);

        const resultsRes = await db.query("SELECT username, sections FROM users WHERE room = $1", [room_id]);
        const resultsParsed = resultsRes.rows.map(row => {
            if (Array.isArray(row.sections)) {
                return row.sections;
            }
        });
        let transposed = [];
        if (resultsParsed.length > 0 && resultsParsed[0].length > 0) {
            transposed = resultsParsed[0].map((_, colIndex) =>
                resultsParsed.map(row => row[colIndex]).filter(Boolean)
            ).flat();
        }
        io.to(room_id).emit("receiveResults", transposed);
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

    async function touchRoom(room_id) {
        await db.query(
            "UPDATE rooms SET last_activity = $1 WHERE room_id = $2",
            [Date.now(), room_id]
        );
    }

    socket.on("disconnect", async () => {
        await handleUserLeave(socket);
    });

    socket.on("leaveRoom", async ({ room: roomId, username }) => {
        await handleUserLeave(socket);
    });

})

const ROOM_LIFETIME = 1000 * 60 * 30;

setInterval(async () => {
    const threshold = Date.now() - ROOM_LIFETIME;
    await db.query("DELETE FROM rooms WHERE last_activity < $1", [threshold]);
    console.log("Cleaned old rooms");
}, 60 * 1000);

server.listen(3000, () => {
    console.log("Server listening on port 3000");
})