import {test, before, after} from "node:test";
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {io} from "socket.io-client";

const PORT = 18080;
let server;
const runId = Date.now().toString(36);
let roomCounter = 0;
const clients = [];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function waitFor(check, what, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const value = check();
        if (value) return value;
        await sleep(20);
    }
    throw new Error(`Timed out waiting for ${what}`);
}

function startServer() {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ["src/Server/Server.js"], {
            env: {...process.env, PORT: String(PORT)}
        });
        child.stdout.on("data", (data) => {
            if (data.toString().includes("Server listening")) resolve(child);
        });
        child.stderr.on("data", (data) => console.error(data.toString()));
        child.on("exit", (code) => reject(new Error(`Server exited with ${code}`)));
    });
}

function connect(playerId, username) {
    const socket = io(`http://localhost:${PORT}`, {transports: ["websocket"], forceNew: true});
    const client = {socket, playerId, username, state: null, you: null};
    socket.on("roomState", (state) => {
        if (!client.state || state.version >= client.state.version) client.state = state;
    });
    clients.push(client);
    return client;
}

function send(client, event, payload = {}) {
    return new Promise(resolve => client.socket.emit(event, payload, resolve));
}

async function join(client, room, create = true) {
    const res = await send(client, "joinRoom", {room, playerId: client.playerId, username: client.username, create});
    if (res.ok) client.you = res.you;
    return res;
}

function me(client) {
    return client.state.players.find(player => player.id === client.you);
}

function whoseTurn(state, ...players) {
    return players.find(player => {
        const seat = state.players.find(p => p.id === player.you);
        return seat?.order === state.currentTurn;
    });
}

async function startedRoom(playerCount, settings = {rounds: 1, randomWords: false}) {
    const room = `${runId}-${++roomCounter}`;
    const players = [];
    for (let i = 0; i < playerCount; i++) {
        const player = connect(`${room}-player${i}`, `P${i}`);
        await join(player, room);
        players.push(player);
    }
    await send(players[0], "updateSettings", settings);
    assert.equal((await send(players[0], "startGame")).ok, true);
    for (const player of players) {
        await waitFor(() => player.state?.phase === "playing", "game start");
    }
    return {room, players};
}

async function playTurn(players, section) {
    const state = players[0].state;
    const current = whoseTurn(state, ...players);
    const res = await send(current, "submitSection", {section});
    assert.equal(res.ok, true, res.error);
    await waitFor(() => players.every(player => player.state.version > state.version), "next turn");
    return current;
}

before(async () => {
    server = await startServer();
});

after(() => {
    clients.forEach(client => client.socket.close());
    server.removeAllListeners("exit");
    server.kill();
});

test("simultaneous joins give exactly one host and everyone a seat", async () => {
    const room = `${runId}-${++roomCounter}`;
    const players = Array.from({length: 8}, (_, i) => connect(`${room}-${i}`, "Same name"));
    await Promise.all(players.map(player => waitFor(() => player.socket.connected, "connection")));
    await Promise.all(players.map(player => join(player, room)));
    await waitFor(() => players[0].state?.players.length === 8, "all players");
    assert.equal(players[0].state.players.filter(player => player.isHost).length, 1);
    assert.equal(new Set(players[0].state.players.map(player => player.id)).size, 8);
});

test("same nicknames get numbered on join", async () => {
    const room = `${runId}-${++roomCounter}`;
    const players = Array.from({length: 4}, (_, i) => connect(`${room}-${i}`, i === 3 ? "bob" : "Bob"));
    await Promise.all(players.map(player => waitFor(() => player.socket.connected, "connection")));
    await Promise.all(players.map(player => join(player, room)));
    await waitFor(() => players[0].state?.players.length === 4, "all players");
    const names = players[0].state.players.map(player => player.username.toLowerCase()).sort();
    assert.deepEqual(names, ["bob", "bob 2", "bob 3", "bob 4"]);
});

