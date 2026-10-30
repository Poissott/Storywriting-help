import React from "react";
import {Link, useParams} from "react-router-dom";
import {useRoom} from "../Utils/useRoom.js";

function Results() {
    const {roomId} = useParams();
    const {room, notFound} = useRoom(roomId, "results");
    const story = room?.story ?? [];

    let content;
    if (notFound) {
        content = <p className="text-four/50 text-center py-8">This story is no longer available.</p>;
    } else if (room?.phase !== "finished") {
        content = <p className="text-four/50 text-center py-8">Loading your story...</p>;
    } else if (story.length === 0) {
        content = <p className="text-four/50 text-center py-8">Nobody wrote anything this time.</p>;
    } else {
        content = story.map((section, index) => (
            <div key={index} className="bg-one border-l-4 border-three rounded-lg p-6 hover:shadow-lg transition-shadow">
                <p className="text-three text-sm font-semibold mb-2">Section {index + 1}</p>
                <p className="text-four whitespace-pre-wrap leading-relaxed">{section}</p>
            </div>
        ));
    }

    return (
        <div className="bg-one min-h-screen flex items-center justify-center p-4">
            <div className="bg-two rounded-2xl shadow-2xl p-8 max-w-3xl w-full">
                <div className="flex flex-col gap-6">
                    <div className="text-center">
                        <h1 className="text-5xl font-bold text-three mb-2">Your Story</h1>
                    </div>

                    <div className="space-y-4 max-h-96 overflow-y-auto">
                        {content}
                    </div>

                    <Link to="/" className="text-accent text-center font-semibold">New Game</Link>
                </div>
            </div>
        </div>
    );
}

export default Results;
