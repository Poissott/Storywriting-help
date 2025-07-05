import React, {useEffect, useState} from 'react';
import wordsTxt from "/wordlist.txt";
import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

function PlayGame() {
    const [word, setWord] = useState({word1: "", word2: "", word3: ""});

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

    useEffect(() => {
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
    }, [data])

    return (<div className="bg-one ">
        <div className="min-h-screen min-w-screen content-center">
            <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                    <p className="text-5xl text-four text-center">Your given
                        words: {word.word1}, {word.word2}, {word.word3}</p>
                    <div className="h-150 w-127 bg-one  border-one rounded-md flex flex-col justify-center items-center p-2">
                        <textarea className=" min-h-123 min-w-110 bg-two justify-center items-center text-amber-50 m-2"></textarea>
                        <button className="bg-three h-15 min-h-15 w-40 justify-center items-center rounded-md m-2">Submit</button>
                    </div>
                </div>
            </div>
        </div>
    </div>);
}

export default PlayGame;    