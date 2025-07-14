import React, {useEffect, useState} from 'react';
import {Link} from "react-router-dom";
import io from "socket.io-client";

const socket = io.connect("http://localhost:3000");

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();


function Lobby() {
    const [room, setRoom] = useState("");
    const [username, setUsername] = useState("");
    const [users, setUsers] = useState([]);
    const [hasJoined, setHasJoined] = useState(false);

    useEffect(() => {
        const newRoomId = generateRoomId();
        setRoom(newRoomId);

        const tempUsername = "Player" + Math.floor(Math.random() * 1000);
        setUsername(tempUsername);

        setTimeout(() => {
            socket.emit("joinRoom", { room: newRoomId, username: tempUsername });
            setHasJoined(true);
        }, 100);
    }, []);

    useEffect(() => {
        const handleUpdateUsersList = (userList) => {
            console.log(userList);
            setUsers(userList);
        };

        socket.on("updateUsersList", handleUpdateUsersList);

        return () => {
            socket.off("updateUsersList", handleUpdateUsersList);
        };
    }, [])

    return (
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                        <p className="text-3xl text-four text-center">Copy this </p>
                        <div className="flex items-center justify-center">
                            <ol>
                                {users.map((username, idx) => (
                                    <li key={idx}>{username}</li>
                                ))}
                            </ol>
                        </div>
                        <Link to="/game">
                            <button className="bg-three min-h-15 min-w-40 object-center rounded-md">Start</button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Lobby;