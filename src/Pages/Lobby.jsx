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
    const amountOfRounds = [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 3, label: '3' },
        { value: 4, label: '4' },
        { value: 5, label: '5' },
        { value: 6, label: '6' },
        { value: 7, label: '7' },
        { value: 8, label: '8' },
        { value: 9, label: '9' },
        { value: 10, label: '10' },
    ]
    const timerPerRoundOptions = [
        { value: null, label: 'No timer' },
        { value: 30, label: '30 seconds' },
        { value: 60, label: '1 minute' },
        { value: 90, label: '1.5 minutes' },
        { value: 120, label: '2 minutes' },
        { value: 150, label: '2.5 minutes' },
        { value: 180, label: '3 minutes' },
        { value: 240, label: '4 minutes' },
        { value: 300, label: '5 minutes' },
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
        setTimerPerRound = (
            <Select
                value={selectedTimerPerRound}
                options={timerPerRoundOptions}
                onChange={handleSetTimerPerRound}
                placeholder="Select Timer per Round"
            ></Select>
        )
        if (!selectedRounds || !selectedTimerPerRound) {
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
        <div className="bg-one ">
            <div className="min-h-screen min-w-screen content-center">
                <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                    <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                        <button className="text-3xl text-four text-center" onClick={handleCopy}>
                            Copy this: http://localhost:5173/lobby/{roomId}
                        </button>
                        <div className="flex items-center justify-center">
                            <div className="w-full max-w-sm mx-auto flex flex-col gap-2">
                                <input
                                    type="text"
                                    value={username}
                                    onChange={handleUserChange}
                                    className="text-center"
                                />
                                <div style={{minHeight: "2rem"}}>
                                    {userList
                                        .filter(user => user.username !== username)
                                        .map((user, idx) => (
                                            <p key={idx} className="text-center">{user.username}</p>
                                        ))}
                                </div>
                            </div>
                        </div>
                        {startGameButton}
                        <div className="flex items-center justify-center gap-4">
                            {setAmountOfRounds}
                            {setTimerPerRound}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Lobby;