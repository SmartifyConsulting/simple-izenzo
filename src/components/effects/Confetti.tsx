import { useEffect, useState } from "react";

const COLORS = ["#14b8a6", "#4169e1", "#F97316", "#22c55e", "#facc15"];

type Piece = {
  id: number;
  left: number;
  delay: number;
  duration: number;
  color: string;
  rotate: number;
  drift: number;
};

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 2.6 + Math.random() * 1.4,
    color: COLORS[id % COLORS.length]!,
    rotate: Math.random() * 360,
    drift: Math.random() * 80 - 40,
  }));
}

/** A brief, brand-coloured confetti burst with a centered congratulations banner — fired once a
 * deal genuinely closes (every required document signed by both sides), not at any earlier
 * milestone. Self-contained (no external animation library) and unmounts itself once the last
 * piece has finished falling. */
export function Confetti({ message, onDone }: { message: string; onDone: () => void }) {
  const [pieces] = useState(() => makePieces(90));
  const [bannerOut, setBannerOut] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setBannerOut(true), 2600);
    const doneTimer = setTimeout(onDone, 4200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[200] overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            top: -20,
            left: `${p.left}%`,
            width: 8,
            height: 14,
            backgroundColor: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `izenzo-confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            // @ts-expect-error -- custom property read by the keyframes below
            "--drift": `${p.drift}px`,
          }}
        />
      ))}
      <div
        className={`absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-double border-foreground/70 bg-background/95 px-8 py-6 text-center shadow-2xl transition-opacity duration-500 ${
          bannerOut ? "opacity-0" : "opacity-100"
        }`}
      >
        <p className="text-lg font-bold">Congratulations!</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
      </div>
      <style>{`
        @keyframes izenzo-confetti-fall {
          0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift), 110vh) rotate(540deg); opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}
