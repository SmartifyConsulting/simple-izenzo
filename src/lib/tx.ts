import { supabase } from "@/integrations/supabase/client";
import type { StageKey } from "@/lib/spine";

export type Transaction = {
  id: string;
  org_id: string;
  counterparty_org_id: string | null;
  title: string;
  commodity: string | null;
  quantity: number | null;
  unit: string | null;
  price: number | null;
  currency: string;
  incoterms: string | null;
  jurisdiction: string | null;
  stage: StageKey;
  step: string;
  status: string;
  intent_confirmed_at: string | null;
  poi_sealed_at: string | null;
  poi_hash: string | null;
  wad_completed_at: string | null;
  /** Set when the bidder clicks Continue on the cleared Without a Doubt gate. Legal Agreements only
   * starts pulsing on the strength of this. Null for rows that pre-date the column. */
  wad_continued_at?: string | null;
  /** AI interpretation of the legal agreements, shown on Execution > Concept. */
  concept_brief?: string | null;
  concept_brief_generated_at?: string | null;
  concept_brief_error?: string | null;
  finality_sealed_at: string | null;
  created_at: string;
  updated_at: string;
  /** BID.../OFF... shown wherever this deal is listed — generated once when the bid/offer was
   * first recorded. Null for rows created before this column existed. */
  reference?: string | null;
};

export type TxEvent = {
  id: string;
  transaction_id: string;
  actor_id: string;
  actor_name: string | null;
  stage: string;
  step: string;
  action: string;
  summary: string | null;
  payload: Record<string, unknown>;
  fingerprint: string | null;
  created_at: string;
};

export async function recordEvent(input: {
  transactionId: string;
  stage: StageKey;
  step: string;
  action: string;
  summary?: string;
  payload?: Record<string, unknown>;
  actorName?: string | null;
}) {
  const { data: userData } = await supabase.auth.getUser();
  const fingerprint = await fingerprintOf({
    tx: input.transactionId,
    action: input.action,
    payload: input.payload ?? {},
    at: new Date().toISOString(),
  });
  const { error } = await supabase.from("transaction_events").insert({
    transaction_id: input.transactionId,
    actor_id: userData.user?.id as string,
    actor_name: input.actorName ?? userData.user?.email ?? null,
    stage: input.stage,
    step: input.step,
    action: input.action,
    summary: input.summary ?? null,
    payload: (input.payload ?? {}) as never,
    fingerprint,
  });
  if (error) throw error;
  return fingerprint;
}

export async function fingerprintOf(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function advance(transactionId: string, stage: StageKey, step: string) {
  await supabase.from("transactions").update({ stage, step }).eq("id", transactionId);
}

/** Deterministic BID.../OFF... fallback for transactions recorded before the `reference` column
 * existed — same shape as the ones generated at creation time, just derived from the row's own id
 * so it's stable across reloads instead of random. */
export function fallbackReference(id: string, direction: "bid" | "offer") {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const base = direction === "bid" ? 9088778 : 8979667;
  const suffix = base + (hash % 1000);
  return `${direction === "bid" ? "BID" : "OFFER"}${suffix}`;
}

/** Swaps a reference's BID/OFF prefix while keeping its numeric suffix, so correcting a deal's
 * direction after the fact (once an uploaded document reveals it) doesn't hand the user a
 * completely different-looking ID than the one they've already seen on screen. */
export function swapReferencePrefix(reference: string, kind: TradeKind) {
  const digits = reference.replace(/^[A-Za-z]+/, "");
  return `${kind === "bid" ? "BID" : kind === "offer" ? "OFFER" : "ID"}${digits}`;
}

/** What a workspace currently is: a plain Workspace until the search has been categorised, then a
 * Bid (looking for a seller) or an Offer (looking for a buyer). The number's prefix carries it —
 * ID…, BID… or OFFER…. */
export type TradeKind = "workspace" | "bid" | "offer";

export function tradeKindOf(reference: string | null | undefined): TradeKind {
  const r = (reference ?? "").trim().toUpperCase();
  if (r.startsWith("OFF")) return "offer";
  if (r.startsWith("BID")) return "bid";
  return "workspace";
}

export function money(value: number | null | undefined, currency = "USD") {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  }).format(value);
}

export function shortHash(hash: string | null | undefined) {
  if (!hash) return "—";
  return `${hash.slice(0, 12)}…${hash.slice(-8)}`;
}

export function when(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function whenDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
