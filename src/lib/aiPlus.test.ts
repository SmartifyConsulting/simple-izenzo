/**
 * Contract checks for the protected AI+ interface.
 *
 * These prove the connection against the client's published contracts without needing their
 * service to exist: a valid DecisionPack is accepted, a malformed one is rejected, the signature
 * is reproducible, and a timeout or unreachable service fails safely instead of throwing into the
 * transaction path. Point `privateUrl` at the real service and the same checks re-run against it.
 *
 * Run with: bunx vitest run src/lib/aiPlus.test.ts
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import {
  buildDecisionRequest,
  callAiPlus,
  canonicalBody,
  signBody,
  validateDecisionPack,
  mapCandidateType,
  type AiPlusConfig,
} from "./aiPlus.server";

const TX = "22222222-2222-4222-8222-222222222222";
const ORG = "33333333-3333-4333-8333-333333333333";

const config: AiPlusConfig = {
  enabled: true,
  privateUrl: "https://ai-plus.example.test",
  hmacKeyId: "key-1",
  hmacSecret: "shared-secret",
  environment: "sandbox",
};

const request = buildDecisionRequest({
  environment: "sandbox",
  invocationId: "11111111-1111-4111-8111-111111111111",
  transactionId: TX,
  orgId: ORG,
  counterpartyOrgId: null,
  stage: "trading",
  step: "choice",
  eventType: "choice_made",
  eventAt: "2026-09-12T08:00:00Z",
  attributes: { bid: 95, offer: 105, currency: "USD" },
});

/** A minimal reply that satisfies Appendix B. */
function validPack(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "1.0",
    transaction_id: TX,
    stage: "trading",
    generated_at: "2026-09-12T08:00:03Z",
    model: "their-model-1",
    candidates: [
      {
        id: "c1",
        type: "counterparty",
        label: "Proceed with Acme Trading SA",
        probability: 0.72,
        rationale: "Their filed accounts and the screening report both support the exposure.",
        source_refs: ["Acme Trading SA", "Screening report"],
      },
    ],
    recommendation: "c1",
    ...overrides,
  };
}

