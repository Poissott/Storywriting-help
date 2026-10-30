function containsWord(text, word) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu").test(text);
}

// Shared by the client (for instant feedback) and the server (which has the final say).
export function missingWords(text, words) {
    return (words ?? []).filter(word => !containsWord(text, word));
}
