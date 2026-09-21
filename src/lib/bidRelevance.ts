import { supabase } from "@/integrations/supabase/client";
import { isRelevant, type Relatable } from "@/lib/relevance";

export type BidRelevance = { ownName: string; searchedFor: string };

/** What a bid was searched for, and who is bidding — so a list of counterparties can leave out
 * anything unrelated to the bid and the bidder's own organisation. */
export async function loadBidRelevance(txId: string): Promise<BidRelevance> {
  const { data: bid } = await supabase
    .from("transactions")
    .select("org_id, commodity, title, search_prompt")
    .eq("id", txId)
    .maybeSingle();
  const { data: ownOrg } = bid?.org_id
    ? await supabase.from("organisations").select("name").eq("id", bid.org_id).maybeSingle()
    : { data: null };
  const title = bid?.title && bid.title !== "New Bid" && bid.title !== "New Offer" ? bid.title : "";
  const searchedFor = (
    (bid as { search_prompt?: string | null } | null)?.search_prompt ||
    bid?.commodity ||
    title ||
    ""
  ).trim();
  return { ownName: (ownOrg?.name ?? "").trim().toLowerCase(), searchedFor };
}

/** With nothing to compare against, nothing is hidden. */
export function keepForBid(ctx: BidRelevance, c: Relatable): boolean {
  if (ctx.ownName && c.name.trim().toLowerCase() === ctx.ownName) return false;
  return !ctx.searchedFor || isRelevant(c, ctx.searchedFor);
}

type StoredCounterparty = {
  name: string;
  sector: string | null;
  jurisdiction: string | null;
  rationale: string | null;
  shortlisted?: boolean | null;
  score?: number | null;
};

/** The counterparties saved on a bid that actually belong on it — the same rule the lists apply, so
 * a count, a shortlist and the list itself can never disagree. */
export async function loadRelevantCounterparties(txId: string): Promise<StoredCounterparty[]> {
  const { data, error } = await supabase
    .from("counterparties")
    .select("name, sector, jurisdiction, rationale, shortlisted, score")
    .eq("transaction_id", txId);
  if (error) throw error;
  const relevance = await loadBidRelevance(txId);
  return ((data ?? []) as unknown as StoredCounterparty[]).filter((c) => keepForBid(relevance, c));
}
