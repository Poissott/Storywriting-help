import React, {useEffect, useState} from 'react';
import wordsTxt from "/wordlist.txt";
import {Link, useNavigate, useParams} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";
import socket from "../Server/socket.js";
import Countdown from "react-countdown";

function PlayGame() {
    const {roomId} = useParams();
    const [word, setWord] = useState({word1: "", word2: "", word3: ""});
    const [order, setOrder] = useState(null);
    const [userTurn, setUserTurn] = useState(1);
    const [timer, setTimer] = useState(null);
    const [allowSelectedRandomWords, setAllowSelectedRandomWords] = useState(null);
    const [randomWordsFulfilledPopup, setRandomWordsFulfilledPopup] = useState(false);
    const [emptyTextareaPopup, setEmptyTextareaPopup] = useState(false);
    const [endTime, setEndTime] = useState(null);
    const [textareaValue, setTextareaValue] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate();

    const getWords = async () => {
        const text = await fetch(wordsTxt);
        const words = await text.text();
        return words.split("\r\n")
    }

    let {data} = useQuery({
        queryKey: ["wordsTxt"],
        queryFn: getWords,
        staleTime: Infinity
    })

    function handleTextareaChange(e) {
        setTextareaValue(e.target.value);
    }

    function handleSectionSubmission() {
        if (textareaValue.trim() === "") {
            setEmptyTextareaPopup(true)
            return;
        } else {
            setEmptyTextareaPopup(false)
        }
        if (allowSelectedRandomWords === true) {
            const lowerCaseText = textareaValue.trim().toLowerCase();
            const missing = [
                word.word1.toLowerCase(),
                word.word2.toLowerCase(),
                word.word3.toLowerCase()
            ].filter(w => !lowerCaseText.includes(w));

            if (missing.length > 0) {
                setRandomWordsFulfilledPopup(true);
                return;
            }
        } else {
            setRandomWordsFulfilledPopup(false);
        }
        if (submitted) return;
        socket.emit("submitSection", {room_id: roomId, order: order, section: textareaValue});
        setTextareaValue("");
        setRandomWordsFulfilledPopup(false)
        setEmptyTextareaPopup(false);
        setSubmitted(true);
    }

    useEffect(() => {
        if (order === userTurn) setSubmitted(false);
    }, [order, userTurn]);

    useEffect(() => {
        if (order === userTurn && timer) {
            setEndTime(Date.now() + timer);
        }
    }, [order, userTurn, timer]);

    useEffect(() => {
        if (order === userTurn && Array.isArray(data)) {
            const threeRandom = (data) => {
                const copy = [...data];
                for (let i = copy.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [copy[i], copy[j]] = [copy[j], copy[i]];
                }
                return copy.slice(0, 3);
            };

            const [w1, w2, w3] = threeRandom(data);
            setWord({word1: w1, word2: w2, word3: w3});
        }
    }, [order, userTurn, data]);

    useEffect(() => {
        if (order === null) {
            socket.emit("createOrder", {room_id: roomId});
            socket.emit("getTimerPerRound", roomId);
            socket.emit("getSelectedRandomWords", roomId);
        }

        const handleOrder = (order) => setOrder(order);
        const handleNewTurn = (newTurn) => setUserTurn(newTurn);
        const handleTimerPerRound = (timerPerRound) => setTimer(timerPerRound);
        const handleSelectedRandomWords = (randomWords) => setAllowSelectedRandomWords(randomWords);

        socket.on("getUserOrder", handleOrder);
        socket.on("newUserTurn", handleNewTurn);
        socket.on("receiveTimerPerRound", handleTimerPerRound);
        socket.on("receiveSelectedRandomWords", handleSelectedRandomWords);

        return () => {
            socket.off("getUserOrder", handleOrder);
            socket.off("newUserTurn", handleNewTurn);
            socket.off("receiveTimerPerRound");
            socket.off("receiveSelectedRandomWords");
        }
    }, [data, order, roomId]);

    useEffect(() => {
        if (!socket) return;
        socket.on("gameOver", () => {
            navigate(`/results/${roomId}`);
        })
    });

    const timerRenderer = ({minutes, seconds}) => {
        return <span className="text-four">{minutes}:{seconds}</span>;
    };

    let randomWordsDiv;
    let timerDiv;

    if (allowSelectedRandomWords === true) {
        randomWordsDiv = (
            <p className="text-5xl text-four text-center">
                Your given words: {word.word1}, {word.word2}, {word.word3}</p>
        );
    } else {
        timerDiv = endTime && (<Countdown
            date={endTime}
            renderer={timerRenderer}
            onComplete={handleSectionSubmission}
        />);
    }

    return (
        <div className="bg-one min-h-screen flex items-center justify-center p-4">
            <div className="bg-two rounded-2xl shadow-2xl p-8 max-w-3xl w-full">
                {order === userTurn ? (
                    <div className="flex flex-col gap-6">
                        {randomWordsDiv && (
                            <div className="bg-accent/10 rounded-lg p-6 border-2 border-accent">
                                <p className="text-three font-bold text-center">{randomWordsDiv}</p>
                            </div>
                        )}

                        <div className="flex flex-col gap-3">
                        <textarea
                            className="w-full h-64 bg-one text-four border-2 border-accent rounded-lg p-4 focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                            onChange={handleTextareaChange}
                            value={textareaValue}
                            placeholder="Write your story section here..."
                        />
                            {randomWordsFulfilledPopup && (
                                <div
                                    className="w-full bg-three/10 border border-three text-three px-4 py-2 rounded-lg mt-1 text-sm font-medium">
                                    You must include all three required words:
                                    <span className="ml-1 font-bold">
                                        {[word.word1, word.word2, word.word3]
                                        .filter(w => !textareaValue.toLowerCase().includes(w.toLowerCase()))
                                        .join(", ")}
                                    </span>
                                </div>
                            )}

                            {emptyTextareaPopup && (
                                <div
                                    className="w-full bg-three/10 border border-three text-three px-4 py-2 rounded-lg mt-1 mb-1 text-sm font-medium">
                                    Please write something before submitting.
                                </div>
                            )}
                            <div className="flex justify-between items-center gap-4">
                                <button
                                    className="flex-1 bg-three hover:bg-accent text-one font-bold py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={handleSectionSubmission}
                                    disabled={submitted}
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
                        <p className="text-four text-lg">Waiting for Player {order} to finish...</p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default PlayGame;