test("renaming to a taken nickname is refused, any case", async () => {
    const room = `${runId}-${++roomCounter}`;
    const alice = connect(`${room}-a`, "Alice");
    const bob = connect(`${room}-b`, "Bob");
    await join(alice, room);
    await join(bob, room);
    assert.equal((await send(bob, "changeUsername", {newUsername: " aLICE "})).ok, false);
    assert.equal((await send(alice, "changeUsername", {newUsername: "alice"})).ok, true, "own name in another case");
    assert.equal((await send(bob, "changeUsername", {newUsername: "Robert"})).ok, true);
    await waitFor(() => bob.state.players.some(player => player.username === "Robert"), "rename");
    assert.equal(me(bob).username, "Robert");
});

test("a rejoining player keeps their own nickname", async () => {
    const room = `${runId}-${++roomCounter}`;
    const first = connect(`${room}-a`, "Alice");
    await join(first, room);
    first.socket.close();
    const back = connect(`${room}-a`, "Alice");
    await join(back, room);
    await waitFor(() => back.state?.players.length === 1, "state");
    assert.equal(me(back).username, "Alice");
});

test("only the host can change settings or start", async () => {
    const room = `${runId}-${++roomCounter}`;
    const host = connect(`${room}-h`, "Host");
    const guest = connect(`${room}-g`, "Guest");
    await join(host, room);
    await join(guest, room);

    assert.equal((await send(guest, "updateSettings", {rounds: 3})).ok, false);
    assert.equal((await send(guest, "startGame")).ok, false);
    assert.equal((await send(host, "startGame")).ok, false, "settings are required");
    assert.equal((await send(host, "updateSettings", {rounds: 99})).ok, false);
});

test("settings reach guests", async () => {
    const room = `${runId}-${++roomCounter}`;
    const host = connect(`${room}-h`, "Host");
    const guest = connect(`${room}-g`, "Guest");
    await join(host, room);
    await join(guest, room);
    await send(host, "updateSettings", {rounds: 4, randomWords: false, timerSeconds: 60});
    await waitFor(() => guest.state?.rounds === 4 && guest.state.timerSeconds === 60, "settings");
});

test("a full game: turns are enforced and the story comes out in order", async () => {
    const {players} = await startedRoom(3, {rounds: 2, randomWords: false});
    const written = [];
    for (let i = 0; i < 6; i++) {
        const current = whoseTurn(players[0].state, ...players);
        const other = players.find(player => player !== current);
        assert.equal((await send(other, "submitSection", {section: "cheating"})).ok, false);
        await playTurn(players, `s${i}`);
        written.push(`s${i}`);
        assert.equal((await send(current, "submitSection", {section: "double"})).ok, false);
    }
    await waitFor(() => players.every(player => player.state.phase === "finished"), "game over");
    assert.deepEqual(players[2].state.story, written);
});

test("the story is hidden until the game is over", async () => {
    const {players} = await startedRoom(2);
    assert.equal(players[0].state.story, null);
});

test("random words are enforced by the server", async () => {
    const {players} = await startedRoom(2, {rounds: 1, randomWords: true});
    const state = players[0].state;
    assert.equal(state.words.length, 3);
    const current = whoseTurn(state, ...players);
    assert.equal((await send(current, "submitSection", {section: "no words here"})).ok, false);
    assert.equal((await send(current, "submitSection", {section: `x${state.words.join("x x")}x`})).ok, false, "whole words only");
    assert.equal((await send(current, "submitSection", {section: state.words.join(" ")})).ok, true);
});

test("a refresh keeps the seat", async () => {
    const {room, players} = await startedRoom(2);
    const current = whoseTurn(players[0].state, ...players);
    const other = players.find(player => player !== current);
    const seat = current.you;
    current.socket.close();
    await waitFor(() => other.state.players.some(player => !player.connected), "disconnect seen");

    const back = connect(current.playerId, current.username);
    await join(back, room);
    assert.equal(back.you, seat);
    await waitFor(() => back.state?.players.every(player => player.connected), "reconnect seen");
    assert.equal((await send(back, "submitSection", {section: "still me"})).ok, true);
});

