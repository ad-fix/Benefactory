import { Room, Client } from "colyseus";
import { GameState, Player, PlayerColor, PlayerRole } from "../schema/GameState";
import { LiveKitService } from "../services/LiveKitService";
import { BaseLevel } from "../levels/BaseLevel";
import { RolesLevel } from "../levels/RolesLevel";
import { Level1 } from "../levels/Level1";
import { ConveyorLevel } from "../levels/ConveyorLevel";
import jwt from "jsonwebtoken";

interface MoveMessage {
  direction: "up" | "down" | "left" | "right";
  seq?: number;
  targetColor?: "RED" | "GREEN" | "BLUE";
}

interface PingMessage {
  x: number;
  y: number;
}

export class GameRoom extends Room<GameState> {
  maxClients = 10;
  private playerColors: PlayerColor[] = ["RED", "GREEN", "BLUE"];
  private assignedColors = new Set<PlayerColor>();
  private playerRoles: PlayerRole[] = ["OPERATOR", "ENGINEER", "MONITOR"];
  private assignedRoles = new Set<PlayerRole>();
  private readonly MAX_GRID_SIZE = 26; // Full grid size (stage 8)
  private readonly INITIAL_VISIBLE_WIDTH = 10; // Starting visible width (stage 1)
  private readonly INITIAL_VISIBLE_HEIGHT = 8; // Starting visible height (stage 1)
  private userIds: Map<string, string> = new Map(); // sessionId -> userId
  private userIdToColor: Map<string, "RED" | "GREEN" | "BLUE"> = new Map(); // userId -> color for reconnection
  private spectatorSessionIds = new Set<string>();
  private polarWindsSessionId: string | null = null;
  private gameTimer: ReturnType<typeof setInterval> | null = null;
  private readonly GAME_DURATION = 30 * 60; // 30 minutes in seconds
  private isSoloMode: boolean = false;
  private isDevMode: boolean = false;
  private livekitService: LiveKitService;
  private livekitRoomName: string | null = null;
  private lobbyTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly LOBBY_TIMEOUT = 10 * 60 * 1000; // 10 minutes in ms
  private abandonTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly ABANDON_TIMEOUT = 2 * 60 * 1000; // 2 minutes in ms
  private isPlatformManaged: boolean = false;
  private replayEvents: Array<Record<string, unknown>> = [];
  private gameStartTime: number = 0;
  private sessionEndedInDb: boolean = false;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;
  private currentLevel: BaseLevel | null = null;

