import React, {useEffect, useRef, useState} from 'react';
import {Link, useLocation, useNavigate, useParams} from "react-router-dom";
import socket from "../Server/socket.js";
import Select from "react-select";

function Lobby() {
    const {roomId} = useParams();
    const [userList, setUserList] = useState([]);
    const [isHost, setIsHost] = useState(false);
    const [username, setUsername] = useState("");
    const [selectedRounds, setSelectedRounds] = useState(null);
    const [selectedTimerPerRound, setSelectedTimerPerRound] = useState(null);
    const [selectedRandomWords, setSelectedRandomWords] = useState(null);
    const [showRules, setShowRules] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    function handleCopy() {
        navigator.clipboard.writeText(`http://localhost:5173/lobby/${roomId}`)
            .then(() => alert("Room ID copied to clipboard: " + roomId))
            .catch(err => console.error("Failed to copy: ", err));
    }

    function handleUserChange(e) {
        const newUsername = e.target.value;
        localStorage.setItem("username", newUsername);
        setUsername(newUsername);
        socket.emit("changeUsername", {newUsername});
    }

    function handleEnterGame() {
        socket.emit("EnterGame", {room: roomId, isHost: isHost})
    }

    function handleSetRounds(selectedOption) {
        setSelectedRounds(selectedOption);
        socket.emit("setRounds", {room: roomId, rounds: selectedOption.value});
    }

    function handleSetTimerPerRound(selectedOption) {
        setSelectedTimerPerRound(selectedOption);
        socket.emit("setTimerPerRound", {room: roomId, timerPerRound: selectedOption.value});
    }

    function handleSetRandomWords(selectedOption) {
        setSelectedRandomWords(selectedOption);
        if (selectedOption.value === true) {
            setSelectedTimerPerRound(null);
            socket.emit("setTimerPerRound", {room: roomId, timerPerRound: null});
        }
        socket.emit("setRandomWords", {room: roomId, randomWords: selectedOption.value});
    }

    useEffect(() => {
        let localUsername = localStorage.getItem("username");
        if (!localUsername) {
            localUsername = "Player" + Math.floor(Math.random() * 1000);
            localStorage.setItem("username", localUsername);
        }
        setUsername(localUsername);

        socket.emit("createRoom", {room_id: roomId});
        socket.emit("joinRoom", {room: roomId, username: localUsername});
        socket.off("updateUsersList");
        socket.on("updateUsersList", (users) => setUserList(users));

        return () => {
            socket.off("updateUsersList");
            socket.off("hostStatus");
        };
    }, [roomId]);

    useEffect(() => {
        const currentUser = userList.find(u => u.username === username);
        setIsHost(currentUser?.host === "Host");
    }, [userList, username]);

    useEffect(() => {
        if (!socket) return;
        socket.on("enterGame", (isHost) => {
            navigate(`/game/${roomId}`);
        })
    });

    let startGameButton;
    let setAmountOfRounds;
    let setTimerPerRound;
    let setRandomWords;
    const amountOfRounds = [
        {value: 1, label: '1'},
        {value: 2, label: '2'},
        {value: 3, label: '3'},
        {value: 4, label: '4'},
        {value: 5, label: '5'},
        {value: 6, label: '6'},
        {value: 7, label: '7'},
        {value: 8, label: '8'},
        {value: 9, label: '9'},
        {value: 10, label: '10'},
    ]
    const timerPerRoundOptions = [
        {value: null, label: 'No timer'},
        {value: 30, label: '30 seconds'},
        {value: 60, label: '1 minute'},
        {value: 90, label: '1.5 minutes'},
        {value: 120, label: '2 minutes'},
        {value: 150, label: '2.5 minutes'},
        {value: 180, label: '3 minutes'},
        {value: 240, label: '4 minutes'},
        {value: 300, label: '5 minutes'},
    ]
    const yesOrNo = [
        {value: true, label: 'Yes'},
        {value: false, label: 'No'},
    ]
    if (userList.length === 0) {
        startGameButton = (
            <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                Waiting
            </button>
        );
    } else if (isHost) {
        setAmountOfRounds = (
            <Select
                value={selectedRounds}
                options={amountOfRounds}
                onChange={handleSetRounds}
                placeholder="Select Amount of Rounds"
            ></Select>
        )
        if (selectedRandomWords && selectedRandomWords.value === false) {
            setTimerPerRound = (
                <Select
                    value={selectedTimerPerRound}
                    options={timerPerRoundOptions}
                    onChange={handleSetTimerPerRound}
                    placeholder="Select Timer per Round"
                ></Select>
            )
        } else {
            setTimerPerRound = (
                <Select
                    value={selectedTimerPerRound}
                    options={timerPerRoundOptions}
                    onChange={handleSetTimerPerRound}
                    isDisabled={true}
                    placeholder="Select Timer per Round (Disabled)"
                ></Select>
            )
        }
        setRandomWords = (
            <Select
                value={selectedRandomWords}
                options={yesOrNo}
                onChange={handleSetRandomWords}
                placeholder="Select Random Words"
            ></Select>
        )
        if (userList.length < 2) {
            startGameButton = (
                <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                    Waiting for Players
                </button>
            );
        } else if ((!selectedRounds || !selectedTimerPerRound || !selectedRandomWords) && (!selectedRounds || !selectedRandomWords || selectedRandomWords.value === false)) {
            startGameButton = (
                <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                    Select Rounds
                </button>
            );
        } else {
            startGameButton = (
                <button className="bg-three min-h-15 min-w-40 object-center rounded-md" onClick={handleEnterGame}>
                    Start Game
                </button>
            );
        }
    } else {
        startGameButton = (
            <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                Waiting for Host
            </button>
        );
    }

    return (
        <div className="bg-one min-h-screen flex items-center justify-center p-4 gap-4">
            <div className="bg-two rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
                <div className="flex flex-col gap-6">
                    <button
                        onClick={handleCopy}
                        className="bg-three/10 hover:bg-three/20 text-three font-semibold py-3 px-4 rounded-lg transition-colors text-sm md:text-base"
                    >
                        📋 Copy Room Link: {roomId}
                    </button>

                    <div className="bg-one rounded-lg p-6 space-y-4">
                        <label className="block text-four text-sm font-semibold">Your Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={handleUserChange}
                            className="w-full bg-two text-four border-2 border-accent rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
                        />

                        <div className="mt-4">
                            <p className="text-four text-sm font-semibold mb-2">Players ({userList.length})</p>
                            <div className="bg-one rounded-lg p-4 min-h-20">
                                {userList.length === 0 ? (
                                    <p className="text-four/50">Waiting for players...</p>
                                ) : (
                                    <div className="space-y-2">
                                        {userList.map((user, idx) => (
                                            <div key={idx} className="flex items-center gap-2 text-four">
                                                <span className="w-2 h-2 bg-accent rounded-full"></span>
                                                {user.username} {user.host === "Host" && <span className="text-three text-xs font-bold">HOST</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {isHost && (
                        <div className="bg-one rounded-lg p-6 space-y-4">
                            <p className="text-four font-semibold">Game Settings</p>
                            <div className="space-y-3">
                                {setAmountOfRounds}
                                {setRandomWords}
                                {setTimerPerRound}
                            </div>
                        </div>
                    )}

                    <div className="flex justify-center pt-4">
                        {startGameButton}
                        <button
                            onClick={() => setShowRules(!showRules)}
                            className="bg-accent/10 hover:bg-accent/20 text-accent font-semibold py-3 px-6 rounded-lg transition-all duration-200"
                        >
                            📖 Rules
                        </button>
                    </div>
                </div>
            </div>
            <div
                className={`bg-two rounded-2xl shadow-2xl p-6 transition-all duration-500 transform ${
                    showRules ? 'opacity-100 translate-x-0 w-72' : 'opacity-0 translate-x-8 pointer-events-none w-0'
                }`}
            >
                <div className="flex flex-col gap-4">
                    <button
                        onClick={() => setShowRules(false)}
                        className="text-accent hover:text-accent/80 text-2xl leading-none self-end"
                    >
                        ×
                    </button>
                    <h2 className="text-three font-bold text-lg">Game Rules</h2>
                    <div className="text-four text-sm space-y-3 max-h-96 overflow-y-auto">
                        <p><span className="text-accent font-semibold">1. Objective:</span> Create a collaborative story by taking turns writing sections. You can play this game with 2 or more players.</p>
                        <p><span className="text-accent font-semibold">2.1 Mode with random words:</span> Every turn you are given random set of words
                            that you have to include in exact spelling as you have been given. You can not set time limit per round in this mode.</p>
                        <p><span className="text-accent font-semibold">2.1 Mode without random words:</span> Write your sections as you wish.
                            Additionally, you can set time limit per round in this mode.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
export default Lobby;
