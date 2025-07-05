import React from 'react';
import playGame from "./PlayGame.jsx";
import {Link} from "react-router-dom";

function HomePage() {
    return (
        <body className="bg-one ">
        <div className="min-h-screen min-w-screen content-center">
            <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                    <text className="text-5xl text-four text-center">This is Taletelling</text>
                    <Link to="/game">
                        <button onClick={playGame} className="bg-three min-h-15 min-w-40 object-center rounded-md">Continue</button>
                    </Link>
                </div>
            </div>
        </div>
        </body>
    );
}

export default HomePage;