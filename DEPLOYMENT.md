# Running Polar Winds Locally

This guide walks you through running Polar Winds on your own computer, starting
from scratch. It assumes you have **nothing installed yet** — no Node.js, no
build tools, nothing. Just follow the steps in order.

Polar Winds has two parts that both need to be running:

- **Client** — the game you see in the browser (runs on port `8080`)
- **Server** — the multiplayer game server (runs on port `2567`)

The included `npm run dev` command starts both at once.

---

## Step 1: Install Node.js

Node.js is the runtime that powers both the client and the server. Installing it
also installs `npm`, the package manager used to download the project's
dependencies.

You need **Node.js version 20 or newer**.

### macOS / Windows / Linux (easiest)

1. Go to <https://nodejs.org/>
2. Download the **LTS** ("Long Term Support") installer for your operating system.
3. Run the installer and accept the defaults.

### Verify the install

Open a terminal (Terminal on macOS/Linux, PowerShell or Command Prompt on
Windows) and run:

```bash
node --version
npm --version
```

You should see version numbers print out (e.g. `v20.x.x` and `10.x.x`). If you
see a "command not found" error, close and reopen your terminal, or restart your
computer so the install takes effect.

> **Tip:** You do **not** need to install Three.js, React, Colyseus, or any other
> library separately. Those are listed in the project and get downloaded
> automatically in Step 3.

---

## Step 2: Get the Code

If you already have the project folder, skip to Step 3.

Otherwise, clone the repository. This requires [Git](https://git-scm.com/) — if
`git --version` fails, download it from that link first (or just download the
project as a ZIP from your code host and unzip it).

```bash
git clone <your-repository-url>
cd polar-winds-game
```

---

## Step 3: Install Dependencies

From the project root (the `polar-winds-game` folder), run:

```bash
npm run install:all
```

This installs the dependencies for the root, the client, and the server in one
step. The first run downloads a lot of packages and may take a few minutes — this
is normal.

---

## Step 4: Set Up Environment Variables

The project reads configuration from `.env` files. The repo ships with
`.env.example` templates — copy them to create your local `.env` files.

```bash
# Server config
cp server/.env.example server/.env

# Client config
cp client/.env.example client/.env
```

> On Windows PowerShell, use `Copy-Item server/.env.example server/.env` instead
> of `cp`.

The defaults already point everything at `localhost`, so you don't need to change
anything to play locally. For reference, here is what they contain:

**`server/.env`**

```
PORT=2567
NODE_ENV=development
CLIENT_URL=http://localhost:8080
```

**`client/.env`**

```
VITE_SERVER_URL=ws://localhost:2567
```

### Optional: voice/video chat (LiveKit)

The game uses [LiveKit](https://livekit.io/) for in-game voice and video. This is
**optional** — the game runs fine without it, you just won't have voice/video. To
enable it, add your LiveKit credentials to `server/.env`:

```
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your-api-key
LIVEKIT_API_SECRET=your-api-secret
```

You can get free credentials from [LiveKit Cloud](https://cloud.livekit.io/).
Skip this section entirely if you don't need voice/video.

---

## Step 5: Run the Game

From the project root, start both the client and server together:

```bash
npm run dev
```

You'll see logs from both the client (Vite) and the server (Colyseus) in the same
terminal. When it's ready, open your browser to:

**<http://localhost:8080>**

That's it — the game is running locally. 🎮

### Running them separately (optional)

If you prefer two separate terminals, you can start each part on its own:

```bash
npm run dev:client   # Client only — http://localhost:8080
npm run dev:server   # Server only — ws://localhost:2567
```

---

## Verifying the Server

To confirm the server is up, open <http://localhost:2567/health> in your browser,
or run:

```bash
curl http://localhost:2567/health
```

Expected response:

```json
{"status":"ok","timestamp":"..."}
```

---

## Stopping the Game

In the terminal running `npm run dev`, press **`Ctrl + C`**. This stops both the
client and the server.

---

## Troubleshooting

### `node` or `npm` not found

Node.js isn't installed or your terminal hasn't picked it up yet. Revisit Step 1,
then close and reopen your terminal.

### "Port already in use" (`EADDRINUSE`)

Something else is already using port `8080` or `2567` — often a previous run of
this game that didn't shut down.

- Close any other terminal still running `npm run dev`.
- Or find and stop the process using the port:

```bash
# macOS / Linux
lsof -i :2567        # find the process ID (PID)
kill <PID>

# Windows (PowerShell)
netstat -ano | findstr :2567
taskkill /PID <PID> /F
```

### Install fails or behaves strangely

Delete the installed packages and reinstall from a clean slate:

```bash
rm -rf node_modules client/node_modules server/node_modules
npm run install:all
```

> On Windows PowerShell:
> `Remove-Item -Recurse -Force node_modules, client/node_modules, server/node_modules`

### Browser shows a blank page or "can't connect"

- Make sure **both** the client and server are running (use `npm run dev`, not
  just the client).
- Confirm you're visiting <http://localhost:8080> (the client), not the server
  port.
- Check `client/.env` has `VITE_SERVER_URL=ws://localhost:2567`. If you change a
  `.env` file, restart `npm run dev` so it's picked up.

### Voice/video doesn't work

This is expected unless you've configured LiveKit — see the optional step above.
The rest of the game works without it.

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable             | Required | Default                 | Description                              |
|----------------------|----------|-------------------------|------------------------------------------|
| `PORT`               | No       | `2567`                  | Port the game server listens on          |
| `NODE_ENV`           | No       | `development`           | Environment mode                         |
| `CLIENT_URL`         | No       | `*`                     | CORS allowed origin (the client's URL)   |
| `LIVEKIT_URL`        | No       | —                       | LiveKit server URL (voice/video, optional) |
| `LIVEKIT_API_KEY`    | No       | —                       | LiveKit API key (optional)               |
| `LIVEKIT_API_SECRET` | No       | —                       | LiveKit API secret (optional)            |

### Client (`client/.env`)

| Variable           | Required | Default                | Description                          |
|--------------------|----------|------------------------|--------------------------------------|
| `VITE_SERVER_URL`  | No       | `ws://localhost:2567`  | WebSocket URL of the game server     |

---

## Additional Resources

- [Node.js Downloads](https://nodejs.org/)
- [Colyseus Documentation](https://docs.colyseus.io/)
- [React Three Fiber Documentation](https://r3f.docs.pmnd.rs/)
- [LiveKit Documentation](https://docs.livekit.io/) (only needed for voice/video)