  onCreate(options: any) {
    console.log("GameRoom created with options:", options, "| Room ID:", this.roomId);

    this.isPlatformManaged = options.platformManaged || false;
    if (this.isPlatformManaged) {
      console.log("Room created in PLATFORM-MANAGED mode");
    }

    // Keep room alive for the full session duration (players can reconnect)
    this.autoDispose = false;

    // Start lobby timeout - dispose room if game doesn't start within timeout
    this.lobbyTimeout = setTimeout(() => {
      if (!this.state.gameStarted) {
        console.log("Lobby timeout - game never started, disposing room");
        this.disconnect();
      }
    }, this.LOBBY_TIMEOUT);

    // Initialize LiveKit service
    this.livekitService = new LiveKitService();

    const seed = Math.floor(Math.random() * 2147483647);
    this.setState(new GameState());
    this.state.seed = seed;
    this.state.gridWidth = this.INITIAL_VISIBLE_WIDTH;
    this.state.gridHeight = this.INITIAL_VISIBLE_HEIGHT;

    if (options.testLevel === "conveyor") {
  this.state.currentLevel = "conveyor";
  this.currentLevel = new ConveyorLevel(this.state);
  } else if (options.testLevel === "roles") {
  this.state.currentLevel = "roles";
  this.currentLevel = new RolesLevel(this.state);
  } else {
  this.state.currentLevel = "level1";
  this.currentLevel = new Level1(this.state);
  }

    console.log("Initial state set");

    // Handle player movement
    this.onMessage("move", (client, message: MoveMessage) => {
      if (this.state.countdown > 0) return;

      // In solo mode with targetColor, move the specified color's player
      let player: Player | undefined;
      let playerKey: string | undefined;

      if (this.isSoloMode && message.targetColor) {
        // Find the player with the requested color
        this.state.players.forEach((p, key) => {
          if (p.color === message.targetColor) {
            player = p;
            playerKey = key;
          }
        });
      } else {
        player = this.state.players.get(client.sessionId);
        playerKey = client.sessionId;
      }

      if (!player || !playerKey) return;

      const { direction } = message;
      let newX = player.x;
      let newY = player.y;

      // Calculate current visible bounds (centered on 26x26 grid)
      const center = Math.floor(this.MAX_GRID_SIZE / 2);
      const halfWidth = Math.floor(this.state.gridWidth / 2);
      const halfHeight = Math.floor(this.state.gridHeight / 2);
      const minX = center - halfWidth;
      const maxX = center + halfWidth - 1;
      const minY = center - halfHeight;
      const maxY = center + halfHeight - 1;

      switch (direction) {
        case "up":
          newY = Math.max(minY, player.y - 1);
          break;
        case "down":
          newY = Math.min(maxY, player.y + 1);
          break;
        case "left":
          newX = Math.max(minX, player.x - 1);
          break;
        case "right":
          newX = Math.min(maxX, player.x + 1);
          break;
      }

      if (this.currentLevel && this.currentLevel.canPlayerMoveTo(player, newX, newY)) {
        player.x = newX;
        player.y = newY;
        this.currentLevel.onPlayerMove(player, newX, newY);
        this.state.currentLevelComplete = this.currentLevel?.isLevelComplete() ?? false;

        // Log move for replay
        this.logEvent({ e: "move", p: this.userIds.get(playerKey) || playerKey, d: direction, x: newX, y: newY });
      }

      // Send acknowledgment with final position (for client-side prediction reconciliation)
      if (message.seq !== undefined) {
        client.send("moveAck", { seq: message.seq, x: player.x, y: player.y });
      }
    });

    this.onMessage("pickupItem", (client, message: { itemId: string; wirecutterColor: string; targetColor?: "RED" | "GREEN" | "BLUE" }) => {
      let player: Player | undefined;

      if (this.isSoloMode && message.targetColor) {
    this.state.players.forEach((p) => {
      if (p.color === message.targetColor) player = p;
      });
    } else {
      player = this.state.players.get(client.sessionId);
    }

      if (!player) return;
      if (player.heldWirecutter) return;
      if (this.state.collectedItems.has(message.itemId)) return;
      this.state.collectedItems.add(message.itemId);
      player.heldWirecutter = message.wirecutterColor;
    });

      this.onMessage("cutWire", (client, message: { color: string }) => {
  const player = this.state.players.get(client.sessionId);
  if (!player) return;
  if (!player.heldWirecutter) return;                 // must be holding a wirecutter
  if (this.state.bombDefused || this.state.bombExploded) return; // bomb already resolved

  const CORRECT_WIRES = ["red", "green", "blue"];
  player.heldWirecutter = "";                          // consumed on any attempt, right or wrong

  if (!CORRECT_WIRES.includes(message.color)) {
    this.state.bombExploded = true;
    this.state.isGameOver = true;
    return;
  }

  if (!this.state.cutWires.includes(message.color)) {
    this.state.cutWires.push(message.color);
  }

  if (this.state.cutWires.length === CORRECT_WIRES.length) {
    this.state.bombDefused = true;
    this.state.isGameOver = true;
  }
  });

    // Handle ping - just broadcast to all clients, don't store in state
    this.onMessage("ping", (client, message: PingMessage) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      // Broadcast to all clients (excluding sender)
      this.broadcast("ping", {
        x: message.x,
        y: message.y,
        color: player.color
      }, { except: client });

      // Also send back to the sender
      client.send("ping", {
        x: message.x,
        y: message.y,
        color: player.color
      });

      // Log ping for replay
      this.logEvent({ e: "ping", p: this.userIds.get(client.sessionId) || client.sessionId, x: message.x, y: message.y });
    });

    // Handle dev mode stage up
    this.onMessage("devStageUp", (client) => {
      if (!this.isDevMode) return;
      const nextStage = this.state.stage + 1;
      if (nextStage <= 8) {
        console.log(`[Dev Mode] Manual stage up from ${this.state.stage} to ${nextStage}.`);
        this.advanceToStage(nextStage);
      }
    });

