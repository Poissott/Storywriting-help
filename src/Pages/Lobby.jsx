import React, {useEffect, useRef, useState} from 'react';
import {Link, useNavigate, useParams} from "react-router-dom";
import io from "socket.io-client";

function Lobby() {
    const {roomId} = useParams();
    const [userList, setUserList] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [username, setUsername] = useState("");
    const socket = useRef(null);
    const navigate = useNavigate();

    function handleCopy() {
        navigator.clipboard.writeText(`http://localhost:5173/lobby/${roomId}`)
            .then(() => alert("Room ID copied to clipboard: " + roomId))
            .catch(err => console.error("Failed to copy: ", err));
    }

    function handleUserChange(e) {
        const newUsername = e.target.value;
        localStorage.setItem("username", newUsername);
        setUsername(newUsername);
        socket.current.emit("changeUsername", {newUsername});
    }

    function handleEnterGame() {
        socket.current.emit("EnterGame", {room: roomId, isHost: isHost})
    }

    useEffect(() => {
        socket.current = io("http://localhost:3000");

        let localUsername = localStorage.getItem("username");
        if (!localUsername) {
            localUsername = "Player" + Math.floor(Math.random() * 1000);
            localStorage.setItem("username", localUsername);
        }
        setUsername(localUsername);

        socket.current.emit("createRoom", {room_id: roomId});
        socket.current.emit("joinRoom", {room: roomId, username: localUsername});
        socket.current.on("updateUsersList", (users) => setUserList(users));

        return () => {
            socket.current.off("updateUsersList");
            socket.current.off("hostStatus");
            socket.current.disconnect();
        };
    }, [roomId]);

    useEffect(() => {
        const currentUser = userList.find(u => u.username === username);
        setIsHost(currentUser?.host === "Host");
    }, [userList, username]);

    useEffect(() => {
        if (!socket.current) return;
        socket.current.on("enterGame", (isHost) => {
            navigate(`/game/${roomId}`);
        })
    });

    let startGameButton;
    if (userList.length === 0) {
        startGameButton = (
            <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                Waiting
            </button>
        );
    } else if (isHost) {
        startGameButton = (
            <button className="bg-three min-h-15 min-w-40 object-center rounded-md" onClick={handleEnterGame}>
                Start Game
            </button>
        );
    } else {
        startGameButton = (
            <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                Waiting for Host
            </button>
        );
    }

    return (
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                        <button className="text-3xl text-four text-center" onClick={handleCopy}>
                            Copy this: http://localhost:5173/lobby/{roomId}
                        </button>
                        <div className="flex items-center justify-center">
                            <div className="w-full max-w-sm mx-auto flex flex-col gap-2">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={handleUserChange}
                                    className="text-center"
                                />
                                <div style={{minHeight: "2rem"}}>
                                    {userList
                                        .filter(user => user.username !== username)
                                        .map((user, idx) => (
                                            <p key={idx} className="text-center">{user.username}</p>
                                        ))}
                                </div>
                            </div>
                        </div>
                        <Link to={`/game/${roomId}`}>
                            {startGameButton}
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Lobby;