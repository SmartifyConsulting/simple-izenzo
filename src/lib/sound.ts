/** A short two-note chime played whenever the workflow advances itself to the next step
 * (search finishing, media screening completing, an auto-advance firing, etc.) — synthesized
 * with the Web Audio API rather than shipping an audio file. Silently does nothing if the
 * browser blocks audio before the user has interacted with the page yet. */
export function playStepAdvanceChime() {
  if (typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    // Some browsers hand back a context that starts "suspended" until explicitly resumed, even
    // after an earlier user gesture on the page — without this the oscillators schedule silently
    // and nothing is ever actually heard.
    void ctx.resume();
    const now = ctx.currentTime;
    const notes = [660, 880];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.09;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
    setTimeout(() => void ctx.close(), 400);
  } catch {
    // Best-effort — a missed chime never blocks the actual step change.
  }
}
