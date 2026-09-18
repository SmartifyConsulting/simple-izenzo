/** Server-only. Reads the OpenAI API key out of the encrypted integration store (Admin →
 * Integrations → OpenAI), falling back to the server secret OPENAI_API_KEY when that
 * integration is absent or switched off — so a fresh deployment with only the env var set
 * keeps working exactly as before. */
export async function loadOpenAiApiKey(): Promise<string | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { decryptSecrets } = await import("@/lib/integrationCrypto.server");

    const { data: row } = await supabaseAdmin
      .from("integration_credentials")
      .select("*")
      .eq("provider", "openai")
      .maybeSingle();
    if (row?.enabled) {
      const secrets = await decryptSecrets(row.secrets_encrypted as string | null);
      const apiKey = (secrets["api_key"] ?? "").trim();
      if (apiKey) return apiKey;
    }
  } catch {
    // A missing table, an unreadable credential, or no row at all — fall through to the
    // environment secret rather than failing the AI call outright.
  }
  return process.env["OPENAI_API_KEY"] || null;
}

/** OpenAI returns HTTP 429 for both a genuine short-lived rate limit and a real "no credits left
 * on this account" state — the only way to tell them apart is the JSON body's error code. Getting
 * this wrong means every quota outage reads as "try again shortly" forever. */
export function isOpenAiQuotaExceeded(bodyText: string): boolean {
  try {
    const body = JSON.parse(bodyText) as { error?: { code?: string; type?: string } };
    const code = body.error?.code ?? body.error?.type;
    return code === "insufficient_quota" || code === "billing_hard_limit_reached";
  } catch {
    return /insufficient_quota|billing_hard_limit_reached/i.test(bodyText);
  }
}
