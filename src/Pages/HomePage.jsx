import React, {useEffect} from 'react';
import {Link} from "react-router-dom";
import socket from "../Server/socket.js";

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function HomePage() {
    const roomId = generateRoomId();

    // Coming back here means giving up your seat in whatever room you were in.
    useEffect(() => {
        socket.emit("leaveRoom");
    }, []);

    return (
        <div className="bg-one min-h-screen flex items-center justify-center">
            <div className="bg-two rounded-2xl shadow-2xl p-12 max-w-lg w-full mx-4">
                <div className="flex flex-col gap-8 items-center">
                    <h1 className="text-6xl font-bold text-three text-center">Storytelling</h1>
                    <p className="text-lg text-four/80 text-center">Create a collaborative story with friends</p>
                    <Link to={`/lobby/${roomId}`} className="btn-hero">
                        Create Game
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default HomePage;