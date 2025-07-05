import React, {useState} from 'react';
import wordsTxt from "/wordlist.txt";
import {Link} from "react-router-dom";
import {useQuery} from "@tanstack/react-query";

function PlayGame() {
    const [word, setWord] = useState({word1: "", word2: "", word3: ""});
    const getWords = async () => {
        const words = await fetch(wordsTxt);
        console.log(words.text());
        return await words.text();
    }
    const [data] = useQuery({
        queryFn: getWords,
        queryKey: "wordsTxt",
        staleTime: Infinity,
    })

    pickRandom(data);

    function pickRandom(wordArr) {
        const words = {...word, word1: wordArr[0], word2: wordArr[1], word3: wordArr[2]};
        console.log(words);
        setWord(words);
    }

    return (
        <body  className="bg-one ">
        <div className="min-h-screen min-w-screen content-center">
            <div className="bg-two min-h-100 min-w-200 ml-120 mr-120 rounded-md">
                <div className="container flex flex-col justify-center items-center min-h-100 p-7 gap-5">
                    <text className="text-5xl text-four text-center">Your given words: {word.word1}, {word.word2}, {word.word3}</text>
                </div>
            </div>
        </div>
        </body>
    );
}

export default PlayGame;