# Polar Winds

Multiplayer web game built with Colyseus and React Three Fiber.

## Project Structure

- `client/` - React frontend (Vite + TypeScript + Three.js)
- `server/` - Colyseus game server (Express + TypeScript)

## Commands

```bash
npm run dev          # Run both client and server concurrently
npm run dev:client   # Run client only (port 5173)
npm run dev:server   # Run server only (port 2567)
npm run build:client # Build client for production
npm run install:all  # Install all dependencies
```

## Tech Stack

**Client:** React 19, React Three Fiber, shadcn/ui, Tailwind CSS, colyseus.js, LiveKit
**Server:** Colyseus, Express, LiveKit Server SDK

## Key Files

- `server/rooms/GameRoom.ts` - Main game room logic
- `server/schema/GameState.ts` - Colyseus state schema
- `server/config/collectible-spawn.json` - Collectible spawn configuration
- `client/src/screens/` - Game screens
- `client/src/components/` - React components

## Deployment

In production the server serves the built client (`client/dist`) and falls back to `index.html` for SPA routes, so a single Node service can host both. See `DEPLOYMENT.md` for running locally.
