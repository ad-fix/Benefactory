# Polar Winds — Code Walkthrough

**Polar Winds** is a real-time, 3-player territory-painting puzzle game. Three players — `RED`, `GREEN`, and `BLUE` — move around a shared grid, painting the cells they step on. Painting connects *collectibles* (clues) into scoring patterns; the combined score of all three players pushes the game through eight expanding *stages*. The whole thing runs in the browser with 3D graphics, optional voice chat, and a server that owns the rules.

The stack in one line: **[Colyseus](https://colyseus.io/)** for authoritative multiplayer state sync, **[React Three Fiber](https://r3f.docs.pmnd.rs/)** (Three.js) for rendering, and **[LiveKit](https://livekit.io/)** for in-game real-time voice.

> _Add a screenshot or GIF of the board here once you have one._

---

## Who this README is for

You're a game-development intern who's going to read this code, change it, and fork it into your own game. This document is a **guided tour of a working multiplayer game** — not just setup instructions. It moves from a fast mental model to a file-by-file breakdown, then drills into the three systems that take the longest to understand on your own:

1. **[Colyseus multiplayer](#concept-1-colyseus-multiplayer)** — how client and server stay in sync.
2. **[Rendering, shaders & material instancing](#concept-2-rendering-shaders--material-instancing)** — how the 3D board is drawn fast.
3. **[Core scoring logic](#concept-3-core-scoring-logic)** — how painting turns into points.

The last section, **[Extend it yourself](#extend-it-yourself--recipes)**, is a set of copy-paste recipes ("add a collectible type", "add a shader", "change scoring") that point at the exact files to touch.

### Table of contents

- [Quick start](#quick-start)
- [High-level architecture](#high-level-architecture)
- [Repository layout](#repository-layout)
- [The game loop & lifecycle](#the-game-loop--lifecycle)
- [Concept 1: Colyseus multiplayer](#concept-1-colyseus-multiplayer)
- [Concept 2: Rendering, shaders & material instancing](#concept-2-rendering-shaders--material-instancing)
- [Concept 3: Core scoring logic](#concept-3-core-scoring-logic)
- [Enemies (AI)](#enemies-ai)
- [Voice (LiveKit)](#voice-livekit)
- [Extend it yourself — recipes](#extend-it-yourself--recipes)
- [Environment variables](#environment-variables)
- [Deployment](#deployment)
- [Troubleshooting & gotchas](#troubleshooting--gotchas)

---

## Quick start

**Prerequisites:** Node.js ≥ 20 and npm.

```bash
# 1. Install dependencies for root, client, and server
npm run install:all

# 2. Create local env files from the examples
cp client/.env.example client/.env
cp server/.env.example server/.env

# 3. Run client + server together
npm run dev
```

- **Client** runs on **http://localhost:8080** (Vite).
- **Server** runs on **ws://localhost:2567** (Colyseus + Express).
- The server's debug dashboard (rooms, clients, state) is at **http://localhost:2567/colyseus**.

> The **core game runs with no secrets** — the env examples only set the server URL, port, and CORS origin. LiveKit voice needs extra keys (see [Environment variables](#environment-variables)); without them, the game simply runs without voice.

### Playing locally

The game needs **3 players**. To test multiplayer on one machine, open three browser tabs to `http://localhost:8080` and join the same room. Alternatively the server supports a **solo mode** (one human + two auto-filled AI players) — see [The game loop & lifecycle](#the-game-loop--lifecycle).

Server-only or client-only:

```bash
npm run dev:server   # server on :2567
npm run dev:client   # client on :8080
```

The server's own quick-start lives in [server/README.md](server/README.md).

---

## High-level architecture

Polar Winds is **server-authoritative**: the server owns all game state and rules, and clients only render what the server tells them and send intents ("I pressed up"). This prevents cheating and keeps all three players consistent.

```
                         WebSocket (Colyseus protocol)
   ┌─────────────────┐   state diffs ───────────────▶   ┌──────────────────────┐
   │   client/        │                                  │   server/             │
   │  React 19 + R3F  │   ◀─────────── "move", "ping"    │  Colyseus + Express   │
   │  (renders board, │                                  │  (authoritative game  │
   │   sends intents) │                                  │   loop, scoring, AI)  │
   └────────┬─────────┘                                  └──────────┬───────────┘
            │                                                       │
            │ voice tracks                                          │ access tokens
            ▼                                                       ▼
   ┌──────────────────────────── LiveKit Cloud ───────────────────────────────┐
   │  real-time voice only (no recording, no storage)                          │
   └───────────────────────────────────────────────────────────────────────────┘
```

**The golden rule:** if a change affects *what is true in the game* (where a player is, who owns a cell, the score), it happens on the **server** and flows to clients automatically. If it only affects *how things look* (a glow, an animation, a color), it lives on the **client**.

---

## Repository layout

```
polar-winds-game/
├── package.json            # Root scripts: dev / build / install:all (uses `concurrently`)
├── DEPLOYMENT.md           # Local setup & run guide
├── CLAUDE.md               # Short project notes
│
├── client/                 # React 19 + React Three Fiber frontend (Vite, port 8080)
│   ├── vite.config.ts      # Dev server on :8080, `@` → ./src alias
│   ├── .env.example        # VITE_SERVER_URL
│   └── src/
│       ├── main.tsx        # React entry
│       ├── App.tsx         # Router + providers (React Router, React Query, Sonner toasts)
│       ├── pages/
│       │   ├── MainMenu.tsx   # Lobby: name, solo/multiplayer, room code
│       │   └── Index.tsx      # Connects to Colyseus, batches state → React, voice setup
│       ├── screens/
│       │   └── GameScreen.tsx # The R3F <Canvas>: scene graph, input, HUD overlays
│       ├── components/        # R3F entities + shadcn/ui (Player, ParticleFloor, GoldAura…)
│       ├── hooks/             # usePlatformVoice, useCanvasVideoPublish, use-sounds…
│       └── constants/
│           └── playerColors.ts  # Single source of truth for all player visuals
│
└── server/                 # Colyseus game server (Express, port 2567)
    ├── index.ts            # Server bootstrap, HTTP API, room registration
    ├── rooms/
    │   └── GameRoom.ts     # THE game: lifecycle, movement, scoring, stages, enemies, voice
    ├── schema/
    │   └── GameState.ts    # Networked state schema (Colyseus @type decorators)
    ├── collectibles/       # One handler class per collectible type + a factory
    ├── config/
    │   ├── collectible-spawn.json   # Spawn rules + stage score thresholds
    │   ├── CollectibleSpawnConfig.ts# Types for the above
    │   ├── LevelSpec.ts             # Hand-authored levels (+ Unreal export parser)
    │   └── levels/                  # Level JSON files
    └── services/
        └── LiveKitService.ts        # Real-time voice access tokens
```

### Tech stack

| Layer | What we use |
| --- | --- |
| **Server** | Colyseus 0.16 (multiplayer rooms + state sync), Express 5 (HTTP API), TypeScript, run with `tsx` (no build step), LiveKit Server SDK, `jsonwebtoken` |
| **Client** | React 19, React Three Fiber + Three.js (`@react-three/fiber`, `drei`, `postprocessing`), `colyseus.js` (client networking), `livekit-client`, Vite, Tailwind CSS + shadcn/ui, React Router, React Query |

---
## Concept 1: Colyseus multiplayer

Colyseus gives us two things: **rooms** (a server-side object that holds a game session) and **schema-based state sync** (you mutate a plain object on the server, and Colyseus automatically sends the *diff* to every connected client). Understanding these two ideas is 80% of the multiplayer code.

### 1a. The state schema is the contract

Everything both sides agree on lives in [server/schema/GameState.ts](server/schema/GameState.ts). Fields are marked with `@type(...)` decorators — only decorated fields get synced over the network.

```typescript
export class Player extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("string") color: PlayerColor = "RED";   // "RED" | "GREEN" | "BLUE"
  @type("string") name: string = "";
  // …
}

export class GameState extends Schema {
  @type("number") gridWidth: number = 10;
  @type("number") gridHeight: number = 8;

  @type({ map: Player })   players      = new MapSchema<Player>();    // sessionId → Player
  @type({ map: GridCell }) gridColors   = new MapSchema<GridCell>();  // "x,y" → painted cell
  @type([Collectible])     collectibles = new ArraySchema<Collectible>();
  @type([Enemy])           enemies      = new ArraySchema<Enemy>();
  @type({ map: "number" }) scores       = new MapSchema<number>();    // "RED"|"GREEN"|"BLUE" → score

  @type("number")  totalScore   = 0;
  @type("number")  countdown    = 0;
  @type("number")  timeRemaining = 30 * 60;
  @type("number")  stage        = 1;
  @type(["number"]) stageThresholds = new ArraySchema<number>();
  // …
}
```

Key things to notice:

- **`MapSchema` vs `ArraySchema`.** Use a `MapSchema` when entities have stable keys you look up (players by session id, painted cells by `"x,y"`). Use an `ArraySchema` for ordered lists you iterate (collectibles, enemies).
- **Painted cells are sparse.** `gridColors` only contains cells that have been painted — a blank board is an empty map, not a 26×26 array of nulls. This keeps the synced state small.
- **Decorators require special TypeScript settings.** The server's `tsconfig.json` sets `experimentalDecorators: true` and `useDefineForClassFields: false`. If you see weird "field is undefined" or decorator errors after editing the schema, check those flags first.

### 1b. Room lifecycle

[server/rooms/GameRoom.ts](server/rooms/GameRoom.ts) is `class GameRoom extends Room<GameState>`. Colyseus calls these hooks for you:

| Hook | When | Responsibility here |
| --- | --- | --- |
| `onCreate(options)` | Room is created | Load spawn config, seed the RNG, build the initial state, **register message handlers**, start the lobby timeout. |
| `onJoin(client, options)` | A client connects | Verify the player, assign or restore a color, place them on the grid, and start the game once enough players are present. |
| `onLeave(client, consented)` | A client disconnects | Free the color (pre-game) or hold it for reconnection (mid-game); start the abandon timer if everyone's gone. |
| `onDispose()` | Room is destroyed | Clear all timers and end the session. |

### 1c. Messages: how a keypress becomes a move

Clients never write to game state directly. They **send a message**; the server validates it and mutates state; Colyseus broadcasts the diff. The `"move"` flow is the canonical example.

**Client** ([client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx)) — on an arrow-key/WASD press:

```typescript
room.send("move", { direction: "up", seq });   // seq = a client sequence number
```

**Server** ([server/rooms/GameRoom.ts](server/rooms/GameRoom.ts), registered in `onCreate`):

```typescript
this.onMessage("move", (client, message: MoveMessage) => {
  if (this.state.countdown > 0) return;           // movement locked during countdown
  const player = this.state.players.get(client.sessionId);
  // … clamp newX/newY to the visible grid bounds …
  // … check collision with other players …
  if (!isBlocked) {
    player.x = newX; player.y = newY;             // mutate state → Colyseus syncs it
    const cell = this.state.gridColors.get(cellKey) ?? new GridCell();
    cell.color = player.color;                    // paint the cell
    this.state.gridColors.set(cellKey, cell);
    this.calculateScores();                       // recompute scores every move (see Concept 3)
  }
  if (message.seq !== undefined) {
    client.send("moveAck", { seq: message.seq, x: player.x, y: player.y });
  }
});
```

That `moveAck` enables **client-side prediction**: the client can move the avatar immediately on keypress (so it feels instant), then reconcile against the authoritative position the server confirms. The server is always the final word on where you are.

Other messages follow the same pattern: `"ping"` (broadcast a marker), `"clearBoard"` / `"abandonGame"` (vote-based actions), and the dev-only `"devStageUp"` / `"devPaintNode"` / `"devClearNode"`.

### 1d. Client side: connect, then map state to React

The client connects in [client/src/pages/Index.tsx](client/src/pages/Index.tsx):

```typescript
const client = new Client.Client(initPayload.serverUrl);

const gameRoom = initPayload.roomId
  ? await client.joinById<ServerGameState>(initPayload.roomId, { userId, playerName, … })
  : await client.create<ServerGameState>("game_room", { soloMode, userId, playerName, … });

connectedRoomIdRef.current = gameRoom.roomId;     // remembered so we can reconnect
```

The single most important client subscription is `onStateChange`. Every time the server sends a patch, we copy the Colyseus schema objects into plain React state with one `dispatch`:

```typescript
gameRoom.onStateChange(() => {
  // copy players, gridColors, collectibles, enemies, scores … into plain JS structures
  dispatch({ type: "SYNC_STATE", payload: { /* … */ } });
});
```

Why copy instead of rendering the schema directly? Because React needs plain, referentially-stable values to diff efficiently. Translating the Colyseus `MapSchema`/`ArraySchema` into `Map`s and arrays in one place keeps rendering predictable and avoids re-render storms.

The client also handles a few **server-pushed messages**: `"boardCleared"` (toast), `"voiceReady"` (LiveKit token arrived), and `"milestoneUnlocked"` (a collectible type was activated for the first time). Reconnection uses exponential backoff (5 attempts, starting at 1.5 s) against the remembered room id.

---

## Concept 2: Rendering, shaders & material instancing

The board is drawn with **React Three Fiber (R3F)** — Three.js expressed as React components. The entire 3D scene lives inside one `<Canvas>` in [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx).

### 2a. The scene at a glance

```tsx
<Canvas gl={{ preserveDrawingBuffer: true /* needed so we can record the canvas */ }}>
  <NebulaBackdrop />                                  {/* full-screen background effect */}
  <OrthographicCamera makeDefault rotation={[-Math.PI/2, 0, 0]} /> {/* top-down */}
  <SmoothZoom … />                                    {/* eases zoom as the grid grows */}
  <ambientLight … /> <directionalLight … /> <pointLight … />
  <ParticleFloor … />                                 {/* the grid tiles (instanced) */}
  <ConnectionLines … />                               {/* links between same-color cells (instanced) */}
  {/* collectibles, players, enemies, ping ripples … */}
</Canvas>
```

- **Top-down orthographic camera.** It looks straight down (`rotation = [-π/2, 0, 0]`); `SmoothZoom` adjusts the zoom as the grid expands through stages so the whole board stays in frame.
- **Depth by Y.** Objects are stacked by their Y coordinate: floor tiles at `-2.55`, connection lines at `-2.5`, collectibles/enemies around `-2.0`, players at the top. The camera reads "higher Y = closer".
- **Bloom post-processing.** An `EffectComposer` with a `Bloom` pass makes bright, additive elements glow. It's mounted *after* the canvas has real dimensions to avoid 0×0 framebuffers inside iframes.

### 2b. Material instancing (drawing thousands of things cheaply)

Drawing each grid tile as its own mesh would mean one **draw call** per tile — hundreds of calls per frame. **Instancing** draws *one* geometry many times in a single call, with a per-instance transform (and, here, a per-instance color).

The clearest example is the floor in [client/src/components/ParticleFloor.tsx](client/src/components/ParticleFloor.tsx):

```tsx
<instancedMesh ref={meshRef} args={[undefined, undefined, totalNodes]}>
  <planeGeometry args={[1.6, 1.6]}>
    {/* per-instance color, read in the shader as `attribute vec3 instanceColor` */}
    <instancedBufferAttribute attach="attributes-instanceColor" args={[colorArray, 3]} />
  </planeGeometry>
  <shaderMaterial vertexShader={…} fragmentShader={…} uniforms={uniforms}
                  transparent depthWrite={false} blending={THREE.AdditiveBlending} />
</instancedMesh>
```

Each tile's position is written once into the instance matrix:

```tsx
useLayoutEffect(() => {
  let i = 0;
  for (let gx = 0; gx < gridWidth; gx++)
    for (let gz = 0; gz < gridHeight; gz++) {
      tempObject.position.set((gx - offsetX) * spacing, -2.55, (gz - offsetZ) * spacing);
      tempObject.rotation.x = -Math.PI / 2;     // lay flat
      tempObject.updateMatrix();
      meshRef.current.setMatrixAt(i++, tempObject.matrix);
    }
  meshRef.current.instanceMatrix.needsUpdate = true;   // tell the GPU the matrices changed
}, [gridWidth, gridHeight, spacing, …]);
```

The **connection lines** ([GameScreen.tsx](client/src/screens/GameScreen.tsx)) use the same trick with a shared thin-cylinder geometry: each segment is one instance, rotated to horizontal or vertical via a precomputed `THREE.Quaternion`, and `mesh.count = lines.length` trims the instance count to only the segments that currently exist. Two rules of thumb whenever you instance:

1. After writing matrices, set `instanceMatrix.needsUpdate = true`.
2. After writing the color attribute, set its `.needsUpdate = true` too.

### 2c. Shaders

Several effects are custom `ShaderMaterial`s — small GLSL programs with a **vertex shader** (positions each vertex) and a **fragment shader** (colors each pixel). Data flows in through `uniforms` (the same for every pixel, e.g. `uTime`) and `varying`s (interpolated per-pixel, passed from vertex → fragment).

The player's "frosted glass" look in [client/src/components/Player.tsx](client/src/components/Player.tsx) is a good first shader to read — it's a classic **Fresnel rim** effect (edges glow more than faces):

```glsl
// fragment shader
float fresnel = 1.0 - max(0.0, dot(normal, viewDir));  // 1 at silhouette edges, 0 head-on
fresnel = pow(fresnel, 4.0);                            // sharpen the rim
vec3 col = mix(uColor * 0.4, uRimColor, fresnel);       // blend body → rim color
gl_FragColor = vec4(col, 0.7 + fresnel * 0.3);
```

Uniforms that animate (like `uTime`) are advanced every frame inside `useFrame`:

```tsx
useFrame((state) => {
  material.uniforms.uTime.value = state.clock.elapsedTime;
});
```

The shader catalog (all in `client/src/components/`):

| Effect | File | What it does |
| --- | --- | --- |
| Floor ripple | `ParticleFloor.tsx` | Two concentric rings per tile + a wave that expands from the board center on events. |
| Player glass | `Player.tsx` | Fresnel rim lighting on the avatar. RED = sphere, BLUE = tetrahedron, GREEN = rounded box. |
| Cyber ring | `CyberRing.tsx` | Rotating segmented halo under each player. |
| Gold aura | `GoldAura.tsx` | Radial "burst" of lines around collectibles that hit their gold bonus. |
| Connection lines | `GameScreen.tsx` | Animated **dashed** lines between adjacent same-color cells. |
| Ping ripple | `game/PulseRipple.tsx` | Expanding sinusoidal rings where a player pings. |
| Nebula backdrop | `game/NebulaBackdrop.tsx` | Full-screen plasma using cheap 2D noise (FBM), with the center discarded for performance. |

Two supporting files worth knowing:

- **[client/src/constants/playerColors.ts](client/src/constants/playerColors.ts)** is the **single source of truth for all player visuals**. The IDs `RED`/`GREEN`/`BLUE` are *logic* (Player 1/2/3) and must never be renamed, but their on-screen colors live entirely here (today: RED→orange `#ff8c1a`, GREEN→white `#ffffff`, BLUE→blue `#1a73ff`). Change colors only in this file.
- **`client/src/lib/perfTier.ts`** scales particle counts and effect detail down on weaker GPUs.

---

## Concept 3: Core scoring logic

This is the heart of the game. The model is simple to state: **players paint cells; certain shapes of painted cells "activate" collectibles, which award points.** All of it is recomputed server-side, from scratch, on **every move** — there is no incremental scoring to keep in sync.

### 3a. The recompute: `calculateScores()`

Every successful move calls `calculateScores()` in [server/rooms/GameRoom.ts](server/rooms/GameRoom.ts). Its shape:

```typescript
private calculateScores() {
  // 1. Reset activation flags (only those that changed — large patches freeze clients)
  for (const c of this.state.collectibles) if (c.isActivated) c.isActivated = false;

  // 2. For each color, find connected painted regions, then score that color's collectibles
  for (const color of ["RED", "GREEN", "BLUE"] as const) {
    const components = this.findConnectedComponents(color);   // BFS, below
    for (const c of allCollectibles.filter(c => c.color === color)) {
      const handler = CollectibleFactory.getHandler(c.type);  // one class per type
      scores[color] += handler.process({ collectible: c, gridColors, allCollectibles, color, components });
    }
  }

  // 3. NEUTRAL collectibles score once and split equally across all three players
  // 4. Write scores + totalScore back into state (skip unchanged entries)
  // 5. checkStageAdvancement();   // did totalScore cross a threshold?
  // 6. reportNewMilestones();     // first activation of a type → broadcast to clients
}
```

### 3b. Connected components (BFS)

"Connected" means orthogonally adjacent cells of the same color. `findConnectedComponents(color)` walks every painted cell of that color and runs a breadth-first search (`bfs`) to group them into regions:

```typescript
private bfs(startX, startY, color, visited) {
  const queue = [{ x: startX, y: startY }], component = [];
  visited.add(`${startX},${startY}`);
  while (queue.length) {
    const cur = queue.shift();
    component.push(cur);
    for (const n of [/* 4 orthogonal neighbors */]) {
      const cell = this.state.gridColors.get(`${n.x},${n.y}`);
      if (cell?.color === color && !visited.has(key)) { visited.add(key); queue.push(n); }
    }
  }
  return component;   // a list of {x,y} forming one connected region
}
```

These `components` are handed to each collectible handler so it can ask "is my cell part of a big enough region, with the right shape?"

### 3c. Collectibles are pluggable handler classes

Every collectible **type** has its own class extending `BaseCollectible` ([server/collectibles/BaseCollectible.ts](server/collectibles/BaseCollectible.ts)). The base defines the contract:

```typescript
export abstract class BaseCollectible {
  abstract calculateScore(ctx: CollectibleScoreContext): number;   // points this collectible adds
  abstract isActivated(ctx: CollectibleScoreContext): boolean;     // should it light up?
  isGold(ctx: CollectibleScoreContext): boolean { return false; }  // bonus condition (override)
  abstract isValidSpawnPosition(ctx: SpawnValidationContext): boolean;

  process(ctx): number {        // called by calculateScores(); sets flags + returns score
    const score = this.calculateScore(ctx);
    ctx.collectible.isActivated = this.isActivated(ctx);
    ctx.collectible.isGold = this.isGold(ctx);
    return score;
  }
}
```

A `CollectibleFactory` ([server/collectibles/CollectibleFactory.ts](server/collectibles/CollectibleFactory.ts)) maps each type string to a singleton handler, so `calculateScores()` never needs to know the concrete classes.

| Type | Colored / Neutral | Spawns on… | Scoring idea (one line) |
| --- | --- | --- | --- |
| `network` | colored | nodes | ≥2 networks in one connected region; score grows with count; **gold** when clues sit exactly at the region's endpoints. |
| `box` | colored | between nodes | smallest same-color square enclosing it; score scales with side length × number of squares. |
| `equilibrium` | neutral | nodes | needs a balanced 3×3 (3 RED + 3 GREEN + 3 BLUE around it). |
| `clone` | neutral | between nodes | mirrored/paired pattern of painted cells. |
| `vantage` | colored | between nodes | line-of-sight / sight-line pattern. |
| `galaxy` | colored | nodes | spiral/region pattern around the node. |
| `polyomino` | colored | nodes | matches a specific multi-cell shape (shape data from the level spec). |

> "Nodes" are integer coordinates (`5,7`); "between nodes" are half-integer coordinates (`5.5,7`) so the collectible sits on an edge between cells. Which is which is declared in `COLLECTIBLE_PROPERTIES` in [server/config/CollectibleSpawnConfig.ts](server/config/CollectibleSpawnConfig.ts).

**Worked example — `network`** ([server/collectibles/NetworkCollectible.ts](server/collectibles/NetworkCollectible.ts)). A network clue scores only if its cell is painted your color *and* it lands in a connected region containing at least one other network clue of your color:

```typescript
let cluesInNetwork = networksInComponent.length;     // how many network clues in this region
if (cluesInNetwork < 2) return 0;                    // need at least 2 connected
if (this.checkCluesAtEndpoints(...)) cluesInNetwork += this.goldBonus;  // +5 if clues are at the path endpoints
return (cluesInNetwork - 1) * this.baseScore;        // baseScore = 1
```

So 3 connected network clues → `(3-1) × 1 = 2`. If they also satisfy the endpoint condition (gold), it becomes `(3+5-1) × 1 = 7`.

### 3d. Stages: the score that drives progression

The combined `totalScore` pushes the game through stages. After scoring, `checkStageAdvancement()` compares `totalScore` against `stageThresholds`:

```typescript
let targetStage = 1;
for (let i = 0; i < this.stageThresholds.length; i++)
  if (this.state.totalScore >= this.stageThresholds[i]) targetStage = i + 2;
if (targetStage > this.state.stage) this.advanceToStage(targetStage);
```

Thresholds come from `custom_target_scores` in the spawn config. `advanceToStage()` does two things: **grows the visible grid** and **spawns more collectibles** (and enemies):

```typescript
// Stage 1 = 10×8; each stage adds 2 to width and height; capped at 26×26 (stage 8)
this.state.gridWidth  = Math.min(this.INITIAL_VISIBLE_WIDTH  + (newStage - 1) * 2, this.MAX_GRID_SIZE);
this.state.gridHeight = Math.min(this.INITIAL_VISIBLE_HEIGHT + (newStage - 1) * 2, this.MAX_GRID_SIZE);
```

The grid is always a `26×26` coordinate space; what changes is the **visible window** centered in it.

### 3e. Two ways to place collectibles

1. **Random spawn rules** — the default. [server/config/collectible-spawn.json](server/config/collectible-spawn.json):

   ```json
   {
     "seed": 40,
     "custom_target_scores": [50, 130, 290, 520, 860, 1090, 1550],
     "collectible_spawn_rules": [
       { "clue_type": "network",   "first_stage": 1, "num_initial": 5, "num_subsequent": 3 },
       { "clue_type": "polyomino", "first_stage": 3, "num_initial": 7, "num_subsequent": 4 }
     ]
   }
   ```

   Each rule says: this type first appears at `first_stage`, spawning `num_initial`, then `num_subsequent` more each stage after. Colored types spawn per-color; neutral types spawn once per batch. Positions are validated by the handler's `validateSpawnPosition` (which enforces edge constraints + type-specific rules).

2. **Hand-authored levels** — [server/config/LevelSpec.ts](server/config/LevelSpec.ts). A `LevelSpec` lists exact clue/enemy positions per stage. There's also `parseUnrealExport()` to import levels designed in Unreal. Pass a level via the room's create options to use it instead of random spawns; files live in `server/config/levels/`.

**Determinism.** A `SeededRNG` (seeded from the config) drives placement, and a *separate* seeded stream drives enemies — so the same seed reproduces the same game, which is essential for replays and debugging.

---

## Enemies (AI)

Enemies are simple state-erasers that keep the board from filling up. Each `Enemy` (see [GameState.ts](server/schema/GameState.ts)) has a `personality`:

- `red-avoiding` / `green-avoiding` / `blue-avoiding` — avoids stepping onto that color when possible.
- `same-color-avoiding` — won't step from one color onto the same color.
- `prismatic` — never steps `RED→GREEN`, `GREEN→BLUE`, or `BLUE→RED`.

`moveEnemies()` runs on the 2-second `enemyTimer` in **two phases**, which matters for fairness:

```typescript
// Phase 1: decide every enemy's move from the CURRENT board (read-only)
for (const enemy of this.state.enemies) {
  const chosen = this.chooseEnemyMove(enemy, adjacentInBoundsCells);
  if (chosen) moves.push({ enemy, oldX, oldY, newX: chosen.x, newY: chosen.y });
}
// Phase 2: apply all moves, and ERASE the cell each enemy left behind
for (const m of moves) {
  m.enemy.x = m.newX; m.enemy.y = m.newY;
  this.state.gridColors.delete(`${m.oldX},${m.oldY}`);   // un-paints the vacated cell
}
this.calculateScores();   // erased cells can break up scoring regions
```

`chooseEnemyMove()` sorts the in-bounds neighbors into `preferred` and `acceptable` pools per the personality, then picks from `preferred` first (falling back to `acceptable`, else staying put) using the enemy RNG.

---

## Voice (LiveKit)

Voice is optional, real-time only, and entirely separate from the game-state path. Nothing is recorded or stored. When a multiplayer game starts, the server's `initializeVoiceChat()` uses [server/services/LiveKitService.ts](server/services/LiveKitService.ts) to generate a per-player **access token** and send it to the client in a `"voiceReady"` message.

On the client, [client/src/hooks/usePlatformVoice.ts](client/src/hooks/usePlatformVoice.ts) joins the LiveKit room and tracks participants (mute/speaking state).

---

## Extend it yourself — recipes

Each recipe lists the exact files/functions to touch. Server changes auto-reload (`tsx watch`); client changes hot-reload (Vite).

### Add a new collectible type

1. Add the name to the `CollectibleType` union in [server/schema/GameState.ts](server/schema/GameState.ts).
2. Create `server/collectibles/YourCollectible.ts` extending `BaseCollectible`; implement `calculateScore`, `isActivated`, `isValidSpawnPosition` (and optionally `isGold`). Copy [NetworkCollectible.ts](server/collectibles/NetworkCollectible.ts) as a template.
3. Register it in the `handlers` map in [server/collectibles/CollectibleFactory.ts](server/collectibles/CollectibleFactory.ts).
4. Declare its placement (`spawnsOnNodes`, `isNeutral`) in `COLLECTIBLE_PROPERTIES` in [server/config/CollectibleSpawnConfig.ts](server/config/CollectibleSpawnConfig.ts).
5. Add a spawn rule for it in [server/config/collectible-spawn.json](server/config/collectible-spawn.json).
6. Render it: add a case in the collectible rendering block of [client/src/screens/GameScreen.tsx](client/src/screens/GameScreen.tsx) (and a new component under `client/src/components/` if it needs custom art).

### Change the scoring formula or stage pacing

- **Per-type scoring:** edit `calculateScore()` in the relevant `server/collectibles/*Collectible.ts`.
- **How fast stages advance:** edit `custom_target_scores` in [collectible-spawn.json](server/config/collectible-spawn.json).
- **How the grid grows per stage:** edit the `advanceToStage()` width/height formula in [GameRoom.ts](server/rooms/GameRoom.ts).

### Add a new shader effect

Copy the pattern from [ParticleFloor.tsx](client/src/components/ParticleFloor.tsx) or [game/PulseRipple.tsx](client/src/components/game/PulseRipple.tsx): build a `<shaderMaterial>` with `uniforms`, advance any animated uniform in `useFrame`, and mount the component inside the `<Canvas>` in [GameScreen.tsx](client/src/screens/GameScreen.tsx). For many copies of the same thing, attach it to an `<instancedMesh>` (Concept 2b).

### Add or recolor a player color

- **Recolor:** change the hex values in [client/src/constants/playerColors.ts](client/src/constants/playerColors.ts) — that's the only place visuals are defined.
- **Add a 4th color (bigger change):** extend the `PlayerColor` union in [GameState.ts](server/schema/GameState.ts), add it to the `playerColors`/`assignedColors` set and color-assignment logic in `onJoin` ([GameRoom.ts](server/rooms/GameRoom.ts)), and add a theme entry in `playerColors.ts`. Expect to revisit scoring code that loops over exactly three colors.

### Tune grid size, timers, or player count

The constants live at the top of [GameRoom.ts](server/rooms/GameRoom.ts): `MAX_GRID_SIZE`, `INITIAL_VISIBLE_WIDTH/HEIGHT`, `GAME_DURATION`, `ENEMY_MOVE_DELAY`, `LOBBY_TIMEOUT`, the countdown length, and the "start when N players" check in `onJoin`.

### Author a fixed level instead of random spawns

Write a `LevelSpec` JSON (or export from Unreal and run it through `parseUnrealExport`), drop it in `server/config/levels/`, and pass it to the room via create options. See [LevelSpec.ts](server/config/LevelSpec.ts) for the shape.

---

## Environment variables

Copy the `.env.example` files and fill in values. **Never commit real secrets** — ask the team for production keys.

**Client** ([client/.env.example](client/.env.example)):

| Var | Purpose |
| --- | --- |
| `VITE_SERVER_URL` | WebSocket URL of the Colyseus server (`ws://localhost:2567` locally). |

**Server** — the committed example ([server/.env.example](server/.env.example)) covers just the core game:

| Var | Purpose |
| --- | --- |
| `PORT` | Server port (your host may set this in production; `2567` locally). |
| `NODE_ENV` | `development` / `production`. |
| `CLIENT_URL` | Allowed CORS origin (your client URL). |

The following are **read from the environment** but are **not** in the example file — set them only if you need voice:

| Var | Purpose |
| --- | --- |
| `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` | LiveKit real-time voice. |
| `PLATFORM_API_KEY` | Auth for the `/api/create-colyseus-room` and admin endpoints. |
| `GAME_TOKEN_SECRET` | Secret used to verify signed game-join JWTs. |

---

## Deployment

In production the server **serves the built client**: `server/index.ts` statically serves `client/dist` and falls back to `index.html` for SPA routes, so a single Node service can host both. Build with `npm run build` and serve via `npm start`, with a `/health` check available. Full local setup instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Troubleshooting & gotchas

| Symptom | Likely cause / fix |
| --- | --- |
| **"Failed to join" / can't connect** | Server not running, or `VITE_SERVER_URL` points to the wrong host/port. Confirm the server logged `Colyseus server listening on port 2567`. |
| **Port 2567 already in use** | A previous server is still running. `lsof -i :2567` then kill the PID, or stop the duplicate `npm run dev`. |
| **Players don't move** | Movement is locked while `countdown > 0`. Otherwise check the browser has keyboard focus and that the WebSocket is connected (Network tab). |
| **Schema "field is undefined" / decorator errors** | Check `experimentalDecorators: true` and `useDefineForClassFields: false` in `server/tsconfig.json` after editing `GameState.ts`. |
| **No voice in the game** | Expected locally unless the `LIVEKIT_*` env vars are set — the game runs fine without them. |
| **State looks stale / not updating** | Make sure your new synced field has a `@type(...)` decorator and is copied in the `onStateChange` handler in `Index.tsx`. |

---

_Want the game-design framing (rules, controls) rather than the code tour? It's folded into this README's overview and Concept 3 sections — the older `MULTIPLAYER.md` has been retired in favor of this document._
