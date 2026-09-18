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
