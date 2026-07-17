const TOTAL_LIGHTS = 4;

interface StageLightsProps {
  lights: number;
}

export const StageLights = ({ lights }: StageLightsProps) => (
  <div className="absolute left-1/2 top-[7rem] z-10 -translate-x-1/2 flex items-center gap-2">
    {Array.from({ length: TOTAL_LIGHTS }, (_, i) => {
      const lit = i < lights;
      return (
        <div
          key={i}
          className="size-2.5 rounded-full border transition-all duration-300"
          style={{
            backgroundColor: lit ? "#38bdf8" : "transparent",
            borderColor: lit ? "#38bdf8" : "rgba(56,189,248,0.25)",
            boxShadow: lit ? "0 0 8px 1px rgba(56,189,248,0.7)" : "none",
          }}
        />
      );
    })}
  </div>
);
