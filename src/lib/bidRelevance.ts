import { supabase } from "@/integrations/supabase/client";
import { type Relatable } from "@/lib/relevance";
import { bidTermTokens } from "@/lib/bidTerms";

export type BidRelevance = { ownName: string; searchedFor: string; bidTokens: string[] };

/** What a bid was searched for, and who is bidding — so a list of counterparties can leave out
 * anything unrelated to the bid and the bidder's own organisation. */
export async function loadBidRelevance(txId: string): Promise<BidRelevance> {
  const { data: bid } = await supabase
    .from("transactions")
    .select("org_id, commodity, title, search_prompt, quantity, price, incoterms, document_summary")
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
  const b = bid as {
    quantity?: number | null;
    price?: number | null;
    incoterms?: string | null;
    document_summary?: string | null;
    search_prompt?: string | null;
  } | null;
  // The requester's own terms — never to be shown as facts about a counterparty.
  const bidTokens = bidTermTokens([b?.quantity, b?.price, b?.incoterms, b?.search_prompt, b?.document_summary]);
  return { ownName: (ownOrg?.name ?? "").trim().toLowerCase(), searchedFor, bidTokens };
}

/** For organisations already saved against a bid, the search has done the judging: it read their
 * own pages, tested which side of the trade they act on, scored them, and recorded every drop in
 * the "Considered and not kept" list. Re-judging them here on a few short words hid genuine
 * matches whose stored sector and note happened not to repeat the bid's wording, so the only rule
 * left is the bidder's own organisation, which never belongs in its own results. */
export function keepForBid(ctx: BidRelevance, c: Relatable): boolean {
  return !(ctx.ownName && c.name.trim().toLowerCase() === ctx.ownName);
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
    .eq("transaction_id", txId)
    .order("score", { ascending: false, nullsFirst: false });
  if (error) throw error;
  const relevance = await loadBidRelevance(txId);
  return ((data ?? []) as unknown as StoredCounterparty[]).filter((c) => keepForBid(relevance, c));
}
