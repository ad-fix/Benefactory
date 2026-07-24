import { createContext, useContext, useMemo, type CSSProperties, type ReactNode } from "react";
import { CheckCircle2, Factory, Package, Scissors } from "lucide-react";

interface ConveyorLocal {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  owner: string;
}

interface MachineLocal {
  id: string;
  machineType: string;
  order: number;
  x: number;
  y: number;
}

interface ConveyorLevelState {
  stage: number;
  conveyors: ConveyorLocal[];
  machines: MachineLocal[];
  itemX: number;
  itemY: number;
  processedCount: number;
  itemState: string;
  statusMessage: string;
  complete: boolean;
}

interface ConveyorLevelViewProps {
  role: string;
}

interface ConveyorLevelContextValue {
  conveyorLevel: ConveyorLevelState;
  gridWidth: number;
  gridHeight: number;
  playersConnected: number;
  roomId: string;
  worldToScreenPercent: (worldX: number, worldZ: number) => { leftPercent: number; topPercent: number };
}

const ConveyorLevelContext = createContext<ConveyorLevelContextValue | null>(null);

export const ConveyorLevelProvider = ({
  children,
  ...value
}: ConveyorLevelContextValue & { children: ReactNode }) => (
  <ConveyorLevelContext.Provider value={value}>{children}</ConveyorLevelContext.Provider>
);

const PALETTE = {
  ground: "#26302f",
  panel: "#213242",
  cream: "#ebe5cf",
  red: "#ef4444",
  green: "#22c55e",
  blue: "#3b82f6",
};

const SPACING = 2.5;

const gridToWorld = (x: number, y: number, gridWidth: number, gridHeight: number) => {
  const MAX_GRID = 26;
  const center = Math.floor(MAX_GRID / 2);
  const minX = center - Math.floor(gridWidth / 2);
  const minY = center - Math.floor(gridHeight / 2);
  const offsetX = (gridWidth - 1) / 2;
  const offsetY = (gridHeight - 1) / 2;
  return {
    worldX: (x - minX - offsetX) * SPACING,
    worldZ: (y - minY - offsetY) * SPACING,
  };
};

export const ROLE_THEME: Record<string, { label: string; color: string; glow: string; shape: "square" | "triangle" | "circle" }> = {
  ENGINEER: { label: "Engineer", color: PALETTE.red, glow: "rgba(239,68,68,0.55)", shape: "square" },
  MONITOR: { label: "Monitor", color: PALETTE.green, glow: "rgba(34,197,94,0.55)", shape: "triangle" },
  OPERATOR: { label: "Operator", color: PALETTE.blue, glow: "rgba(59,130,246,0.55)", shape: "circle" },
};

const beltContainsPoint = (belt: ConveyorLocal, x: number, y: number) => {
  if (belt.startY === belt.endY) {
    return y === belt.startY && x >= Math.min(belt.startX, belt.endX) && x <= Math.max(belt.startX, belt.endX);
  }
  return x === belt.startX && y >= Math.min(belt.startY, belt.endY) && y <= Math.max(belt.startY, belt.endY);
};

const conveyorSurface = (horizontal: boolean, color: string) => horizontal
  ? `linear-gradient(to bottom, ${color} 0 7%, rgba(0,0,0,.58) 7% 12%, transparent 12% 88%, rgba(0,0,0,.58) 88% 93%, ${color} 93%), repeating-linear-gradient(90deg, rgba(235,229,207,.13) 0 2px, rgba(235,229,207,.025) 2px 8px, rgba(0,0,0,.2) 8px 15px), linear-gradient(#555b58,#202421)`
  : `linear-gradient(to right, ${color} 0 7%, rgba(0,0,0,.58) 7% 12%, transparent 12% 88%, rgba(0,0,0,.58) 88% 93%, ${color} 93%), repeating-linear-gradient(0deg, rgba(235,229,207,.13) 0 2px, rgba(235,229,207,.025) 2px 8px, rgba(0,0,0,.2) 8px 15px), linear-gradient(90deg,#555b58,#202421)`;

export const RoleMark = ({ role }: { role: string }) => {
  const theme = ROLE_THEME[role] ?? ROLE_THEME.OPERATOR;
  if (theme.shape === "triangle") {
    return (
      <span
        className="inline-block h-0 w-0"
        style={{
          borderLeft: "6px solid transparent",
          borderRight: "6px solid transparent",
          borderBottom: `11px solid ${theme.color}`,
          filter: `drop-shadow(0 0 5px ${theme.glow})`,
        }}
      />
    );
  }
  return (
    <span
      className="inline-block size-3 border-2"
      style={{
        borderColor: theme.color,
        borderRadius: theme.shape === "circle" ? "999px" : "1px",
        background: theme.shape === "circle" ? theme.color : "transparent",
        boxShadow: `0 0 8px ${theme.glow}`,
      }}
    />
  );
};

