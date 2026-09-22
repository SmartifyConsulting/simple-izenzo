/** Server-only. Tells support@izenzo.co.za when a connected third-party service (AI gateway,
 * Firecrawl, Resend) reports it's out of funds or credits, so it gets topped up before it starts
 * blocking real users — rather than that only ever surfacing as a support ticket. Throttled per
 * service so a burst of failing requests sends one email, not one per request. */
export async function alertLowFunds(service: string, statusCode: number, detail?: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Only one alert per service per hour — the ops_alerts row is the throttle, not a log.
    // Cast through `never`/`any`: ops_alerts predates the last regenerated Supabase types.
    const { data: existing } = await (supabaseAdmin.from("ops_alerts" as never) as any)
      .select("last_sent_at")
      .eq("service", service)
      .maybeSingle();
    const lastSent = (existing as { last_sent_at?: string } | null)?.last_sent_at;
    if (lastSent && Date.now() - new Date(lastSent).getTime() < 60 * 60 * 1000) return;

    const { loadResendCreds, sendEmail, renderBrandedEmail } = await import("@/lib/resend.server");
    const creds = await loadResendCreds();
    await sendEmail(creds, {
      to: "support@izenzo.co.za",
      subject: `Low funds: ${service} returned ${statusCode}`,
      html: renderBrandedEmail(
        `<p><strong>${service}</strong> just returned a status ${statusCode}, which usually means the ` +
          `connected account is out of credits or funds.</p>` +
          `<p>Please top it up — until then, anything on Izenzo that depends on it will keep failing for ` +
          `users with a "not configured" or "exhausted" message.</p>` +
          (detail ? `<p style="color:#6b7280;font-size:12px;">${detail.slice(0, 500)}</p>` : ""),
      ),
    });

    await (supabaseAdmin.from("ops_alerts" as never) as any).upsert(
      { service, last_sent_at: new Date().toISOString() },
      { onConflict: "service" },
    );
  } catch {
    // An alerting failure must never take down the request that triggered it.
  }
}

/** Records a plain OpenAI rate limit (429 that isn't the exhausted-quota case above) so its
 * frequency is actually visible — before this existed, "AI is busy right now. Please try again
 * shortly." left no trace anywhere it happened. Query ai_rate_limit_log directly to see how often
 * a given model is getting throttled; never throws. */
export async function logAiRateLimit(service: string, model: string): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = supabaseAdmin.from("ai_rate_limit_log" as never) as any;
    const { data: existing } = await table
      .select("hit_count")
      .eq("service", service)
      .eq("model", model)
      .maybeSingle();
    if (existing) {
      await table
        .update({
          hit_count: (existing as { hit_count: number }).hit_count + 1,
          last_seen_at: new Date().toISOString(),
        })
        .eq("service", service)
        .eq("model", model);
    } else {
      await table.insert({ service, model });
    }
  } catch {
    // Logging must never take down the request that triggered it.
  }
}