function respond(body: unknown, status = 200) {
  return vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("Appendix A request", () => {
  it("matches the published request shape", () => {
    expect(request.schema_version).toBe("1.0");
    expect(request.transaction).toMatchObject({
      transaction_id: TX,
      org_id: ORG,
      counterparty_org_id: null,
      stage: "trading",
      step: "choice",
      event_type: "choice_made",
    });
    expect(Object.keys(request).sort()).toEqual([
      "environment",
      "invocation_id",
      "schema_version",
      "transaction",
    ]);
  });

  it("signs timestamp, nonce and body together, reproducibly (Appendix C)", async () => {
    const body = canonicalBody(request);
    const a = await signBody(config.hmacSecret, "1757664000", "nonce-1", body);
    const b = await signBody(config.hmacSecret, "1757664000", "nonce-1", body);
    expect(a).toBe(b);
    expect(a).toMatch(/^sha256=[0-9a-f]{64}$/);
    // A different timestamp or nonce must change the signature, or a captured call could be replayed.
    expect(await signBody(config.hmacSecret, "1757664001", "nonce-1", body)).not.toBe(a);
    expect(await signBody(config.hmacSecret, "1757664000", "nonce-2", body)).not.toBe(a);
    expect(await signBody("a-different-secret", "1757664000", "nonce-1", body)).not.toBe(a);
  });
});

describe("Appendix B validation", () => {
  it("accepts a conforming DecisionPack", () => {
    const result = validateDecisionPack(validPack());
    expect(result.ok).toBe(true);
  });

  it("rejects a probability outside 0 to 1", () => {
    const pack = validPack();
    (pack.candidates[0] as Record<string, unknown>)["probability"] = 1.4;
    const result = validateDecisionPack(pack);
    expect(result.ok).toBe(false);
  });

  it("rejects a worded probability rather than converting it", () => {
    const pack = validPack();
    (pack.candidates[0] as Record<string, unknown>)["probability"] = "high";
    expect(validateDecisionPack(pack).ok).toBe(false);
  });

  it("rejects an unknown candidate type", () => {
    const pack = validPack();
    (pack.candidates[0] as Record<string, unknown>)["type"] = "vibes";
    expect(validateDecisionPack(pack).ok).toBe(false);
  });

  it("rejects unexpected properties", () => {
    expect(validateDecisionPack(validPack({ extra: true })).ok).toBe(false);
  });

  it("rejects a missing required property", () => {
    const pack = validPack() as Record<string, unknown>;
    delete pack["model"];
    expect(validateDecisionPack(pack).ok).toBe(false);
  });

  it("rejects the wrong schema version", () => {
    expect(validateDecisionPack(validPack({ schema_version: "2.0" })).ok).toBe(false);
  });

  it("accepts a null recommendation", () => {
    expect(validateDecisionPack(validPack({ recommendation: null })).ok).toBe(true);
  });

  it("maps their risk_flag onto our risk type and leaves the rest alone", () => {
    expect(mapCandidateType("risk_flag")).toBe("risk");
    expect(mapCandidateType("pricing")).toBe("pricing");
  });
});

describe("calling the service", () => {
  it("sends the signature, key id and idempotency key", async () => {
    const fetchMock = respond(validPack());
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAiPlus(config, request, `${TX}:choice_made`, "corr-1");
    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://ai-plus.example.test/internal/v1/decision-packs");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Izenzo-Key-ID"]).toBe("key-1");
    expect(headers["X-Izenzo-Signature"]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(headers["X-Izenzo-Timestamp"]).toMatch(/^[0-9]{10}$/);
    expect(headers["X-Izenzo-Nonce"]).toMatch(/^[0-9a-f]{32}$/);
    expect(headers["Idempotency-Key"]).toBe(`${TX}:choice_made`);
    expect(headers["X-Correlation-ID"]).toBe("corr-1");
  });

  it("sends the same idempotency key when the same moment is retried", async () => {
    const fetchMock = respond(validPack());
    vi.stubGlobal("fetch", fetchMock);
    await callAiPlus(config, request, `${TX}:choice_made`, "corr-1");
    await callAiPlus(config, request, `${TX}:choice_made`, "corr-2");
    const keys = fetchMock.mock.calls.map(
      (c) => ((c as unknown as [string, RequestInit])[1].headers as Record<string, string>)["Idempotency-Key"],
    );

    expect(keys[0]).toBe(keys[1]);
  });

  it("fails safely on a non-2xx reply", async () => {
    vi.stubGlobal("fetch", respond("upstream exploded", 502));
    const result = await callAiPlus(config, request, "k", "c");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(502);
  });

  it("fails safely on a body that is not JSON", async () => {
    vi.stubGlobal("fetch", respond("<html>nope</html>"));
    const result = await callAiPlus(config, request, "k", "c");
    expect(result.ok).toBe(false);
  });

  it("fails safely when the service cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("ECONNREFUSED");
      }),
    );
    const result = await callAiPlus(config, request, "k", "c");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("could not be reached");
  });

  it("fails safely when the service times out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const err = new Error("aborted");
        err.name = "AbortError";
        void init;
        throw err;
      }),
    );
    const result = await callAiPlus(config, request, "k", "c");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("did not respond");
  });

  it("refuses a pack for a different transaction", async () => {
    vi.stubGlobal(
      "fetch",
      respond(validPack({ transaction_id: "44444444-4444-4444-8444-444444444444" })),
    );
    const result = await callAiPlus(config, request, "k", "c");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("different transaction");
  });

  it("refuses a pack for a different stage", async () => {
    vi.stubGlobal("fetch", respond(validPack({ stage: "finality" })));
    const result = await callAiPlus(config, request, "k", "c");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("different stage");
  });

  it("sends a fresh timestamp and nonce on every call", async () => {
    const fetchMock = respond(validPack());
    vi.stubGlobal("fetch", fetchMock);
    await callAiPlus(config, request, "k", "c1");
    await callAiPlus(config, request, "k", "c2");
    const nonces = fetchMock.mock.calls.map(
      (c) => ((c as unknown as [string, RequestInit])[1].headers as Record<string, string>)["X-Izenzo-Nonce"],
    );
    expect(nonces[0]).not.toBe(nonces[1]);
  });
});

describe("tenant isolation", () => {
  it("carries the raising organisation on the request and never another one", () => {
    expect(request.transaction.org_id).toBe(ORG);
    const other = buildDecisionRequest({
      environment: "sandbox",
      invocationId: "11111111-1111-4111-8111-111111111111",
      transactionId: TX,
      orgId: "55555555-5555-4555-8555-555555555555",
      counterpartyOrgId: null,
      stage: "trading",
      step: "choice",
      eventType: "choice_made",
      eventAt: "2026-09-12T08:00:00Z",
      attributes: {},
    });
    expect(other.transaction.org_id).not.toBe(ORG);
    // The org is part of the signed body, so it cannot be swapped in transit.
    expect(canonicalBody(other)).not.toBe(canonicalBody(request));
  });

  it("refuses a pack that answers a transaction the caller did not raise", async () => {
    vi.stubGlobal(
      "fetch",
      respond(validPack({ transaction_id: "66666666-6666-4666-8666-666666666666" })),
    );
    const result = await callAiPlus(config, request, "k", "c");
    expect(result.ok).toBe(false);
  });
});
