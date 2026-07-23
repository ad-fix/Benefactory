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

const ROLE_THEME: Record<string, { label: string; color: string; glow: string; shape: "square" | "triangle" | "circle" }> = {
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

const RoleMark = ({ role }: { role: string }) => {
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
  if (factory.conveyorLevel.conveyors.length === 0) {
    return <ConveyorWaitingRoom playersConnected={factory.playersConnected} roomId={factory.roomId} />;
  }
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
}: ConveyorLevelViewProps & ConveyorLevelContextValue) => {
  const minX = 13 - Math.floor(gridWidth / 2);
  const minY = 13 - Math.floor(gridHeight / 2);
  const activeTheme = ROLE_THEME[role] ?? ROLE_THEME.OPERATOR;

  const position = (x: number, y: number): CSSProperties => ({
    left: `${((x - minX + 0.5) / gridWidth) * 100}%`,
    top: `${((y - minY + 0.5) / gridHeight) * 100}%`,
  });

  const beltStyle = (belt: ConveyorLocal): CSSProperties => {
    const horizontal = belt.startY === belt.endY;
    const localX = Math.min(belt.startX, belt.endX) - minX;
    const localY = Math.min(belt.startY, belt.endY) - minY;
    const length = Math.abs(belt.endX - belt.startX) + Math.abs(belt.endY - belt.startY) + 1;
    const thickness = 0.62;
    return {
      left: `${((horizontal ? localX : localX + (1 - thickness) / 2) / gridWidth) * 100}%`,
      top: `${((horizontal ? localY + (1 - thickness) / 2 : localY) / gridHeight) * 100}%`,
      width: `${((horizontal ? length : thickness) / gridWidth) * 100}%`,
      height: `${((horizontal ? thickness : length) / gridHeight) * 100}%`,
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
    <div className="pointer-events-none absolute inset-0 z-[30] font-mono text-[#ebe5cf]">
      <div
        className="absolute inset-x-[8%] bottom-[8%] top-[17%] border border-[#ebe5cf]/20 bg-black/90 shadow-[0_0_50px_rgba(0,0,0,.75)]"
      >
        <div
          className="absolute inset-0 opacity-35"
          style={{
            backgroundImage: "linear-gradient(rgba(235,229,207,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(235,229,207,.1) 1px,transparent 1px)",
            backgroundSize: `${100 / gridWidth}% ${100 / gridHeight}%`,
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_15%,rgba(0,0,0,.6)_100%)]" />

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
                opacity: owned || atItem ? 1 : 0.5,
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

      <section className="absolute right-[9%] top-4 flex max-w-[44vw] items-center gap-2 border border-[#ebe5cf]/20 bg-[#213242]/95 px-3 py-2 shadow-xl lg:gap-4 lg:px-4">
        <Factory className="size-5 text-[#ebe5cf]" />
        <div>
          <p className="hidden text-[9px] uppercase tracking-[.22em] text-[#ebe5cf]/50 lg:block">Benefactory production floor</p>
          <p className="text-sm font-black uppercase tracking-[.12em]">Phase {conveyorLevel.stage} / 3</p>
        </div>
        <div className="h-8 w-px bg-[#ebe5cf]/15" />
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider" style={{ color: activeTheme.color }}>
          <RoleMark role={role} /> {activeTheme.label}
        </div>
      </section>

      <div className="absolute bottom-[2.5%] left-1/2 flex -translate-x-1/2 items-center gap-4 border border-[#ebe5cf]/15 bg-black/75 px-4 py-1.5 text-[9px] uppercase tracking-wider text-[#ebe5cf]/65">
        <span>WASD / arrows run your belts</span>
        {Object.entries(ROLE_THEME).map(([key, theme]) => (
          <span key={key} className="flex items-center gap-1.5" style={{ color: theme.color }}><RoleMark role={key} /> {theme.label}</span>
        ))}
      </div>

      {conveyorLevel.complete && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="border-2 border-[#ebe5cf]/60 bg-[#213242] px-12 py-8 text-center shadow-[0_0_60px_rgba(235,229,207,.3)]">
            <Scissors className="mx-auto size-12" />
            <p className="mt-4 text-2xl font-black uppercase tracking-[.2em]">Wire cutter complete</p>
            <p className="mt-2 text-xs text-[#ebe5cf]/65">All nine machines completed in the correct order.</p>
          </div>
        </div>
      )}
    </div>
  );
};
