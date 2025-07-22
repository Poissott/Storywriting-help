import {Route, Routes, BrowserRouter} from "react-router-dom";
import HomePage from "./Pages/HomePage.jsx";
import PlayGame from "./Pages/PlayGame.jsx";
import Lobby from "./Pages/Lobby.jsx";

const App = () => {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route
                        path="/"
                        element={<HomePage />}
                    />
                    <Route
                        path="/game"
                        element={<PlayGame />}
                    />
                    <Route
                        path="/lobby/:roomId"
                        element={<Lobby />}
                    />
                </Routes>
            </BrowserRouter>
        </>
    )
};

export default App
