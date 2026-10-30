import React, {useEffect, useRef, useState} from 'react';
import {Link, useParams} from "react-router-dom";
import socket from "../Server/socket.js";
import Countdown, {zeroPad} from "react-countdown";
import {useRoom} from "../Utils/useRoom.js";
import {missingWords} from "../Utils/words.js";

const MAX_SECTION_LENGTH = 5000;

function PlayGame() {
    const {roomId} = useParams();
    const {room, me, connected, notFound} = useRoom(roomId, "game");
    const [randomWordsFulfilledPopup, setRandomWordsFulfilledPopup] = useState(false);
    const [emptyTextareaPopup, setEmptyTextareaPopup] = useState(false);
    const [submitError, setSubmitError] = useState(null);
    const [textareaValue, setTextareaValue] = useState("");
    const [submittedTurn, setSubmittedTurn] = useState(null);
    const textareaRef = useRef("");
    textareaRef.current = textareaValue;

    const turnKey = room ? `${room.round}:${room.currentTurn}` : null;
    const isMyTurn = Boolean(me && room?.phase === "playing" && me.order === room.currentTurn);
    const submitted = submittedTurn === turnKey;
    const words = room?.words;
    const currentPlayer = room?.players.find(player => player.order === room.currentTurn);

    useEffect(() => {
        setRandomWordsFulfilledPopup(false);
        setEmptyTextareaPopup(false);
        setSubmitError(null);
        if (!isMyTurn) setTextareaValue("");
    }, [turnKey, isMyTurn]);

    function handleTextareaChange(e) {
        setTextareaValue(e.target.value);
    }

    function submit(section) {
        setSubmittedTurn(turnKey);
        setSubmitError(null);
        socket.emit("submitSection", {section}, (res) => {
            if (res?.ok) {
                setTextareaValue("");
            } else {
                setSubmittedTurn(null);
                setSubmitError(res?.error ?? "Could not submit, please try again.");
            }
        });
    }

    function handleSectionSubmission() {
        if (submitted) return;
        if (textareaValue.trim() === "") {
            setEmptyTextareaPopup(true);
            return;
        }
        setEmptyTextareaPopup(false);
        if (missingWords(textareaValue, words).length > 0) {
            setRandomWordsFulfilledPopup(true);
            return;
        }
        setRandomWordsFulfilledPopup(false);
        submit(textareaValue);
    }

    // When time runs out, hand in whatever was written. With nothing written the
    // server skips the turn on its own.
    function handleTimerComplete() {
        if (!submitted && textareaRef.current.trim() !== "") {
            submit(textareaRef.current);
        }
    }

    const timerRenderer = ({minutes, seconds}) => {
        return <span>{zeroPad(minutes)}:{zeroPad(seconds)}</span>;
    };

    let notice;
    if (notFound) {
        notice = "This game no longer exists.";
    } else if (room?.phase === "playing" && !me) {
        notice = "This game has already started without you.";
    }
    if (notice) {
        return (
            <div className="bg-one min-h-screen flex items-center justify-center p-4">
                <div className="bg-two rounded-2xl shadow-2xl p-8 max-w-3xl w-full flex flex-col items-center gap-4">
                    <p className="text-four text-lg">{notice}</p>
                    <Link to="/" className="link">Back to Home</Link>
                </div>
            </div>
        );
    }

    const timerDiv = room?.deadline && (
        <Countdown
            key={turnKey}
            date={room.deadline}
            renderer={timerRenderer}
            onComplete={isMyTurn ? handleTimerComplete : undefined}
        />
    );

    return (
        <div className="bg-one min-h-screen flex items-center justify-center p-4">
            <div className="bg-two rounded-2xl shadow-2xl p-8 max-w-3xl w-full">
                {!connected && (
                    <p className="text-three text-sm font-medium text-center mb-4">Connection lost, reconnecting...</p>
                )}
                {room?.phase === "playing" && (
                    <p className="text-four/60 text-sm text-center mb-4">Round {room.round} of {room.rounds}</p>
                )}
                {isMyTurn ? (
                    <div className="flex flex-col gap-6">
                        {words && (
                            <div className="bg-accent/10 rounded-lg p-6 border-2 border-accent">
                                <p className="text-5xl text-four text-center font-bold">
                                    Your given words: {words.join(", ")}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                        <textarea
                            className="field h-64 !bg-one !p-4 resize-none"
                            onChange={handleTextareaChange}
                            value={textareaValue}
                            maxLength={MAX_SECTION_LENGTH}
                            placeholder="Write your story section here..."
                        />
                            {randomWordsFulfilledPopup && (
                                <div
                                    className="w-full bg-three/10 border border-three text-three px-4 py-2 rounded-lg mt-1 text-sm font-medium">
                                    You must include all three required words:
                                    <span className="ml-1 font-bold">
                                        {missingWords(textareaValue, words).join(", ")}
                                    </span>
                                </div>
                            )}

                            {emptyTextareaPopup && (
                                <div
                                    className="w-full bg-three/10 border border-three text-three px-4 py-2 rounded-lg mt-1 mb-1 text-sm font-medium">
                                    Please write something before submitting.
                                </div>
                            )}

                            {submitError && (
                                <div
                                    className="w-full bg-three/10 border border-three text-three px-4 py-2 rounded-lg mt-1 mb-1 text-sm font-medium">
                                    {submitError}
                                </div>
                            )}
                            <div className="flex justify-between items-center gap-4">
                                <button
                                    className="btn-primary flex-1"
                                    onClick={handleSectionSubmission}
                                    disabled={submitted || !connected}
                                >
                                    {submitted ? "Submitted" : "Submit"}
                                </button>
                                {timerDiv && (
                                    <div className="text-2xl font-bold text-warning">{timerDiv}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 gap-4">
                        <div
                            className="w-12 h-12 border-4 border-three border-t-accent rounded-full animate-spin"></div>
                        <p className="text-four text-lg">
                            {currentPlayer ? `Waiting for ${currentPlayer.username} to finish...` : "Loading game..."}
                        </p>
                        {timerDiv && (
                            <div className="text-2xl font-bold text-warning">{timerDiv}</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlayGame;
