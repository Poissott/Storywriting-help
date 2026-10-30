import {useEffect, useState} from "react";
import {useNavigate} from "react-router-dom";
import socket from "../Server/socket.js";
import {getPlayerId, getUsername} from "./session.js";

// Subscribes a page to the server's room snapshot and keeps the URL on the page that
// matches the room's phase. `page` is "lobby", "game" or "results".
export function useRoom(roomId, page) {
    const [room, setRoom] = useState(null);
    const [myId, setMyId] = useState(null);
    const [joined, setJoined] = useState(false);
    const [notFound, setNotFound] = useState(false);
    const [connected, setConnected] = useState(socket.connected);
    const navigate = useNavigate();

    useEffect(() => {
        setRoom(null);
        setMyId(null);
        setJoined(false);
        setNotFound(false);

        function join() {
            setConnected(true);
            socket.emit("joinRoom", {
                room: roomId,
                playerId: getPlayerId(),
                username: getUsername(),
                create: page === "lobby"
            }, (res) => {
                if (res?.ok) {
                    setMyId(res.you);
                    setJoined(true);
                } else {
                    setNotFound(true);
                }
            });
        }

        function handleRoomState(state) {
            if (state.id !== roomId) return;
            // Snapshots can arrive out of order, an older one must not overwrite a newer one.
            setRoom(current => {
                if (current && current.version > state.version) return current;
                return {
                    ...state,
                    deadline: state.remainingMs == null ? null : Date.now() + state.remainingMs
                };
            });
        }

        function handleRoomClosed(id) {
            if (id === roomId) setNotFound(true);
        }

        function handleDisconnect() {
            setConnected(false);
        }

        socket.on("connect", join);
        socket.on("disconnect", handleDisconnect);
        socket.on("roomState", handleRoomState);
        socket.on("roomClosed", handleRoomClosed);
        if (socket.connected) join();

        return () => {
            socket.off("connect", join);
            socket.off("disconnect", handleDisconnect);
            socket.off("roomState", handleRoomState);
            socket.off("roomClosed", handleRoomClosed);
        };
    }, [roomId, page]);

    const phasePage = {lobby: "lobby", playing: "game", finished: "results"}[room?.phase];
    useEffect(() => {
        if (phasePage && phasePage !== page) {
            navigate(`/${phasePage}/${roomId}`, {replace: true});
        }
    }, [phasePage, page, roomId, navigate]);

    const me = room?.players.find(player => player.id === myId) ?? null;
    return {room: joined ? room : null, me, connected, notFound};
}
