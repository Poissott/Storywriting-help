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
        <div className="bg-one min-h-screen flex items-center justify-center p-4">
            <div className="bg-two rounded-2xl shadow-2xl p-8 max-w-3xl w-full">
                <div className="flex flex-col gap-6">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-three mb-2">Your Story</h1>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {results.length === 0 ? (
                            <p className="text-four/50 text-center py-8">Loading your story...</p>
                        ) : (
                            results.map((section, index) => (
                                <div key={index} className="bg-one border-l-4 border-three rounded-lg p-6 hover:shadow-lg transition-shadow">
                                    <p className="text-three text-sm font-semibold mb-2">Section {index + 1}</p>
                                    <p className="text-four whitespace-pre-wrap leading-relaxed">{section}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Results;