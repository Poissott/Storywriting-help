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
        }

        const handleOrder = (order) => setOrder(order);
        const handleNewTurn = (newTurn) => setUserTurn(newTurn);
        const handleTimerPerRound = (timerPerRound) => setTimer(timerPerRound);

        socket.on("getUserOrder", handleOrder);
        socket.on("newUserTurn", handleNewTurn);
        socket.on("receiveTimerPerRound", handleTimerPerRound);

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

    let playGameView;

    if (order === userTurn) {
        playGameView = <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
            <p className="text-5xl text-four text-center">Your given
                words {order}: {word.word1}, {word.word2}, {word.word3}</p>
            <div className="h-150 w-127 bg-one  border-one rounded-md flex flex-col justify-center items-center p-2">
                <textarea className=" min-h-123 min-w-110 bg-two justify-center items-center text-amber-50 m-2"
                          onChange={handleTextareaChange} value={textareaValue}></textarea>
                <button className="bg-three h-15 min-h-15 w-40 justify-center items-center rounded-md m-2"
                        onClick={handleSectionSubmission}>Submit
                </button>
            </div>
            {endTime && (<Countdown
                date={endTime}
                renderer={timerRenderer}
                onComplete={handleSectionSubmission}
            />)}
        </div>
    } else {
        playGameView = <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
            <p className="text-5xl text-four text-center">Wait for other players to finish. {order}</p>
        </div>
    }

    return (
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    {playGameView}
                </div>
            </div>
        </div>);
}

export default PlayGame;    