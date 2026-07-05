# Start Here

Hey there! Here's the actual codebase we use for **Polar Winds** — a real-time, 3-player territory-painting puzzle game built with Colyseus and React Three Fiber. It's slightly modified to remove some extraneous code. Feel free to start from this code directly, or use it as a reference as you build out your own games.

## The Docs

Three docs cover three different needs — open the one that matches what you're doing:

- **[DEPLOYMENT.md](DEPLOYMENT.md)** — get the game running on your machine, starting from nothing.
- **[OVERVIEW.md](OVERVIEW.md)** — a guided tour of the code: architecture, the multiplayer/rendering/scoring systems, and recipes for extending it.
- **[CLAUDE.md](CLAUDE.md)** — a quick reference for the project structure, commands, and key files.

## Get It Running

You'll need **Node.js ≥ 20**. From the project root:

```bash
npm run install:all                 # install root, client, and server deps
cp server/.env.example server/.env  # create local env files
cp client/.env.example client/.env
npm run dev                         # start client + server together
```

Then open **http://localhost:8080**. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full step-by-step walkthrough (and troubleshooting).

  

## Play the Game
**Solo mode** — click **Solo Game** in the menu. Use **Tab** to toggle between the characters.

**Multiplayer mode** — start a **Multiplayer Game**. You'll see a room code in the top right. Copy that code, then on the other 2 clients, join the game using that room code.

## Tips

- Use AI anytime to look at the code and explain or summarize anything you don't understand. It's a powerful way to quickly get up to speed and unstick yourself.
