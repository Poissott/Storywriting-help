import {Route, Routes, BrowserRouter} from "react-router-dom";
import MainLayout from "./Layouts/MainLayout.jsx";
import HomePage from "./Pages/HomePage.jsx";
import PlayGame from "./Pages/PlayGame.jsx";
import Lobby from "./Pages/Lobby.jsx";
import Results from "./Pages/Results.jsx";

const App = () => {
    return (
        <>
            <BrowserRouter>
                <Routes>
                    <Route element={<MainLayout />}>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/game/:roomId" element={<PlayGame />} />
                        <Route path="/lobby/:roomId" element={<Lobby />} />
                        <Route path="/results/:roomId" element={<Results />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </>
    )
};

export default App
