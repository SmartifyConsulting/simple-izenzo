/** Minimal Chrome DevTools Protocol client for Bright Data's Browser API.
 *
 * The Browser API is a remote Chrome reachable over a single wss:// address with the
 * username and password embedded (BRIGHTDATA_BROWSER_URL). Puppeteer/Playwright/Selenium all
 * just speak CDP to that address, so we talk to it directly — the heavyweight drivers do not
 * run inside our serverless runtime, a plain WebSocket does. */

const DEFAULT_TIMEOUT_MS = 45_000;

type CdpMessage = {
  id?: number;
  method?: string;
  result?: Record<string, unknown>;
  error?: { message?: string };
  params?: Record<string, unknown>;
  sessionId?: string;
};

export function brightDataConfigured() {
  return Boolean(process.env["BRIGHTDATA_BROWSER_URL"]);
}

/** Opens the socket. Serverless runtimes only allow the fetch-upgrade form; Node (dev) needs the
 * `ws` client so the credentials can travel as an Authorization header — the browser-style
 * WebSocket constructor silently drops user:pass from the URL. Try both so the same code works in
 * preview and in production. */
async function openSocket(): Promise<WebSocket> {
  const raw = process.env["BRIGHTDATA_BROWSER_URL"];
  if (!raw) throw new Error("Bright Data is not connected yet.");

  const url = new URL(raw);
  const user = decodeURIComponent(url.username);
  const pass = decodeURIComponent(url.password);
  url.username = "";
  url.password = "";
  const authorization = user ? `Basic ${btoa(`${user}:${pass}`)}` : "";

  // Serverless (workerd): upgrade through fetch.
  try {
    const res = await fetch(url.toString().replace(/^ws/, "http"), {
      headers: {
        Upgrade: "websocket",
        Connection: "Upgrade",
        ...(authorization ? { Authorization: authorization } : {}),
      },
    });
    const socket = (res as unknown as { webSocket?: WebSocket }).webSocket;
    if (socket) {
      (socket as unknown as { accept: () => void }).accept();
      return socket;
    }
    if (res.status === 407 || res.status === 403) {
      throw new Error(
        "Bright Data refused the connection (check the zone's password and allowed-IP setting).",
      );
    }
  } catch (err) {
    if ((err as Error).message.startsWith("Bright Data refused")) throw err;
    // fall through to the Node client
  }

  const { default: NodeWebSocket } = await import("ws");
  return await new Promise<WebSocket>((resolve, reject) => {
    const socket = new NodeWebSocket(url.toString(), {
      headers: authorization ? { Authorization: authorization } : {},
    });
    const timer = setTimeout(() => reject(new Error("Bright Data did not answer in time.")), 20_000);
    socket.on("open", () => {
      clearTimeout(timer);
      resolve(socket as unknown as WebSocket);
    });
    socket.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(new Error(`Bright Data refused the connection: ${err.message}`));
    });
  });
}

/** Loads a page in the remote browser and returns its visible text. */
export async function fetchPageText(target: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<string> {
  const socket = await openSocket();

  let nextId = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();

  socket.onmessage = (event: MessageEvent) => {
    let msg: CdpMessage;
    try {
      msg = JSON.parse(String(event.data)) as CdpMessage;
    } catch {
      return;
    }
    if (typeof msg.id !== "number") return;
    const waiter = pending.get(msg.id);
    if (!waiter) return;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error.message ?? "Browser command failed"));
    else waiter.resolve(msg.result ?? {});
  };

  const send = (method: string, params: Record<string, unknown> = {}, sessionId?: string) =>
    new Promise<any>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const deadline = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("The page took too long to load.")), timeoutMs),
  );

  try {
    return await Promise.race([
      (async () => {
        const { targetId } = await send("Target.createTarget", { url: "about:blank" });
        const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
        await send("Page.enable", {}, sessionId);
        await send("Page.navigate", { url: target }, sessionId);
        // Give client-rendered pages a moment to paint before reading the text.
        await new Promise((r) => setTimeout(r, 3_000));
        const evaluated = await send(
          "Runtime.evaluate",
          {
            expression: "document.body ? document.body.innerText : ''",
            returnByValue: true,
          },
          sessionId,
        );
        await send("Target.closeTarget", { targetId }).catch(() => {});
        const text: string = evaluated?.result?.value ?? "";
        return text.replace(/\s+/g, " ").trim().slice(0, 8_000);
      })(),
      deadline,
    ]);
  } finally {
    try {
      socket.close();
    } catch {
      /* already closed */
    }
  }
}

/** Pulls a short, human-readable summary out of a company's own website. */
export function summarisePage(text: string) {
  const clean = text.replace(/\s+/g, " ").trim();
  return {
    excerpt: clean.slice(0, 600),
    wordCount: clean ? clean.split(" ").length : 0,
  };
}

/** One search-result page that was actually loaded, with the visible text we read off it. */
export type ScrapedSource = { label: string; url: string; text: string };

/** The open-web surfaces a counterparty search reads, in priority order: general web first, then
 * marketplaces/supplier directories, then trade registries and news. AI reads the first few, AI+
 * reads them all. */
export const SEARCH_SURFACES: { label: string; url: (q: string) => string }[] = [
  { label: "Web", url: (q) => `https://www.bing.com/search?q=${q}` },
  {
    label: "Marketplaces",
    url: (q) => `https://www.bing.com/search?q=${q}+(marketplace+OR+B2B+OR+listing)`,
  },
  {
    label: "Supplier directories",
    url: (q) => `https://www.bing.com/search?q=${q}+(supplier+OR+exporter+OR+distributor+OR+directory)`,
  },
  {
    label: "Trade registries",
    url: (q) => `https://www.bing.com/search?q=${q}+(company+registry+OR+trade+register+OR+chamber+of+commerce)`,
  },
  {
    label: "Buyers & tenders",
    url: (q) => `https://www.bing.com/search?q=${q}+(buyer+OR+importer+OR+tender+OR+RFQ)`,
  },
  { label: "News", url: (q) => `https://www.bing.com/news/search?q=${q}` },
];

/** Scrapes the first `limit` search surfaces for one query through Bright Data's remote browser.
 * Individual surfaces are allowed to fail (blocked, slow, empty) — the caller gets whatever came
 * back plus the failures, so the UI can be honest about which sources were read. */
export async function fetchSearchResults(
  query: string,
  limit = 3,
  timeoutMs = 25_000,
): Promise<{ sources: ScrapedSource[]; failures: { label: string; url: string; reason: string }[] }> {
  const q = encodeURIComponent(query);
  const surfaces = SEARCH_SURFACES.slice(0, Math.max(1, Math.min(limit, SEARCH_SURFACES.length)));

  const sources: ScrapedSource[] = [];
  const failures: { label: string; url: string; reason: string }[] = [];

  // Bounded concurrency: two pages at a time keeps the remote browser (and our runtime) happy.
  const queue = [...surfaces];
  const worker = async () => {
    for (;;) {
      const surface = queue.shift();
      if (!surface) return;
      const url = surface.url(q);
      try {
        const text = (await fetchPageText(url, timeoutMs)).replace(/\s+/g, " ").trim();
        if (text) sources.push({ label: surface.label, url, text: text.slice(0, 6000) });
        else failures.push({ label: surface.label, url, reason: "No readable text on the page." });
      } catch (err) {
        failures.push({ label: surface.label, url, reason: (err as Error).message });
      }
    }
  };
  await Promise.all([worker(), worker()]);

  return { sources, failures };
}
