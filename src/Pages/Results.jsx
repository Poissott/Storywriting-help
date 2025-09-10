import React, {useEffect, useState} from "react";
import {useParams} from "react-router-dom";
import socket from "../Server/socket.js";

function Results() {
    const {roomId} = useParams();
    const [results, setResults] = useState([]);

    useEffect(() => {
        if (results.length === 0) {
            socket.emit("getResults", {room_id: roomId});
        }

        const handleResults = (receivedResults) => {
            console.log(receivedResults);
            setResults(receivedResults);
        }

        socket.on("receiveResults", handleResults);

        return () => {
            socket.off("receiveResults");
        };
    }, [results, roomId]);

    return (
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                        <p className="text-5xl text-four text-center">This is Taletelling</p>
                        <div>
                            {results.map((section, index) => (
                                <div key={index} className="mb-4 p-4 border bg-three rounded-lg bg-three shadow-md">
                                    <p className="text-four whitespace-pre-wrap">{section}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default Results;