test("a stale socket's disconnect does not mark a reconnected player as gone", async () => {
    const room = `${runId}-${++roomCounter}`;
    const first = connect(`${room}-a`, "A");
    await join(first, room);
    const second = connect(`${room}-a`, "A");
    await join(second, room);
    first.socket.close();
    await sleep(200);
    assert.equal(second.state.players[0].connected, true);
});

test("latecomers get no seat in a running game, and can read the results", async () => {
    const {room, players} = await startedRoom(2);
    const late = connect(`${room}-late`, "Late");
    const res = await join(late, room);
    assert.equal(res.you, null);
    await waitFor(() => late.state?.phase === "playing", "state");
    assert.equal(late.state.players.length, 2);
    assert.equal((await send(late, "submitSection", {section: "hi"})).ok, false);

    await playTurn(players, "s0");
    await playTurn(players, "s1");
    await waitFor(() => late.state.phase === "finished", "finish");
    assert.deepEqual(late.state.story, ["s0", "s1"]);
});

test("the current player leaving moves the turn on and written sections survive", async () => {
    const {players} = await startedRoom(3, {rounds: 2, randomWords: false});
    const first = await playTurn(players, "kept");

    const others = players.filter(player => player !== first);
    const leaver = whoseTurn(others[0].state, ...others);
    const stayer = others.find(player => player !== leaver);
    const leaverOrder = me(leaver).order;
    await send(leaver, "leaveRoom");
    await waitFor(() => stayer.state.players.length === 2, "player removed");
    assert.notEqual(stayer.state.currentTurn, leaverOrder);
    assert.ok(stayer.state.players.some(player => player.order === stayer.state.currentTurn));

    const remaining = [first, stayer];
    while (stayer.state.phase === "playing") {
        await playTurn(remaining, "more");
    }
    assert.equal(stayer.state.story[0], "kept");
});

test("the host leaving the lobby hands over host", async () => {
    const room = `${runId}-${++roomCounter}`;
    const host = connect(`${room}-h`, "Host");
    const guest = connect(`${room}-g`, "Guest");
    await join(host, room);
    await join(guest, room);
    await send(host, "leaveRoom");
    await waitFor(() => guest.state.players.length === 1, "host gone");
    assert.equal(me(guest).isHost, true);
});

test("a timer running out skips the turn even if the client never reports back", async () => {
    const {players} = await startedRoom(2, {rounds: 1, randomWords: false, timerSeconds: 5});
    assert.ok(players[0].state.remainingMs > 0);
    await waitFor(() => players[0].state.phase === "finished", "game over", 20000);
    assert.deepEqual(players[0].state.story, []);
});

test("a disconnected current player gets skipped after the grace period", async () => {
    const {players} = await startedRoom(2, {rounds: 2, randomWords: false});
    const current = whoseTurn(players[0].state, ...players);
    const other = players.find(player => player !== current);
    const turn = other.state.currentTurn;
    current.socket.close();
    await waitFor(() => other.state.currentTurn !== turn, "skip", 35000);
    assert.equal(me(other).order, other.state.currentTurn);
});

test("a room that does not exist is not created unless asked for", async () => {
    const client = connect(`${runId}-nobody`, "Nobody");
    const res = await join(client, `${runId}-missing`, false);
    assert.equal(res.ok, false);
});

test("garbage payloads get an error and the server survives", async () => {
    const client = connect(`${runId}-garbage`, "Garbage");
    assert.equal((await send(client, "joinRoom", {room: {a: 1}})).ok, false);
    assert.equal((await send(client, "submitSection", {section: 5})).ok, false);
    assert.equal((await send(client, "updateSettings", null)).ok, false);
    client.socket.emit("joinRoom");
    client.socket.emit("submitSection", "nope");
    await sleep(100);
    assert.equal(client.socket.connected, true);
});