export const ConveyorLevelView = ({ role }: ConveyorLevelViewProps) => {
  const factory = useContext(ConveyorLevelContext);
  if (!factory) return null;
  if (factory.conveyorLevel.conveyors.length === 0) return null;
  return <ConveyorBoard role={role} {...factory} />;
};

const ConveyorWaitingRoom = ({
  playersConnected,
  roomId,
}: Pick<ConveyorLevelContextValue, "playersConnected" | "roomId">) => (
  <div className="pointer-events-none absolute inset-0 z-[30] flex items-center justify-center overflow-hidden bg-[#050807] font-mono text-[#ebe5cf]">
    <div
      className="absolute inset-0 opacity-50"
      style={{
        background:
          "radial-gradient(circle at 20% 20%,rgba(239,68,68,.16),transparent 28%),radial-gradient(circle at 80% 22%,rgba(34,197,94,.14),transparent 28%),radial-gradient(circle at 50% 85%,rgba(59,130,246,.18),transparent 32%),linear-gradient(135deg,#050807,#17201e)",
      }}
    />
    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "linear-gradient(rgba(235,229,207,.12) 1px,transparent 1px),linear-gradient(90deg,rgba(235,229,207,.12) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />

    <main className="relative w-[min(42rem,calc(100vw-2rem))] border border-[#ebe5cf]/25 bg-[#213242]/95 p-8 text-center shadow-[0_0_70px_rgba(0,0,0,.8)]">
      <Factory className="mx-auto size-10" />
      <p className="mt-4 text-[10px] uppercase tracking-[.35em] text-[#ebe5cf]/45">Factory crew assembly</p>
      <h1 className="mt-2 text-4xl font-black uppercase tracking-[.12em]">Benefactory</h1>
      <p className="mt-3 text-xs text-[#ebe5cf]/60">Three separate players are required to start production.</p>

      <div className="mt-7 grid grid-cols-3 gap-3">
        {[
          { role: "ENGINEER", label: "Engineer", color: PALETTE.red },
          { role: "MONITOR", label: "Monitor", color: PALETTE.green },
          { role: "OPERATOR", label: "Operator", color: PALETTE.blue },
        ].map((slot, index) => {
          const connected = index < playersConnected;
          return (
            <div key={slot.role} className="border px-3 py-4" style={{ borderColor: connected ? slot.color : "rgba(235,229,207,.15)", background: connected ? `${slot.color}18` : "rgba(0,0,0,.2)" }}>
              <RoleMark role={slot.role} />
              <p className="mt-2 text-xs font-black uppercase tracking-wider" style={{ color: connected ? slot.color : "rgba(235,229,207,.35)" }}>{slot.label}</p>
              <p className="mt-1 text-[9px] uppercase tracking-widest text-[#ebe5cf]/40">{connected ? "Connected" : "Waiting"}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-7 border border-[#ebe5cf]/15 bg-black/30 px-5 py-4">
        <p className="text-[9px] uppercase tracking-[.24em] text-[#ebe5cf]/40">Room code</p>
        <p className="mt-1 text-2xl font-black tracking-[.2em] text-white">{roomId || "CREATING"}</p>
        <p className="mt-2 text-[10px] text-[#ebe5cf]/50">Share this code with the other two players.</p>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3 text-xs uppercase tracking-[.18em]">
        <span className="size-2 animate-pulse rounded-full bg-[#ebe5cf]" />
        Waiting for crew: {Math.min(playersConnected, 3)} / 3
      </div>
    </main>
  </div>
);

const ConveyorBoard = ({
  role,
  conveyorLevel,
  gridWidth,
  gridHeight,
  worldToScreenPercent,
}: ConveyorLevelViewProps & ConveyorLevelContextValue) => {
  const activeTheme = ROLE_THEME[role] ?? ROLE_THEME.OPERATOR;

  const position = (x: number, y: number): CSSProperties => {
    const { worldX, worldZ } = gridToWorld(x, y, gridWidth, gridHeight);
    const { leftPercent, topPercent } = worldToScreenPercent(worldX, worldZ);
    return { left: `${leftPercent}%`, top: `${topPercent}%` };
  };

  const beltWorldBounds = (belt: ConveyorLocal) => {
    const horizontal = belt.startY === belt.endY;
    const minGX = Math.min(belt.startX, belt.endX);
    const maxGX = Math.max(belt.startX, belt.endX);
    const minGY = Math.min(belt.startY, belt.endY);
    const maxGY = Math.max(belt.startY, belt.endY);
    const thicknessCells = 0.62;

    const centerMin = gridToWorld(minGX, minGY, gridWidth, gridHeight);
    const centerMax = gridToWorld(maxGX, maxGY, gridWidth, gridHeight);
    const halfCell = SPACING / 2;
    const halfThickness = (thicknessCells * SPACING) / 2;

    return horizontal
      ? {
          worldMinX: centerMin.worldX - halfCell,
          worldMaxX: centerMax.worldX + halfCell,
          worldMinZ: centerMin.worldZ - halfThickness,
          worldMaxZ: centerMin.worldZ + halfThickness,
        }
      : {
          worldMinX: centerMin.worldX - halfThickness,
          worldMaxX: centerMin.worldX + halfThickness,
          worldMinZ: centerMin.worldZ - halfCell,
          worldMaxZ: centerMax.worldZ + halfCell,
        };
  };

const beltStyle = (belt: ConveyorLocal): CSSProperties => {
  const { worldMinX, worldMaxX, worldMinZ, worldMaxZ } = beltWorldBounds(belt);
  const topLeft = worldToScreenPercent(worldMinX, worldMinZ);
  const bottomRight = worldToScreenPercent(worldMaxX, worldMaxZ);
  return {
    left: `${topLeft.leftPercent}%`,
    top: `${topLeft.topPercent}%`,
    width: `${bottomRight.leftPercent - topLeft.leftPercent}%`,
    height: `${bottomRight.topPercent - topLeft.topPercent}%`,
  };
};

  const beltsAtItem = useMemo(
    () => new Set(conveyorLevel.conveyors.filter((belt) => beltContainsPoint(belt, conveyorLevel.itemX, conveyorLevel.itemY)).map((belt) => belt.id)),
    [conveyorLevel.conveyors, conveyorLevel.itemX, conveyorLevel.itemY],
  );

  const sortedMachines = useMemo(
    () => [...conveyorLevel.machines].sort((a, b) => a.order - b.order),
    [conveyorLevel.machines],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-[30] font-sans text-[#ebe5cf]">
      <div 
          className="absolute inset-0">      
        <div
          className="absolute inset-0 opacity-1"
          style={{
            backgroundImage: "linear-gradient(rgba(235,229,207,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(235,229,207,.1) 1px,transparent 1px)",
            backgroundSize: `${100 / gridWidth}% ${100 / gridHeight}%`,
          }}
        />
        {conveyorLevel.conveyors.map((belt) => {
          const theme = ROLE_THEME[belt.owner] ?? ROLE_THEME.OPERATOR;
          const horizontal = belt.startY === belt.endY;
          const owned = belt.owner === role;
          const atItem = beltsAtItem.has(belt.id);
          return (
            <div
              key={belt.id}
              className="absolute rounded-[2px] border"
              style={{
                ...beltStyle(belt),
                background: conveyorSurface(horizontal, theme.color),
                backgroundSize: horizontal ? "auto,15px 100%,auto" : "auto,100% 15px,auto",
                borderColor: atItem && owned ? PALETTE.cream : theme.color,
                borderWidth: owned ? 2 : 1,
                opacity: owned || atItem ? 1 : 0.8,
                boxShadow: atItem
                  ? `0 0 20px ${theme.glow},inset 0 0 15px rgba(0,0,0,.7)`
                  : owned
                    ? `0 0 12px ${theme.glow},inset 0 0 15px rgba(0,0,0,.7)`
                    : "inset 0 0 15px rgba(0,0,0,.75)",
              }}
            />
          );
        })}

        {sortedMachines.map((machine) => {
          const active = machine.order === conveyorLevel.processedCount + 1;
          const completed = machine.order <= conveyorLevel.processedCount;
          return (
            <div
              key={machine.id}
              className="absolute z-20 flex size-[clamp(2rem,3.1vw,3.2rem)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border bg-[#213242]/95 shadow-xl"
              style={{
                ...position(machine.x, machine.y),
                borderColor: completed ? "#86efac" : active ? PALETTE.cream : "rgba(235,229,207,.28)",
                boxShadow: active ? "0 0 25px rgba(235,229,207,.48)" : completed ? "0 0 18px rgba(134,239,172,.32)" : undefined,
              }}
            >
              {completed ? <CheckCircle2 className="size-4 text-green-300" /> : <Factory className="size-4" />}
              <span className="mt-0.5 text-[8px] font-black tracking-wider">M{machine.order}</span>
            </div>
          );
        })}

        <div
          className="absolute z-30 flex size-[clamp(2.4rem,3.8vw,3.8rem)] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-[#ebe5cf] text-[#26302f] shadow-[0_0_28px_rgba(235,229,207,.55)] transition-all duration-300"
          style={position(conveyorLevel.itemX, conveyorLevel.itemY)}
        >
          {conveyorLevel.complete ? <Scissors className="size-6" /> : <Package className="size-6" />}
        </div>
      </div>
    </div>
  );
};
