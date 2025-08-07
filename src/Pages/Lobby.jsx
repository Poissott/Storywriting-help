import React, {useEffect, useRef, useState} from 'react';
import {Link, useParams} from "react-router-dom";
import io from "socket.io-client";

function Lobby() {
    const {roomId} = useParams();
    const [userList, setUserList] = useState([]);
    const socket = useRef(null);

    function handleCopy() {
        navigator.clipboard.writeText(`http://localhost:5173/lobby/${roomId}`)
            .then(() => {
                alert("Room ID copied to clipboard: " + roomId);
            })
            .catch(err => {
                console.error("Failed to copy: ", err);
            });
    }

    function handleUserChange(e) {
        const newUsername = e.target.value;
        localStorage.setItem("username", newUsername);
        socket.current.emit("changeUsername", {newUsername});
    }

    useEffect(() => {
        socket.current = io("http://localhost:3000");

        let username = localStorage.getItem("username");
        if (!username) {
            username = "Player" + Math.floor(Math.random() * 1000);
            localStorage.setItem("username", username);
        }

        socket.current.emit("createRoom", {room_id: roomId});
        socket.current.emit("joinRoom", {room: roomId, username: username});

        const handleUpdateUsersList = (users) => setUserList(users);
        socket.current.on("updateUsersList", handleUpdateUsersList);

        return () => {
            socket.current.off("updateUsersList", handleUpdateUsersList);
            socket.current.disconnect();
        };
    }, [roomId]);


    return (
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                        <button className="text-3xl text-four text-center" onClick={handleCopy}>Copy this:
                            http://localhost:5173/lobby/{roomId}
                        </button>
                        <div className="flex items-center justify-center">
                            <div className="w-full max-w-sm mx-auto">
                                {userList.map((username, idx) => {
                                    const localUsername = localStorage.getItem("username");
                                    return (
                                        <ol key={idx}>
                                            {username === localUsername ? (
                                                <input type="text" defaultValue={username} onChange={handleUserChange}
                                                       className="text-center"/>
                                            ) : (
                                                <p className="text-center">{username}</p>
                                            )}
                                        </ol>
                                    );
                                })}
                            </div>
                        </div>
                        <Link to={`/game/${roomId}`}>
                            <button className="bg-three min-h-15 min-w-40 object-center rounded-md">Start</button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}


export default Lobby;