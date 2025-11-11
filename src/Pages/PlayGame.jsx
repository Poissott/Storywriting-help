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
    const [endTime, setEndTime] = useState(null);
    const [textareaValue, setTextareaValue] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const navigate = useNavigate();

    const getWords = async () => {
        const text = await fetch(wordsTxt);
        const words = await text.text();
        return words.split("\r\n")
    }

    const {data} = useQuery({
        queryKey: ["wordsTxt"],
        queryFn: getWords,
        staleTime: Infinity
    })

    function handleTextareaChange(e) {
        setTextareaValue(e.target.value);
    }

    function handleSectionSubmission() {
        if (submitted) return;
        socket.emit("submitSection", {room_id: roomId, order: order, section: textareaValue});
        setTextareaValue("");
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

        if (Array.isArray(data)) {
            const threeRandom = (data) => {
                const three = [...data];
                for (let i = three.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [three[i], three[j]] = [three[j], three[i]];
                }
                return three.slice(0, 3);
            }
            const [word1, word2, word3] = threeRandom(data);
            setWord({word1, word2, word3});
        }

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
                        <div className="w-12 h-12 border-4 border-three border-t-accent rounded-full animate-spin"></div>
                        <p className="text-four text-lg">Waiting for Player {order} to finish...</p>
                    </div>
                )}
            </div>
        </div>
    );
}
export default PlayGame;    