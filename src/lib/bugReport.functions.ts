import { createServerFn } from "@tanstack/react-start";

/** Turns a dictated report into text using the Lovable AI transcription endpoint. */
export const transcribeBugReport = createServerFn({ method: "POST" })
  .inputValidator((input: { audioBase64: string; mimeType?: string }) => {
    if (!input?.audioBase64 || typeof input.audioBase64 !== "string") {
      throw new Error("No recording was received.");
    }
    if (input.audioBase64.length > 7_000_000) {
      throw new Error("That recording is too long — keep it under about 30 seconds.");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Voice notes are not configured on this workspace.");

    const cleaned = data.audioBase64.replace(/^data:[^;]+;base64,/, "");
    const bytes = Uint8Array.from(atob(cleaned), (c) => c.charCodeAt(0));
    if (bytes.byteLength < 2048) {
      throw new Error("That recording was empty — please try again.");
    }

    const mime = (data.mimeType ?? "audio/webm").split(";")[0] ?? "audio/webm";
    const ext =
      ({
        "audio/webm": "webm",
        "audio/mp4": "mp4",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/x-wav": "wav",
      } as Record<string, string>)[mime] ?? "webm";

    const form = new FormData();
    form.append("model", "google/gemini-3.5-transcribe");
    form.append("file", new Blob([bytes], { type: mime }), `recording.${ext}`);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("Bug report transcription failed", res.status, detail);
      if (res.status === 429) throw new Error("Too many requests — try again in a moment.");
      if (res.status === 402 || res.status === 403) {
        const { alertLowFunds } = await import("@/lib/opsAlerts.server");
        void alertLowFunds("Voice transcription (AI Gateway)", res.status, detail);
        throw new Error("Voice notes are unavailable right now — please type the report instead.");
      }
      throw new Error("Could not transcribe that recording — please type the report instead.");
    }

    const json = (await res.json()) as { text?: string };
    const text = (json.text ?? "").trim();
    if (!text) throw new Error("Couldn't hear that — try again.");
    return { text };
  });
