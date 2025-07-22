import React from 'react';
import {Link} from "react-router-dom";

const generateRoomId = () => Math.random().toString(36).substring(2, 8).toUpperCase();

function HomePage() {
    const roomId = generateRoomId();
    return (
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                        <p className="text-5xl text-four text-center">This is Taletelling</p>
                        <Link to={`/lobby/${roomId}`}>
                            <button className="bg-three min-h-15 min-w-40 object-center rounded-md">Continue</button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default HomePage;