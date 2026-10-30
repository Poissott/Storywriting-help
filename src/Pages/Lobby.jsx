import React, {useState} from 'react';
import {Link, useParams} from "react-router-dom";
import socket from "../Server/socket.js";
import Select from "react-select";
import {useRoom} from "../Utils/useRoom.js";
import {getUsername} from "../Utils/session.js";

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

function Lobby() {
    const {roomId} = useParams();
    const {room, me, connected, notFound} = useRoom(roomId, "lobby");
    const [username, setUsername] = useState(getUsername);
    const [startError, setStartError] = useState(null);
    const [showRules, setShowRules] = useState(false);

    const userList = room?.players ?? [];
    const isHost = Boolean(me?.isHost);
    const connectedPlayers = userList.filter(user => user.connected).length;
    const selectedRounds = amountOfRounds.find(option => option.value === room?.rounds) ?? null;
    const selectedRandomWords = yesOrNo.find(option => option.value === room?.randomWords) ?? null;
    const selectedTimerPerRound = timerPerRoundOptions.find(option => option.value === (room?.timerSeconds ?? null));

    function handleCopy() {
        const shareUrl = `${window.location.origin}/lobby/${roomId}`;
        navigator.clipboard.writeText(shareUrl)
            .then(() => alert("Room link copied to clipboard!"))
            .catch(err => console.error("Failed to copy: ", err));
    }

    function handleUserChange(e) {
        const newUsername = e.target.value;
        localStorage.setItem("username", newUsername);
        setUsername(newUsername);
        socket.emit("changeUsername", {newUsername});
    }

    function handleEnterGame() {
        setStartError(null);
        socket.emit("startGame", {}, (res) => {
            if (!res?.ok) setStartError(res?.error ?? "Could not start the game.");
        });
    }

    function handleSetRounds(selectedOption) {
        socket.emit("updateSettings", {rounds: selectedOption.value});
    }

    function handleSetTimerPerRound(selectedOption) {
        socket.emit("updateSettings", {timerSeconds: selectedOption.value});
    }

    function handleSetRandomWords(selectedOption) {
        socket.emit("updateSettings", {randomWords: selectedOption.value});
    }

    if (notFound) {
        return (
            <div className="bg-one min-h-screen flex items-center justify-center p-4">
                <div className="bg-two rounded-2xl shadow-2xl p-8 max-w-2xl w-full flex flex-col items-center gap-4">
                    <p className="text-four text-lg">This room is no longer available.</p>
                    <Link to="/" className="text-accent font-semibold">Back to Home</Link>
                </div>
            </div>
        );
    }

    let startGameButton;
    const setAmountOfRounds = (
        <Select
            value={selectedRounds}
            options={amountOfRounds}
            onChange={handleSetRounds}
            isDisabled={!isHost}
            placeholder="Select Amount of Rounds"
        ></Select>
    );
    const setTimerPerRound = (
        <Select
            value={selectedTimerPerRound}
            options={timerPerRoundOptions}
            onChange={handleSetTimerPerRound}
            isDisabled={!isHost || room?.randomWords !== false}
            placeholder="Select Timer per Round"
        ></Select>
    );
    const setRandomWords = (
        <Select
            value={selectedRandomWords}
            options={yesOrNo}
            onChange={handleSetRandomWords}
            isDisabled={!isHost}
            placeholder="Select Random Words"
        ></Select>
    );
    if (!connected || userList.length === 0) {
        startGameButton = (
            <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                {connected ? "Waiting" : "Reconnecting..."}
            </button>
        );
    } else if (isHost) {
        if (connectedPlayers < 2) {
            startGameButton = (
                <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                    Waiting for Players
                </button>
            );
        } else if (!selectedRounds || !selectedRandomWords) {
            startGameButton = (
                <button className="bg-three min-h-15 min-w-40 object-center rounded-md" disabled>
                    Select Settings
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
                                        {userList.map((user) => (
                                            <div key={user.id} className={`flex items-center gap-2 text-four ${user.connected ? "" : "opacity-50"}`}>
                                                <span className="w-2 h-2 bg-accent rounded-full"></span>
                                                {user.username} {user.isHost && <span className="text-three text-xs font-bold">HOST</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="bg-one rounded-lg p-6 space-y-4">
                        <p className="text-four font-semibold">Game Settings</p>
                        <div className="space-y-3">
                            {setAmountOfRounds}
                            {setRandomWords}
                            {setTimerPerRound}
                        </div>
                    </div>

                    {startError && (
                        <p className="text-three text-sm font-medium text-center">{startError}</p>
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
                        <p><span className="text-accent font-semibold">2.2 Mode without random words:</span> Write your sections as you wish.
                            Additionally, you can set time limit per round in this mode.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
export default Lobby;
