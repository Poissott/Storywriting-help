import express from "express"
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(__dirname, "../../dist")));

import http from "http";
import {Server} from "socket.io"
import cors from "cors"
import pg from "pg";
import {missingWords} from "../Utils/words.js";

const rawAllowed = process.env.ALLOWED_ORIGINS || "";
const allowedOrigins = rawAllowed.split(",").map(s => s.trim()).filter(Boolean);

console.log("CORS Configuration:");
console.log(`  ALLOWED_ORIGINS env var: ${process.env.ALLOWED_ORIGINS || "NOT SET"}`);
console.log(`  Parsed origins:`, allowedOrigins.length ? allowedOrigins : ["ALL (permissive mode)"]);

app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    methods: ["GET", "POST"],
    credentials: true
}));

const server = http.createServer(app);

// Test endpoint to verify server is running
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const io = new Server(server, {
    cors: {
        origin: allowedOrigins.length ? allowedOrigins : true,
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

const connectionString = (() => {
    // Check if individual DB vars are set first
    const user = process.env.DB_USER;
    const password = process.env.DB_KEY;
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT;
    const database = process.env.DB_NAME;

    if (user && password && host && port && database) {
        console.log("Using individual DB environment variables");
        console.log(`  DB_USER: SET`);
        console.log(`  DB_KEY: SET`);
        console.log(`  DB_HOST: ${host}`);
        console.log(`  DB_PORT: ${port}`);
        console.log(`  DB_NAME: ${database}`);
        return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
    }

    // Fall back to DATABASE_URL if individual vars not set
    if (process.env.DATABASE_URL) {
        console.log("Using DATABASE_URL environment variable");
        return process.env.DATABASE_URL;
    }

    // Neither set - error
    console.error("ERROR: No database configuration found. Set either DATABASE_URL or DB_USER/DB_KEY/DB_HOST/DB_PORT/DB_NAME");
    process.exit(1);
})();

const pool = new pg.Pool({
    connectionString,
    ssl: process.env.DB_SSL === "false" ? false : {
        rejectUnauthorized: false
    }
});

// An idle connection dropping must not take the whole server down, the pool replaces it.
pool.on("error", (err) => {
    console.error("Database connection error:", err.message);
});

const LOBBY_DISCONNECT_GRACE = 15 * 1000;
const TURN_DISCONNECT_GRACE = 30 * 1000;
const TIMER_GRACE = 2 * 1000;
const ROOM_LIFETIME = 1000 * 60 * 30;
const MAX_PLAYERS = 20;
const MAX_USERNAME_LENGTH = 24;
const MAX_SECTION_LENGTH = 5000;
const MIN_TIMER_SECONDS = 5;
const MAX_TIMER_SECONDS = 600;

const wordList = fs.readFileSync(path.join(__dirname, "../../wordlist.txt"), "utf8")
    .split(/\r?\n/)
    .map(word => word.trim())
    .filter(Boolean);

try {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS game_rooms (
            room_id TEXT PRIMARY KEY,
            phase TEXT NOT NULL DEFAULT 'lobby',
            rounds INTEGER,
            timer_ms INTEGER,
            random_words BOOLEAN,
            current_round INTEGER NOT NULL DEFAULT 1,
            current_turn INTEGER,
            turn_deadline BIGINT,
            current_words JSONB,
            story JSONB NOT NULL DEFAULT '[]',
            version BIGINT NOT NULL DEFAULT 0,
            last_activity BIGINT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS game_players (
            room_id TEXT NOT NULL REFERENCES game_rooms (room_id) ON DELETE CASCADE,
            player_id TEXT NOT NULL,
            public_id TEXT NOT NULL,
            username TEXT NOT NULL,
            is_host BOOLEAN NOT NULL DEFAULT FALSE,
            join_seq BIGSERIAL,
            turn_order INTEGER,
            socket_id TEXT,
            disconnected_at BIGINT,
            PRIMARY KEY (room_id, player_id)
        );
    `);
    // No socket survives a restart. Clients that come back within the grace period rejoin.
    await pool.query("UPDATE game_players SET disconnected_at = $1 WHERE disconnected_at IS NULL", [Date.now()]);
    console.log("✓ Connected to database successfully");
} catch (err) {
    console.error("✗ Failed to connect to database:", err);
    process.exit(1);
}

function cleanUsername(username) {
    return typeof username === "string" ? username.trim().slice(0, MAX_USERNAME_LENGTH) : "";
}

function isValidId(id) {
    return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

function pickWords() {
    const copy = [...wordList];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, 3);
}

async function loadPlayers(tx, roomId) {
    const res = await tx.query("SELECT * FROM game_players WHERE room_id = $1 ORDER BY join_seq", [roomId]);
    return res.rows;
}

async function loadPlayer(tx, roomId, playerId) {
    const res = await tx.query(
        "SELECT * FROM game_players WHERE room_id = $1 AND player_id = $2",
        [roomId, playerId]
    );
    return res.rows[0];
}

// The one snapshot of a room every client renders from. The story stays hidden until the end.
async function loadRoomState(tx, roomId) {
    const roomRes = await tx.query("SELECT * FROM game_rooms WHERE room_id = $1", [roomId]);
    const room = roomRes.rows[0];
    if (!room) return null;
    const players = await loadPlayers(tx, roomId);
    return {
        id: room.room_id,
        version: Number(room.version),
        phase: room.phase,
        rounds: room.rounds,
        timerSeconds: room.timer_ms == null ? null : room.timer_ms / 1000,
        randomWords: room.random_words,
        round: room.current_round,
        currentTurn: room.current_turn,
        remainingMs: room.turn_deadline == null ? null : Math.max(0, Number(room.turn_deadline) - Date.now()),
        words: room.current_words,
        story: room.phase === "finished" ? room.story : null,
        players: players.map(player => ({
            id: player.public_id,
            username: player.username,
            isHost: player.is_host,
            connected: player.disconnected_at == null,
            order: player.turn_order
        }))
    };
}

// Runs one state change under the room's row lock, so concurrent events for a room are
// applied one at a time and each either fully happens or not at all. Everyone in the room
// gets the resulting snapshot. Resolves to null if the room doesn't exist.
async function withRoom(roomId, fn) {
    const tx = await pool.connect();
    let result;
    let state;
    try {
        await tx.query("BEGIN");
        const res = await tx.query("SELECT * FROM game_rooms WHERE room_id = $1 FOR UPDATE", [roomId]);
        if (!res.rows[0]) {
            await tx.query("ROLLBACK");
            return null;
        }
        result = await fn(tx, res.rows[0]);
        await tx.query(
            "UPDATE game_rooms SET version = version + 1, last_activity = $1 WHERE room_id = $2",
            [Date.now(), roomId]
        );
        state = await loadRoomState(tx, roomId);
        await tx.query("COMMIT");
    } catch (err) {
        await tx.query("ROLLBACK").catch(() => {});
        throw err;
    } finally {
        tx.release();
    }
    if (state) {
        io.to(roomId).emit("roomState", state);
    } else {
        io.to(roomId).emit("roomClosed", roomId);
    }
    return result ?? {ok: true};
}

function isActive(player, now) {
    return player.disconnected_at == null || now - Number(player.disconnected_at) < TURN_DISCONNECT_GRACE;
}

async function beginTurn(tx, room, round, turn) {
    const deadline = room.timer_ms == null ? null : Date.now() + room.timer_ms;
    const words = room.random_words ? JSON.stringify(pickWords()) : null;
    await tx.query(
        "UPDATE game_rooms SET current_round = $1, current_turn = $2, turn_deadline = $3, current_words = $4 WHERE room_id = $5",
        [round, turn, deadline, words, room.room_id]
    );
}

// Moves to the next seat, skipping anyone who has been gone too long. Finishes the game
// once the last round is used up.
async function advanceTurn(tx, room) {
    const now = Date.now();
    const players = (await loadPlayers(tx, room.room_id)).sort((a, b) => a.turn_order - b.turn_order);
    const active = players.filter(player => isActive(player, now));
    const candidates = active.length > 0 ? active : players;

    let next = candidates.find(player => player.turn_order > room.current_turn);
    let round = room.current_round;
    if (!next) {
        next = candidates[0];
        round += 1;
    }
    if (!next || round > room.rounds) {
        await tx.query(
            "UPDATE game_rooms SET phase = 'finished', current_turn = NULL, turn_deadline = NULL, current_words = NULL WHERE room_id = $1",
            [room.room_id]
        );
        return;
    }
    await beginTurn(tx, room, round, next.turn_order);
}

// Removes a player from the room and repairs whatever depended on them.
async function removePlayer(tx, room, player) {
    await tx.query("DELETE FROM game_players WHERE room_id = $1 AND player_id = $2", [room.room_id, player.player_id]);
    const remaining = await loadPlayers(tx, room.room_id);
    if (remaining.length === 0) {
        await tx.query("DELETE FROM game_rooms WHERE room_id = $1", [room.room_id]);
        return;
    }
    if (player.is_host) {
        const connected = remaining.find(candidate => candidate.disconnected_at == null);
        await tx.query(
            "UPDATE game_players SET is_host = TRUE WHERE room_id = $1 AND player_id = $2",
            [room.room_id, (connected ?? remaining[0]).player_id]
        );
    }
    if (room.phase === "playing" && player.turn_order === room.current_turn) {
        await advanceTurn(tx, room);
    }
}

async function leaveCurrentRoom(socket) {
    const {roomId, playerId} = socket.data;
    if (!roomId) return;
    socket.data.roomId = null;
    socket.data.playerId = null;
    socket.leave(roomId);
    await withRoom(roomId, async (tx, room) => {
        const player = await loadPlayer(tx, roomId, playerId);
        // A newer tab may have taken over this seat. Finished rooms keep their players for the results.
        if (player && player.socket_id === socket.id && room.phase !== "finished") {
            await removePlayer(tx, room, player);
        }
    });
}

io.on("connection", (socket) => {
    console.log("User connected: ", socket.id);
    console.log(`[SOCKET] Total connected clients: ${io.engine.clientsCount}`);

    socket.on("error", (error) => {
        console.error(`[SOCKET ERROR] Client ${socket.id}:`, error);
    });

    // A handler that throws must only fail its own event, never crash the server.
    function on(event, handler) {
        socket.on(event, async (payload, ack) => {
            const reply = typeof ack === "function" ? ack : () => {};
            try {
                reply(await handler(payload ?? {}) ?? {ok: true});
            } catch (err) {
                console.error(`[SOCKET] ${event} failed for ${socket.id}:`, err);
                reply({ok: false, error: "Something went wrong on the server."});
            }
        });
    }

    // Runs fn as the player this socket represents. Everything a client can do goes through
    // here, so the room and identity come from the server rather than from the client's message.
    async function asPlayer(fn) {
        const {roomId, playerId} = socket.data;
        if (!roomId) return {ok: false, error: "You are not in a room."};
        const result = await withRoom(roomId, async (tx, room) => {
            const player = await loadPlayer(tx, roomId, playerId);
            if (!player) return {ok: false, error: "You are not in this room."};
            return fn(tx, room, player);
        });
        return result ?? {ok: false, error: "This room no longer exists."};
    }

    on("joinRoom", async ({room: roomId, playerId, username, create}) => {
        if (!isValidId(roomId) || !isValidId(playerId)) return {ok: false, error: "Invalid room."};

        if (socket.data.roomId && (socket.data.roomId !== roomId || socket.data.playerId !== playerId)) {
            await leaveCurrentRoom(socket);
        }
        if (create) {
            await pool.query(
                "INSERT INTO game_rooms (room_id, last_activity) VALUES ($1, $2) ON CONFLICT (room_id) DO NOTHING",
                [roomId, Date.now()]
            );
        }

        const name = cleanUsername(username) || "Player";
        socket.join(roomId);
        const result = await withRoom(roomId, async (tx, room) => {
            // The socket may have dropped while this join waited for the lock.
            const disconnectedAt = socket.connected ? null : Date.now();
            const existing = await loadPlayer(tx, roomId, playerId);
            if (existing) {
                await tx.query(
                    "UPDATE game_players SET socket_id = $1, disconnected_at = $2 WHERE room_id = $3 AND player_id = $4",
                    [socket.id, disconnectedAt, roomId, playerId]
                );
                socket.data.roomId = roomId;
                socket.data.playerId = playerId;
                return {ok: true, you: existing.public_id};
            }
            // Latecomers can look, but seats are only handed out in the lobby.
            const players = await loadPlayers(tx, roomId);
            if (room.phase !== "lobby" || players.length >= MAX_PLAYERS) {
                return {ok: true, you: null};
            }
            const publicId = crypto.randomUUID();
            await tx.query(
                "INSERT INTO game_players (room_id, player_id, public_id, username, is_host, socket_id, disconnected_at) VALUES ($1, $2, $3, $4, $5, $6, $7)",
                [roomId, playerId, publicId, name, players.length === 0, socket.id, disconnectedAt]
            );
            socket.data.roomId = roomId;
            socket.data.playerId = playerId;
            return {ok: true, you: publicId};
        });
        if (!result) {
            socket.leave(roomId);
            return {ok: false, error: "This room no longer exists."};
        }
        return result;
    });

    on("leaveRoom", async () => {
        await leaveCurrentRoom(socket);
    });

    on("changeUsername", async ({newUsername}) => {
        const name = cleanUsername(newUsername);
        if (!name) return {ok: false, error: "Username can't be empty."};
        return asPlayer(async (tx, room, player) => {
            await tx.query(
                "UPDATE game_players SET username = $1 WHERE room_id = $2 AND player_id = $3",
                [name, room.room_id, player.player_id]
            );
        });
    });

    on("updateSettings", async ({rounds, timerSeconds, randomWords}) => asPlayer(async (tx, room, player) => {
        if (!player.is_host) return {ok: false, error: "Only the host can change settings."};
        if (room.phase !== "lobby") return {ok: false, error: "The game has already started."};

        let newRounds = room.rounds;
        let newTimerMs = room.timer_ms;
        let newRandomWords = room.random_words;
        if (rounds !== undefined) {
            if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) return {ok: false, error: "Invalid rounds."};
            newRounds = rounds;
        }
        if (timerSeconds !== undefined) {
            const validTimer = timerSeconds === null
                || (Number.isInteger(timerSeconds) && timerSeconds >= MIN_TIMER_SECONDS && timerSeconds <= MAX_TIMER_SECONDS);
            if (!validTimer) return {ok: false, error: "Invalid timer."};
            newTimerMs = timerSeconds === null ? null : timerSeconds * 1000;
        }
        if (randomWords !== undefined) {
            if (typeof randomWords !== "boolean") return {ok: false, error: "Invalid setting."};
            newRandomWords = randomWords;
        }
        // The random words mode has no time limit.
        if (newRandomWords !== false) newTimerMs = null;

        await tx.query(
            "UPDATE game_rooms SET rounds = $1, timer_ms = $2, random_words = $3 WHERE room_id = $4",
            [newRounds, newTimerMs, newRandomWords, room.room_id]
        );
    }));

    on("startGame", async () => asPlayer(async (tx, room, player) => {
        if (!player.is_host) return {ok: false, error: "Only the host can start the game."};
        if (room.phase !== "lobby") return {ok: false, error: "The game has already started."};
        if (room.rounds == null || room.random_words == null) return {ok: false, error: "Select the settings first."};

        const players = await loadPlayers(tx, room.room_id);
        if (players.filter(p => p.disconnected_at == null).length < 2) {
            return {ok: false, error: "You need at least 2 connected players."};
        }
        for (let i = 0; i < players.length; i++) {
            await tx.query(
                "UPDATE game_players SET turn_order = $1 WHERE room_id = $2 AND player_id = $3",
                [i + 1, room.room_id, players[i].player_id]
            );
        }
        await tx.query("UPDATE game_rooms SET phase = 'playing' WHERE room_id = $1", [room.room_id]);
        await beginTurn(tx, room, 1, 1);
    }));

    on("submitSection", async ({section}) => {
        if (typeof section !== "string" || section.trim() === "") {
            return {ok: false, error: "Please write something before submitting."};
        }
        if (section.length > MAX_SECTION_LENGTH) return {ok: false, error: "That section is too long."};

        return asPlayer(async (tx, room, player) => {
            if (room.phase !== "playing" || player.turn_order !== room.current_turn) {
                return {ok: false, error: "It is not your turn."};
            }
            const missing = missingWords(section, room.current_words);
            if (missing.length > 0) return {ok: false, error: `Missing required words: ${missing.join(", ")}`};

            await tx.query(
                "UPDATE game_rooms SET story = story || $1::jsonb WHERE room_id = $2",
                [JSON.stringify([section]), room.room_id]
            );
            await advanceTurn(tx, room);
        });
    });

    socket.on("disconnect", async () => {
        const {roomId} = socket.data;
        if (!roomId) return;
        try {
            await withRoom(roomId, async (tx) => {
                // Only matches if this socket still owns the seat, not after a reconnect took it over.
                await tx.query(
                    "UPDATE game_players SET disconnected_at = $1 WHERE room_id = $2 AND socket_id = $3",
                    [Date.now(), roomId, socket.id]
                );
            });
        } catch (err) {
            console.error(`[SOCKET] disconnect failed for ${socket.id}:`, err);
        }
    });
})

// Things that happen without anyone sending an event: time running out, and people who
// disconnected and never came back. Lives in the database, so it also survives a restart.
async function runTurnSweep() {
    const now = Date.now();

    const staleLobbyPlayers = await pool.query(
        `SELECT p.room_id, p.player_id FROM game_players p
         JOIN game_rooms r ON r.room_id = p.room_id
         WHERE r.phase = 'lobby' AND p.disconnected_at < $1`,
        [now - LOBBY_DISCONNECT_GRACE]
    );
    for (const {room_id, player_id} of staleLobbyPlayers.rows) {
        await withRoom(room_id, async (tx, room) => {
            const player = await loadPlayer(tx, room_id, player_id);
            if (room.phase === "lobby" && player?.disconnected_at != null
                && Number(player.disconnected_at) < now - LOBBY_DISCONNECT_GRACE) {
                await removePlayer(tx, room, player);
            }
        });
    }

    // Rooms where nobody is left stay paused instead of playing themselves to the end.
    const stuckRooms = await pool.query(
        `SELECT r.room_id FROM game_rooms r
         WHERE r.phase = 'playing'
           AND EXISTS (SELECT 1 FROM game_players a WHERE a.room_id = r.room_id
                       AND (a.disconnected_at IS NULL OR a.disconnected_at >= $1))
           AND (r.turn_deadline < $2
                OR NOT EXISTS (SELECT 1 FROM game_players c WHERE c.room_id = r.room_id
                               AND c.turn_order = r.current_turn
                               AND (c.disconnected_at IS NULL OR c.disconnected_at >= $1)))`,
        [now - TURN_DISCONNECT_GRACE, now - TIMER_GRACE]
    );
    for (const {room_id} of stuckRooms.rows) {
        await withRoom(room_id, async (tx, room) => {
            // Re-check under the lock, the turn may have moved on since the query above.
            if (room.phase !== "playing") return;
            const players = await loadPlayers(tx, room_id);
            const current = players.find(player => player.turn_order === room.current_turn);
            const timedOut = room.turn_deadline != null && Number(room.turn_deadline) < now - TIMER_GRACE;
            if (timedOut || !current || !isActive(current, now)) {
                await advanceTurn(tx, room);
            }
        });
    }
}

let sweepRunning = false;
setInterval(async () => {
    if (sweepRunning) return;
    sweepRunning = true;
    try {
        await runTurnSweep();
    } catch (err) {
        console.error("Turn sweep failed:", err);
    } finally {
        sweepRunning = false;
    }
}, 1000);

setInterval(async () => {
    try {
        // A long turn without a timer is quiet, so rooms with someone connected are kept.
        const res = await pool.query(
            `DELETE FROM game_rooms r
             WHERE r.last_activity < $1
               AND (r.phase = 'finished' OR NOT EXISTS (
                   SELECT 1 FROM game_players p WHERE p.room_id = r.room_id AND p.disconnected_at IS NULL))
             RETURNING r.room_id`,
            [Date.now() - ROOM_LIFETIME]
        );
        for (const {room_id} of res.rows) {
            io.to(room_id).emit("roomClosed", room_id);
        }
        if (res.rows.length > 0) console.log(`Cleaned ${res.rows.length} old rooms`);
    } catch (err) {
        console.error("Room cleanup failed:", err);
    }
}, 60 * 1000);

const port = Number(process.env.PORT) || 8080;

// Catch-all: serve index.html for client-side routing
app.use((req, res) => {
    res.sendFile(path.join(__dirname, "../../dist/index.html"));
});

server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
})
