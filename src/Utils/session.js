function randomId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}

// Secret that identifies this player across reconnects and refreshes. It is per tab,
// so two tabs in one browser are two players.
export function getPlayerId() {
    let playerId = sessionStorage.getItem("playerId");
    if (!playerId) {
        playerId = randomId();
        sessionStorage.setItem("playerId", playerId);
    }
    return playerId;
}

export function getUsername() {
    let username = localStorage.getItem("username");
    if (!username) {
        username = "Player" + Math.floor(Math.random() * 1000);
        localStorage.setItem("username", username);
    }
    return username;
}
