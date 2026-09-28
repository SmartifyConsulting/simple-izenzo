import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

/** Brand-coloured confetti burst with a congratulations banner.
 * With `txId` + `kind`, it shows only once per person per deal (on any device): if already
 * acknowledged it renders nothing, otherwise it stays until "Fantastic!" is clicked and records
 * that in `celebrations_seen`. Without them it auto-dismisses after ~4s. */
export function Confetti({
  message,
  onDone,
  txId,
  kind,
}: {
  message: string;
  onDone: () => void;
  txId?: string | null | undefined;
  kind?: string | undefined;
}) {
  const once = Boolean(txId && kind);
  const [pieces] = useState(() => makePieces(90));
  const [bannerOut, setBannerOut] = useState(false);
  const [ready, setReady] = useState(!once);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (!once) {
      const fadeTimer = setTimeout(() => setBannerOut(true), 3500);
      const doneTimer = setTimeout(() => doneRef.current(), 4200);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(doneTimer);
      };
    }
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return doneRef.current();
      const { data } = await supabase
        .from("celebrations_seen")
        .select("kind")
        .eq("user_id", uid)
        .eq("transaction_id", txId!)
        .eq("kind", kind!)
        .maybeSingle();
      if (cancelled) return;
      if (data) doneRef.current();
      else setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [once, txId, kind]);

  async function acknowledge() {
    setBannerOut(true);
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user?.id && txId && kind) {
      await supabase
        .from("celebrations_seen")
        .upsert({ user_id: auth.user.id, transaction_id: txId, kind }, { onConflict: "user_id,transaction_id,kind", ignoreDuplicates: true });
    }
    doneRef.current();
  }

  if (!ready) return null;

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
        } ${once ? "pointer-events-auto" : ""}`}
      >
        <p className="text-lg font-bold">Congratulations!</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {once && (
          <button
            type="button"
            onClick={() => void acknowledge()}
            className="mt-4 rounded-md bg-foreground px-5 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            Fantastic!
          </button>
        )}
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
