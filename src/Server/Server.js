import express from "express"
const app = express();
import http from "http";
import {Server} from "socket.io"
import cors from "cors"
import {Users} from "../Utils/users.js";
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

let users = new Users();

io.on("connection", (socket) => {
    console.log("User connected: ", socket.id);

    socket.on("joinRoom", ({room, username}) => {
        users.addUser(socket.id, username, room);
        socket.join(room);
        io.to(room).emit("updateUsersList", users.getUserList(room));
    })

    socket.on("changeUsername", ({newUsername}) => {
        let user = users.changeUsername(socket.id, newUsername);
        if (user) {
            io.to(user.room).emit("updateUsersList", users.getUserList(user.room));
        }
        console.log(users.getUserList(user.room));
    })

    socket.on("disconnect", () => {
        let user = users.removeUser(socket.id);
        if (user) {
            io.to(user.room).emit("updateUsersList", users.getUserList(user.room));
        }
    })
})

server.listen(3000, () => {
    console.log("Server listening on port 3000");
})