    // Handle dev stage skip (roles level)
    this.onMessage("devSetStage", (client, message: { stage: number }) => {
      if (!this.isDevMode) return;
      const stage = message.stage;
      if (!Number.isInteger(stage) || stage < 1 || stage > 4) return;
      if (this.currentLevel instanceof RolesLevel) {
        console.log(`[Dev Mode] Manual roles-level stage skip to ${stage}.`);
        this.currentLevel.devSetStage(stage);
      }
    });

    // Giving wirecutters for testing bomb wire cutting
    this.onMessage("devGiveWirecutter", (client, message: { color: string }) => {
      if (!this.isDevMode) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.heldWirecutter = message.color;
    });

    // Handle dev role switcher
    this.onMessage("devSetRole", (client, message: { role: string }) => {
      if (!this.isDevMode) return;
      const valid: PlayerRole[] = ["OPERATOR", "ENGINEER", "MONITOR"];
      if (!valid.includes(message.role as PlayerRole)) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.role = message.role;
      console.log(`[Dev Mode] Set role of ${client.sessionId} to ${message.role}`);
    });

    console.log("GameRoom created!");
  }

  async onJoin(client: Client, options: any) {
    console.log(`Client ${client.sessionId} joined! Current players: ${this.state.players.size}`);

    // Cancel abandon timeout if a player reconnects
    if (this.abandonTimeout) {
      clearTimeout(this.abandonTimeout);
      this.abandonTimeout = null;
      console.log("Abandon timeout cancelled — player reconnected");
    }

    // --- SECURITY: Verify game token server-side ---
    // The platform issues a signed JWT (game token) containing userId, devMode, soloMode, etc.
    // We verify the token here instead of trusting client-provided options, because a malicious
    // client could set devMode: true in join options to gain access to dev commands.
    // We use ignoreExpiration because the 60s token lifetime may have elapsed by the time the
    // player navigates through the lobby/intro flow, and will definitely be expired on reconnect.
    // The signature check alone is sufficient to prevent forgery.
    let verifiedUserId: string | undefined;
    let verifiedDevMode = false;
    let verifiedSoloMode = false;

    const gameTokenSecret = process.env.GAME_TOKEN_SECRET;
    if (options.gameToken && gameTokenSecret) {
      try {
        const decoded = jwt.verify(options.gameToken, gameTokenSecret, {
          ignoreExpiration: true,
        }) as {
          userId: string;
          gameConfig?: { devMode?: boolean; mode?: string };
        };
        verifiedUserId = decoded.userId;
        verifiedDevMode = decoded.gameConfig?.devMode === true;
        verifiedSoloMode = decoded.gameConfig?.mode === "solo";
        console.log(`[Security] Verified game token for userId: ${verifiedUserId}, devMode: ${verifiedDevMode}`);
      } catch (err) {
        console.error(`[Security] Invalid game token from ${client.sessionId}:`, err);
        throw new Error("Invalid game token");
      }
    } else if (!options.spectator) {
      console.warn(`[Security] No game token provided by ${client.sessionId} (gameTokenSecret configured: ${!!gameTokenSecret})`);
    }

    // Use verified values from the JWT, falling back to options only if no secret is configured
    // (e.g. local dev without GAME_TOKEN_SECRET set)
    const userId = verifiedUserId || options.userId;
    const devMode = gameTokenSecret ? verifiedDevMode : (options.devMode || false);
    const soloMode = gameTokenSecret ? verifiedSoloMode : (options.soloMode || false);

    // Capture the polarwinds_sessions.id UUID from the client. Passed in as
    // options.sessionId by the lobby (useGameLobby gets it from join-matchmaking's
    // response). Used as the S3 prefix for transcripts so they co-locate with
    // team-feedback.json (which Performance.tsx keys off the same UUID).
    // Fallback to roomId on miss — unsigned value, so no identity risk.
    if (!this.polarWindsSessionId && typeof options.sessionId === "string" && options.sessionId.length > 0) {
      this.polarWindsSessionId = options.sessionId;
      console.log(`Captured polarWindsSessionId=${this.polarWindsSessionId} from client join options`);
    } else if (!this.polarWindsSessionId && !options.spectator) {
      console.warn(`GameRoom ${this.roomId}: no sessionId in client join options; transcript paths will fall back to roomId`);
    }

    // --- REJECT UNKNOWN PLAYERS MID-GAME ---
    // If game has started, only allow reconnecting players (userId must be in userIdToColor)
    if (this.state.gameStarted && !options.spectator) {
      const isReconnecting = userId && this.userIdToColor.has(userId);
      if (!isReconnecting) {
        throw new Error("Game already in progress");
      }
    }

    // --- SPECTATOR HANDLING ---
    if (options.spectator) {
      console.log(`Spectator ${client.sessionId} joined room ${this.roomId}`);
      this.spectatorSessionIds.add(client.sessionId);

      // If the game has already started and voice is configured, send a LiveKit token
      if (this.state.gameStarted && this.livekitRoomName && this.livekitService.isConfigured()) {
        try {
          const token = await this.livekitService.generateToken(
            this.livekitRoomName,
            client.sessionId,
            "SPECTATOR"
          );
          client.send("voiceReady", {
            token,
            livekitUrl: process.env.LIVEKIT_URL,
            roomName: this.livekitRoomName,
          });
          console.log(`Sent LiveKit token to spectator ${client.sessionId}`);
        } catch (error) {
          console.error(`Failed to generate spectator LiveKit token:`, error);
        }
      }
      return; // Skip all player setup
    }

    // Player name comes from the client join options. (removed) previously fetched
    // the player's name/school/discord from a player-profile lookup by userId.
    let playerName = typeof options.playerName === "string" ? options.playerName : "";
    let playerSchool = "";
    let playerDiscordName = "";
    if (userId) {
      this.userIds.set(client.sessionId, userId);
      console.log(`Player ${client.sessionId} has userId: ${userId}, name: ${playerName}`);
    }

    // Set solo mode from first player joining (the one who created the room)
    if (this.state.players.size === 0 && soloMode) {
      this.isSoloMode = true;
      console.log("Room set to SOLO mode");
    }
    if (this.state.players.size === 0 && devMode) {
      this.isDevMode = true;
      console.log("Room set to DEV mode");
    }

    // Check if this is a reconnecting player (by userId)
    const existingColor = userId ? this.userIdToColor.get(userId) : null;

    if (existingColor) {
      // Reconnecting player - restore their color
      console.log(`Player ${client.sessionId} reconnecting with userId ${userId}, restoring color ${existingColor}`);

      // Find and update the existing player entry (update sessionId)
      let existingPlayer: Player | null = null;
      let oldSessionId: string | null = null;
      this.state.players.forEach((player, sessionId) => {
        if (player.color === existingColor) {
          existingPlayer = player;
          oldSessionId = sessionId;
        }
      });

      if (existingPlayer && oldSessionId) {
        // Remove old entry and add with new sessionId
        this.state.players.delete(oldSessionId);
        existingPlayer.sessionId = client.sessionId;
        existingPlayer.name = playerName || existingPlayer.name;
        existingPlayer.school = playerSchool || existingPlayer.school;
        existingPlayer.discordName = playerDiscordName || existingPlayer.discordName;
        this.state.players.set(client.sessionId, existingPlayer);
        console.log(`Restored player ${existingColor} at position (${existingPlayer.x}, ${existingPlayer.y})`);
      } else {
        // Player entry was cleaned up, recreate with same color
        this.assignedColors.add(existingColor);
        const player = new Player();
        player.color = existingColor;
        player.sessionId = client.sessionId;
        player.name = playerName;
        player.school = playerSchool;
        player.discordName = playerDiscordName;
        // Use default position for color
        switch (existingColor) {
          case "RED": player.x = 10; player.y = 14; break;
          case "GREEN": player.x = 12; player.y = 14; break;
          case "BLUE": player.x = 14; player.y = 14; break;
        }
        this.state.players.set(client.sessionId, player);
        console.log(`Recreated player ${existingColor} at position (${player.x}, ${player.y})`);
      }

      console.log(`Total players now: ${this.state.players.size}`);

      // Send LiveKit token to reconnecting player if voice chat is active
      if (this.state.gameStarted && this.livekitRoomName && this.livekitService.isConfigured()) {
        try {
          const token = await this.livekitService.generateToken(
            this.livekitRoomName,
            userId,
            playerName || existingColor
          );
          client.send("voiceReady", {
            token,
            livekitUrl: process.env.LIVEKIT_URL,
            roomName: this.livekitRoomName,
            playerColors: Object.fromEntries(this.userIdToColor),
          });
          console.log(`Sent LiveKit token to reconnecting player ${existingColor} (identity: ${userId})`);
        } catch (error) {
          console.error(`Failed to generate LiveKit token for reconnecting player:`, error);
        }
      }

      return;
    }

    // New player - assign a color
    const availableColor = this.playerColors.find(
      (color) => !this.assignedColors.has(color)
    );

    if (!availableColor) {
      console.log("No available color for player, rejecting join");
      client.leave();
      return;
    }

    console.log(`Assigning color ${availableColor} to player ${client.sessionId}`);
    this.assignedColors.add(availableColor);

    const availableRole = this.playerRoles.find((role) => !this.assignedRoles.has(role))!;
    this.assignedRoles.add(availableRole);
    console.log(`Assigning role ${availableRole} to player ${client.sessionId}`);

    // Track userId -> color mapping for reconnection
    if (userId) {
      this.userIdToColor.set(userId, availableColor);
    }

    const player = new Player();
    player.color = availableColor;
    player.role = availableRole;
    player.sessionId = client.sessionId;
    player.name = playerName;
    player.school = playerSchool;
    player.discordName = playerDiscordName;

    // Set initial position based on color
    switch (availableColor) {
      case "RED":
        player.x = 10;
        player.y = 14;
        break;
      case "GREEN":
        player.x = 12;
        player.y = 14;
        break;
      case "BLUE":
        player.x = 14;
        player.y = 14;
        break;
    }

    console.log(`Player ${availableColor} starting at position (${player.x}, ${player.y})`);

    this.state.players.set(client.sessionId, player);

    console.log(`Total players now: ${this.state.players.size}`);

    // In solo mode, create the remaining 2 players and start immediately
    if (this.isSoloMode && this.state.players.size === 1 && !this.state.gameStarted) {
      const positions: Record<string, { x: number; y: number }> = {
        RED: { x: 10, y: 14 },
        GREEN: { x: 12, y: 14 },
        BLUE: { x: 14, y: 14 },
      };

      for (const color of this.playerColors) {
        if (this.assignedColors.has(color)) continue;

        this.assignedColors.add(color);
        const soloRole = this.playerRoles.find((role) => !this.assignedRoles.has(role))!;
        this.assignedRoles.add(soloRole);

        const soloPlayer = new Player();
        soloPlayer.color = color;
        soloPlayer.role = soloRole;
        soloPlayer.sessionId = `solo-${color.toLowerCase()}`;
        soloPlayer.name = color;
        soloPlayer.x = positions[color].x;
        soloPlayer.y = positions[color].y;

        this.state.players.set(soloPlayer.sessionId, soloPlayer);

        console.log(`Solo mode: Created ${color} player (role: ${soloRole}) at (${soloPlayer.x}, ${soloPlayer.y})`);
      }

      console.log("Solo mode: All 3 players created, initializing game...");
      this.initializeGame();
      return;
    }

    // If all 3 players have joined, initialize the game
    if (this.state.players.size === 3 && !this.state.gameStarted) {
      console.log("All 3 players joined! Initializing game...");
      this.initializeGame();
    }
  }

  onLeave(client: Client, consented: boolean) {
    console.log(client.sessionId, "left!", consented ? "(consented)" : "(disconnected)");
    console.log(`Clients remaining: ${this.clients.length - 1}, autoDispose: ${this.autoDispose}`);

    if (this.spectatorSessionIds.has(client.sessionId)) {
      this.spectatorSessionIds.delete(client.sessionId);
      console.log(`Spectator ${client.sessionId} left`);
      return;
    }

    const player = this.state.players.get(client.sessionId);
    const userId = this.userIds.get(client.sessionId);

    if (player) {
      if (this.isSoloMode && !userId) {
        // Solo mode fake client disconnected - free the slot immediately so new fake clients can join
        this.assignedColors.delete(player.color);
        this.assignedRoles.delete(player.role as PlayerRole);
        this.state.players.delete(client.sessionId);
        console.log(`Solo mode fake client ${player.color} disconnected, slot freed`);
      } else if (consented && !this.state.gameStarted) {
        // Player intentionally cancelled before game started - free the slot
        this.assignedColors.delete(player.color);
        this.assignedRoles.delete(player.role as PlayerRole);
        this.state.players.delete(client.sessionId);
        if (userId) {
          this.userIdToColor.delete(userId);
        }
        console.log(`Player ${player.color} cancelled before game start, slot freed`);
      } else {
        // Real player disconnected during game - keep slot reserved for reconnection via joinById
        // Don't remove player data or color assignment
        console.log(`Player ${player.color} disconnected, keeping slot reserved for reconnection`);
        console.log(`Players in state: ${this.state.players.size}, assigned colors: ${Array.from(this.assignedColors).join(', ')}`);
      }
    }

    // Clean up sessionId -> userId mapping (but keep userIdToColor for reconnection)
    this.userIds.delete(client.sessionId);

    // If room is empty and game hasn't started, dispose the room
    // Note: this.clients is already updated (client removed) before onLeave is called
    if (this.clients.length === 0 && !this.state.gameStarted) {
      console.log("Last player left before game started, disposing room");
      this.disconnect();
    }

    // If game is active and no real clients remain, start abandon countdown
    // (spectators don't count — filter them out)
    const realClients = this.clients.filter(c => !this.spectatorSessionIds.has(c.sessionId));
    if (this.state.gameStarted && !this.state.isGameOver && realClients.length === 0) {
      console.log(`All players disconnected during active game, starting ${this.ABANDON_TIMEOUT / 1000}s abandon timeout`);
      this.abandonTimeout = setTimeout(async () => {
        console.log("Abandon timeout expired — no players reconnected, marking abandoned and disposing room");
        this.state.isGameOver = true;
        await this.endPolarWindsSession({ abandoned: true });
        this.disconnect();
      }, this.ABANDON_TIMEOUT);
    }
  }

  async onDispose() {
    console.log("room", this.roomId, "disposing...");
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }
    if (this.lobbyTimeout) {
      clearTimeout(this.lobbyTimeout);
      this.lobbyTimeout = null;
    }
    if (this.abandonTimeout) {
      clearTimeout(this.abandonTimeout);
      this.abandonTimeout = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }

    // Safety net: if the session was never successfully ended in the DB
    // (e.g. server shutdown, or endPolarWindsSession failed with a 500), retry now
    if ((this.polarWindsSessionId || this.roomId) && !this.sessionEndedInDb) {
      console.log("Room disposing with session not ended in DB — retrying as abandoned with replay data");
      await this.endPolarWindsSession({ abandoned: true });
    }
  }

  private async initializeGame() {
    // Cancel lobby timeout since game is starting
    if (this.lobbyTimeout) {
      clearTimeout(this.lobbyTimeout);
      this.lobbyTimeout = null;
    }

    // Hide from matchmaking but still allow joinById for reconnection
    await this.setPrivate(true);

    this.state.gameStarted = true;
    if (this.currentLevel) this.currentLevel.onLevelStart();

    console.log(`Game mode: ${this.isSoloMode ? 'SOLO' : 'MULTIPLAYER'}`);

    // Initialize LiveKit voice chat (only in multiplayer mode)
    if (!this.isSoloMode) {
      await this.initializeVoiceChat();
    }

    // Start countdown immediately — no ready-up handshake needed
    this.startGameplay();
  }

  private startGameplay() {
    console.log("Starting countdown...");

    // Start 3-second countdown
    this.state.countdown = 3;
    this.countdownTimer = setInterval(() => {
      // Explicit assignment so @colyseus/schema always encodes a patch (postfix -- can miss updates in some builds).
      const next = this.state.countdown - 1;
      this.state.countdown = next;
      if (next <= 0) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.state.timeRemaining = this.GAME_DURATION;
        this.gameStartTime = Date.now();
        this.startGameTimer();
        console.log("Countdown complete — game timer started!");
      }
    }, 1000);
  }

  private async initializeVoiceChat() {
    console.log("initializeVoiceChat called, isConfigured:", this.livekitService.isConfigured());

    if (!this.livekitService.isConfigured()) {
      console.log("LiveKit not configured, skipping voice chat initialization");
      return;
    }

    // Generate LiveKit room name tied to Colyseus room
    this.livekitRoomName = `polar-winds-${this.roomId}`;
    const livekitUrl = process.env.LIVEKIT_URL;
    console.log("LiveKit URL from env:", livekitUrl);

    // Build userId→color map for the voice overlay on clients
    const playerColors = Object.fromEntries(this.userIdToColor);

    // Generate tokens for all players and send to each
    // Use userId as identity so voice works consistently across lobby and game
    const tokenPromises = Array.from(this.state.players.entries()).map(
      async ([sessionId, player]) => {
        try {
          const identity = this.userIds.get(sessionId) || sessionId;
          const token = await this.livekitService.generateToken(
            this.livekitRoomName!,
            identity,
            player.name || player.color
          );

          const client = this.clients.find((c) => c.sessionId === sessionId);
          if (client) {
            client.send("voiceReady", {
              token,
              livekitUrl,
              roomName: this.livekitRoomName,
              playerColors,
            });
            console.log(`Sent LiveKit token to player ${player.color} (identity: ${identity})`);
          }
        } catch (error) {
          console.error(`Failed to generate LiveKit token for ${player.color}:`, error);
        }
      }
    );

    await Promise.all(tokenPromises);

    // Send LiveKit tokens to any connected spectators
    for (const spectatorSessionId of this.spectatorSessionIds) {
      try {
        const token = await this.livekitService.generateToken(
          this.livekitRoomName!,
          spectatorSessionId,
          "SPECTATOR"
        );
        const client = this.clients.find((c) => c.sessionId === spectatorSessionId);
        if (client) {
          client.send("voiceReady", {
            token,
            livekitUrl,
            roomName: this.livekitRoomName,
            playerColors,
          });
          console.log(`Sent LiveKit token to spectator ${spectatorSessionId}`);
        }
      } catch (error) {
        console.error(`Failed to generate spectator LiveKit token:`, error);
      }
    }
  }

  private startGameTimer() {
    this.gameTimer = setInterval(() => {
      if (this.isDevMode) {
        this.state.timeRemaining--;
      } else if (this.state.timeRemaining > 0) {
        this.state.timeRemaining--;
      }

      if (this.state.timeRemaining <= 0 && !this.state.isGameOver && !this.isDevMode) {
        this.endGame();
      }
    }, 1000);
  }

  private async endGame() {
    if (this.gameTimer) {
      clearInterval(this.gameTimer);
      this.gameTimer = null;
    }

    this.state.isGameOver = true;
    this.state.bombExploded = true;

    console.log("Game ended!");

    await this.endPolarWindsSession();

    // Dispose the room after game ends
    this.disconnect();
  }

  private logEvent(event: Record<string, unknown>) {
    event.t = Date.now() - this.gameStartTime;
    this.replayEvents.push(event);
  }

  private async endPolarWindsSession(_options?: { abandoned?: boolean }) {
    // (removed) Standalone build has no persistence. This previously POSTed the
    // final score and full replay (events + player metadata) to a platform
    // end-session endpoint so the game could be stored/replayed. Replay events are
    // still collected in-memory via logEvent() but are discarded when the room
    // disposes.
  }

  private switchLevel(next: BaseLevel) {
    if (this.currentLevel) {
      this.currentLevel.onDispose();
    }
    this.currentLevel = next;
    this.currentLevel.onLevelStart();
  }

  private advanceToStage(newStage: number) {
    this.logEvent({ e: "stage", stage: newStage });
    const oldGridWidth = this.state.gridWidth;
    const oldGridHeight = this.state.gridHeight;
    this.state.stage = newStage;
    this.state.gridWidth = Math.min(this.INITIAL_VISIBLE_WIDTH + (newStage - 1) * 2, this.MAX_GRID_SIZE);
    this.state.gridHeight = Math.min(this.INITIAL_VISIBLE_HEIGHT + (newStage - 1) * 2, this.MAX_GRID_SIZE);
    console.log(`Stage ${newStage}: Visible area expanded from ${oldGridWidth}x${oldGridHeight} to ${this.state.gridWidth}x${this.state.gridHeight}`);
  }

}
