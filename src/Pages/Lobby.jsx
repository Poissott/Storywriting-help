import React, {useState} from 'react';
import {Link} from "react-router-dom";
import io from "socket.io-client";

const socket = io.connect("http://localhost:5173");

function Lobby() {
    const [room, setRoom] = useState("");
    const joinRoom = () => {
        if (room !== "") {
            socket.emit("join_room", room);
        }
    }

    return (
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                        <p className="text-3xl text-four text-center">Copy this </p>
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