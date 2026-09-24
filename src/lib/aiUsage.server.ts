/** Server-only. Records what each external AI/integration call actually costs on the admin's own
 * provider account — OpenAI, Tavily, Didit, Resend — into ai_usage_events, so Admin → Integrations
 * → Token Ledger can show real spend, not just the platform's own internal token economy
 * (credit_ledger). Every call is best-effort: logging a cost must never fail the real request that
 * earned it.
 *
 * Prices below are approximate, admin-configurable-in-code rates (USD), not a live read of each
 * provider's own pricing page — good enough for a cost *estimate*, not an exact invoice match. */

/** What every call site needs to pass to attribute its cost to a transaction/org — shared so each
 * call site's own `usage?:` param type doesn't have to repeat (and risk drifting from) the exact
 * optionality this project's `exactOptionalPropertyTypes` requires. */
export type AiUsageContext = {
  operation: string;
  transactionId?: string | null | undefined;
  orgId?: string | null | undefined;
};

type ChatPricing = { inputPer1M: number; outputPer1M: number };

const OPENAI_CHAT_PRICING: Record<string, ChatPricing> = {
  "gpt-5": { inputPer1M: 5, outputPer1M: 15 },
  "gpt-5-mini": { inputPer1M: 0.6, outputPer1M: 2.4 },
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
};
const DEFAULT_CHAT_PRICING: ChatPricing = { inputPer1M: 2.5, outputPer1M: 10 };

/** OpenAI's hosted web-search tool bills a flat fee per call, on top of ordinary token cost. */
const OPENAI_WEB_SEARCH_PER_CALL_USD = 0.025;
/** Tavily bills per search credit, not per token. */
const TAVILY_PER_SEARCH_USD = 0.008;
/** Didit's per-verification-session price varies by plan; this is a placeholder — set the real
 * contracted rate here once known. */
const DIDIT_PER_SESSION_USD = 0.5;
/** Resend's marginal cost per email is negligible on most plans; kept for completeness of the
 * "what did every provider cost" picture rather than because it moves the total. */
const RESEND_PER_EMAIL_USD = 0.0004;

export function estimateChatCostUsd(model: string | null, inputTokens: number | null, outputTokens: number | null): number | null {
  if (inputTokens == null && outputTokens == null) return null;
  const pricing = (model && OPENAI_CHAT_PRICING[model]) || DEFAULT_CHAT_PRICING;
  const inCost = ((inputTokens ?? 0) / 1_000_000) * pricing.inputPer1M;
  const outCost = ((outputTokens ?? 0) / 1_000_000) * pricing.outputPer1M;
  return Math.round((inCost + outCost) * 100000) / 100000;
}

export type LogAiUsageArgs = {
  provider: "openai" | "tavily" | "didit" | "resend" | "firecrawl";
  operation: string;
  transactionId?: string | null | undefined;
  orgId?: string | null | undefined;
  model?: string | null | undefined;
  inputTokens?: number | null | undefined;
  outputTokens?: number | null | undefined;
  totalTokens?: number | null | undefined;
  /** Pass a precomputed cost when the caller already knows it (a flat per-call/per-session price);
   * omit for token-based OpenAI chat calls, whose cost is estimated here from the token counts. */
  costUsd?: number | null | undefined;
};

/** Best-effort — a logging failure must never surface to the caller or block the real request. */
export async function logAiUsage(args: LogAiUsageArgs): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const costUsd =
      args.costUsd ?? (args.provider === "openai" ? estimateChatCostUsd(args.model ?? null, args.inputTokens ?? null, args.outputTokens ?? null) : null);
    await supabaseAdmin.from("ai_usage_events").insert({
      transaction_id: args.transactionId ?? null,
      org_id: args.orgId ?? null,
      provider: args.provider,
      operation: args.operation,
      model: args.model ?? null,
      input_tokens: args.inputTokens ?? null,
      output_tokens: args.outputTokens ?? null,
      total_tokens: args.totalTokens ?? null,
      cost_usd: costUsd,
    } as never);
  } catch {
    // Never worth failing the real AI call over.
  }
}

export function openAiWebSearchCostUsd(): number {
  return OPENAI_WEB_SEARCH_PER_CALL_USD;
}
export function tavilySearchCostUsd(): number {
  return TAVILY_PER_SEARCH_USD;
}
export function diditSessionCostUsd(): number {
  return DIDIT_PER_SESSION_USD;
}
export function resendEmailCostUsd(): number {
  return RESEND_PER_EMAIL_USD;
}
