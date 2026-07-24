const TOTAL_LIGHTS = 4;

interface StageLightsProps {
  lights: number;
}

export const StageLights = ({ lights }: StageLightsProps) => (
  <div className="fixed right-[20rem] top-1/2 z-10 -translate-y-1/2 flex flex-col-reverse items-center gap-4">
    {Array.from({ length: TOTAL_LIGHTS }, (_, i) => {
      const lit = i < lights;
      return (
        <div
          key={i}
          className="size-10 rounded-full border transition-all duration-300"
          style={{
            backgroundColor: lit ? "#39FF14" : "rgba(178,34,34,0.4)",
            borderColor: lit ? "#39FF14" : "#b91c1c",
            boxShadow: lit
              ? "0 0 6px 2px rgba(57,255,20,0.7), 0 0 14px 6px rgba(57,255,20,0.45), 0 0 24px 12px rgba(57,255,20,0.25), 0 0 36px 18px rgba(57,255,20,0.12)"
              : "none",
          }}
        />
      );
    })}
  </div>
);
