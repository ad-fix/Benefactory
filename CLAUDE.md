# Benefactory

3-player co-op puzzle game (browser). Factory setting, bomb-defusal frame.
Adapted from the Polar Winds codebase — architecture is preserved, game rules are being replaced.

## Commands
- `npm run dev` — starts client (Vite, :8080) AND server (Colyseus, :2567) together
- Client hot-reloads; server auto-restarts via tsx watch
- Test by opening 2-3 tabs at localhost:8080 joining the same room
- Colyseus monitor (rooms/clients/state inspector): localhost:2567/colyseus

## Architecture (do not violate)
- SERVER-AUTHORITATIVE: clients send intents, server validates and updates state,
  Colyseus syncs to all clients. Never let the client decide game outcomes.
- Levels are swappable classes implementing BaseLevel (server/levels/BaseLevel.ts):
  onLevelStart, canPlayerMoveTo, onPlayerMove, isLevelComplete, onDispose.
  GameRoom delegates movement validation and reactions to the current level.
- 3 roles assigned on join: OPERATOR, ENGINEER, MONITOR (same pattern as color assignment).
- In this game, levels put players on SEPARATE boards — player collision is LEVEL
  logic (each level's canPlayerMoveTo), not core logic.
- Puzzle answers / hidden info stay server-side private fields — never in synced
  schema unless a role legitimately needs it rendered.

## Team file ownership — IMPORTANT
- SHARED (never modify unless explicitly instructed):
  server/rooms/GameRoom.ts, server/schema/GameState.ts, server/levels/BaseLevel.ts,
  client/src/screens/GameScreen.tsx, root config files
- Each level lives in its own files:
  - server/levels/RolesLevel.ts + client/src/levels/roles/ — this machine's owner
  - server/levels/WireLevel.ts, server/levels/ConveyorLevel.ts + their client
    folders — teammates' files, DO NOT TOUCH
- In GameState.ts, each level gets its own nested Schema class; only edit RolesLevelState.

## Conventions
- TypeScript throughout. Match existing code style.
- Simple visuals: flat colored shapes, no custom shaders, no new art assets.
- Reuse existing patterns: color assignment (onJoin), dev controls (devStageUp),
  Strategy pattern (see old collectibles structure) for button behaviors.
- One feature per prompt. Never batch unrelated changes.
- The game is 3-player multiplayer ONLY. No single-player mode. Dev-only tools
  exist purely for testing: solo-entry flag (bypasses 3-player start gate) and
  a dev role-switcher to view/act as any role in one tab.
- Full design spec for the roles level: docs/benefactory-roles-level-plan-v2.md —
  consult when asked to implement plan items.