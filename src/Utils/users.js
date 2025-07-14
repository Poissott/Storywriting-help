export class Users {
    constructor() {
        this.users = [];
    }

    addUser(id, username, room) {
        let user = {id, username, room};
        this.users.push(user);
        return user;
    }

    getUserList (room) {
        let users = this.users.filter(user => user.room === room);
        return users.map(user => user.username);
    }

    getUser(id) {
        return this.users.filter((user) => user.id === id)[0];
    }

    removeUser(id) {
        let user = this.getUser(id);
        if (user) {
            this.users = this.users.filter((user) => user.id !== id);
        }

        return user;
    }
}