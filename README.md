# Storytelling

Storytelling is a webgame to be played with other people with such interest

## Running

The server needs Postgres and creates its own tables (`game_rooms`, `game_players`) on startup.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Connection string. Alternatively set `DB_USER`, `DB_KEY`, `DB_HOST`, `DB_PORT` and `DB_NAME` |
| `DB_SSL` | Set to `false` for a local database without SSL |
| `PORT` | Server port, 8080 by default |
| `ALLOWED_ORIGINS` | Comma separated CORS origins, every origin is allowed if unset |
| `ENABLE_SOCKET_ADMIN` | `true` enables the socket.io admin UI |
| `SOCKET_ADMIN_USER`, `SOCKET_ADMIN_PASS` | Admin UI login. The password must be a bcrypt hash |

- `npm start` runs the server, which also serves the production build from `npm run build`.
- `npm run dev` runs the Vite dev server, which proxies sockets to the server on port 8080.
- `npm test` plays real games against a real server. It needs the same database variables and should get a database of its own.
