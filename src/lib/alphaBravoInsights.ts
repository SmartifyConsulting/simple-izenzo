/** Shared article data for the Alpha-Bravo "Insights" (blog) section — used by both the listing
 * page and the per-article detail page, so the two never drift out of sync. */
export type InsightArticle = {
  slug: string;
  date: string;
  title: string;
  teaser: string;
  body: string[];
};

export const INSIGHT_ARTICLES: InsightArticle[] = [
  {
    slug: "compliance-gate-cant-be-a-checkbox",
    date: "September 2026",
    title: "Why the Compliance Gate Can't Be a Checkbox",
    teaser:
      "A non-waivable gate only means something if it's actually non-waivable. What that looks like in practice, and why most platforms fake it.",
    body: [
      "Every marketplace that touches real money says some version of \"we verify our users.\" Almost none of them mean it in a way that would survive a regulator asking hard questions.",
      "Here's the test we apply: can a deal desk, a Bidder under pressure to close, or an admin trying to unblock a stuck match skip the check? On most platforms, the honest answer is yes — there's a support ticket, an override button, a \"trusted partner\" exception. The moment an exception path exists, the gate isn't a gate. It's a suggestion.",
      "On Izenzo, the Compliance Gate sits structurally between Trading and Execution. A transaction cannot move from Proof of Intent into the Execution Gate without a completed WaD case — identity, ownership, sanctions and PEP screening, cleared. There is no admin override that skips this. There's no \"flag it and continue.\" The state machine itself won't advance the record.",
      "That sounds inconvenient, and it is, by design. The inconvenience is the point: it's the same friction a bank's own compliance desk would apply, just earlier in the process and impossible to route around informally.",
      "What this buys a Bidder or a Responder isn't just \"we did KYC.\" It's a timestamped, hash-sealed record that the check happened, in what order, and what it found — independently verifiable by anyone with the record, not just trusted because a support agent says so.",
      "Most platforms can't offer that, because most platforms built compliance as a workflow, not as a constraint on the workflow itself. We built it as the latter, and it shows up in the one place that matters: what happens when someone tries to skip it.",
    ],
  },
  {
    slug: "matching-is-a-trust-problem",
    date: "August 2026",
    title: "Matching Is a Trust Problem Before It's a Trading Problem",
    teaser:
      "Speed doesn't fix a bad match. Notes on why we verify before we introduce, not after.",
    body: [
      "Most matching platforms optimise for one thing: get two parties talking as fast as possible. Fewer clicks to an introduction reads as a win on every dashboard that measures engagement. It's also, in our experience, the wrong thing to optimise first.",
      "A fast introduction between a Bidder and a Responder who can't actually deliver — because the counterparty can't be verified, because the deal size doesn't clear a sanity check, because the jurisdiction carries risk nobody's screened for — isn't a fast match. It's a fast way to waste both parties' time, or worse, to expose one of them to a counterparty they'd never have engaged with knowingly.",
      "Izenzo's Trading Gate runs search, AI-assisted counterparty analysis, and online media screening before a Bidder ever chooses who to engage. The choice a person makes is real and recorded, but it's made with a shortlist that's already been through a filter most platforms only apply after the fact — if they apply it at all.",
      "This is why Trading and Compliance sit as separate, sequential gates rather than one blended \"onboarding\" step. Trading answers \"is this the right counterparty to talk to.\" Compliance answers \"can we prove who they are and that they're not a sanctioned or high-risk party.\" Conflating the two either slows down good matches with unnecessary checks, or lets bad matches through because the checks got skipped in the rush to introduce.",
      "Trust, done properly, is slower than a cold introduction. It's also the only version of \"fast\" that survives contact with a counterparty who turns out to be a problem three weeks later.",
    ],
  },
  {
    slug: "what-a-hash-sealed-record-buys-you",
    date: "July 2026",
    title: "What a Hash-Sealed Record Actually Buys You",
    teaser:
      "Tamper-evident isn't a buzzword — it's a specific set of guarantees. Here's what they are and what they aren't.",
    body: [
      "\"Hash-sealed\" gets thrown around a lot, usually as a way of saying \"trust us\" in more technical-sounding language. It's worth being precise about what it actually guarantees, because the precision is the entire value.",
      "A SHA-256 hash of a record's state, taken at a critical transition — Proof of Intent sealed, WaD case cleared, Finality recorded — gives you exactly one guarantee: if the underlying data changes after that point, the hash won't match anymore. Anyone holding the original hash can detect the tamper. That's it. It doesn't prove the data was true when it was sealed, and it doesn't stop someone from lying at the point of entry.",
      "What it does do is remove an entire class of dispute: the one where a record gets quietly edited after the fact and nobody can prove it. \"The terms changed after we agreed\" or \"the compliance check result was different at the time\" become falsifiable claims instead of he-said-she-said. Either the hash matches the record you're looking at, or it doesn't.",
      "On Izenzo, this happens at defined points across the five gates — not as a blanket \"everything is blockchain\" claim, but as specific, verifiable seals on the transitions that actually matter to a dispute: the bid terms, the Proof of Intent, the WaD clearance, the Finality record.",
      "The honest version of this pitch is narrower than the marketing version usually is. That's deliberate. A guarantee you can state precisely is one you can actually stand behind when someone asks you to prove it.",
    ],
  },
  {
    slug: "anatomy-of-a-match-that-falls-apart-at-finality",
    date: "June 2026",
    title: "Anatomy of a Match That Falls Apart at Finality",
    teaser:
      "Most failed matches don't fail at introduction — they fail at settlement. A look at where the real risk hides.",
    body: [
      "Ask most operators where deals fall apart and they'll point at sourcing: bad matches, wasted introductions, counterparties who ghost. That's real, but it's not where the money is lost. The expensive failures happen at Finality — after both sides have already invested weeks of work, after Execution is substantially complete, when a change or value event surfaces that nobody structured for.",
      "A shipment arrives short. A contract needs a novation because one party's ownership structure changed mid-execution. A milestone payment is disputed because the acceptance criteria were never pinned down precisely enough. None of these are matching problems. They're finality problems — and they happen because the earlier gates didn't force the kind of specificity that prevents them.",
      "This is why Izenzo's Finality Gate isn't just \"mark as complete.\" It runs through Finality Type (completion, termination, novation, or lapse — chosen deliberately, not defaulted), Finality Evidence, a distinct Change or Value Event step, and Validation & Acceptance before the record seals. Each of those steps exists because we've seen the failure mode it prevents.",
      "The uncomfortable truth is that most of what makes Finality hard was decided — or not decided — back in Execution Entry and Project Preparation. A vague bankability assessment or an under-specified implementation plan doesn't cause a problem immediately. It causes one three months later, when the parties disagree about what \"done\" meant.",
      "Building a governed flow means treating Finality as a gate that can catch what Execution missed, not as a formality that rubber-stamps whatever happened. That's the only version of it worth building.",
    ],
  },
  {
    slug: "cost-of-re-verifying-the-same-counterparty-twice",
    date: "May 2026",
    title: "The Cost of Re-verifying the Same Counterparty Twice",
    teaser:
      "Every re-verification is friction someone pays for. Why a shared, portable verification record changes the economics.",
    body: [
      "A Responder who's cleared WaD once — identity, ownership, sanctions and PEP screening, all verified — should not have to pay for that verification again every time a new Bidder wants to transact with them. And yet on most platforms, and in most offline trade relationships, that's exactly what happens: verification is scoped to a single relationship, not to the counterparty.",
      "The cost of this isn't abstract. WaD verification costs real tokens and real time. Multiply that by every new counterparty relationship a Responder enters, and a Responder doing business with ten different Bidders over a year has effectively paid for the same background check ten times, with ten different parties each bearing a slice of duplicate cost and duplicate delay.",
      "Izenzo's counterparty rating — trusted, neutral, or flagged, with a computed score and a rationale — is a step toward changing that economics. A counterparty's verification status and rating are visible across the matches they're surfaced in, not locked to a single transaction's private record. A Responder who's built a track record of clean, verified matches carries that record with them into the next opportunity, rather than starting from zero.",
      "This isn't the same as saying verification is a one-time event forever — ratings decay, sanctions lists update, ownership structures change, and re-screening on a cadence is still necessary. But the difference between re-screening on a schedule and re-screening from scratch for every new relationship is the difference between a system that compounds trust and one that taxes it every single time.",
      "A marketplace that makes every participant re-earn their verification with every new counterparty isn't protecting anyone — it's just moving the same cost around and calling it diligence.",
    ],
  },
  {
    slug: "why-memory-is-a-stage-not-a-log",
    date: "April 2026",
    title: "Why We Built Memory as a Stage, Not a Log",
    teaser:
      "A completed match that teaches you nothing is a wasted match. How the Memory stage turns outcomes into reusable intelligence.",
    body: [
      "Most platforms treat a completed transaction as an archival event: the deal's done, so write it to a table somewhere and move on. That's a log. It's useful for audits and largely useless for anything else — nobody's mining a log for insight, because a log wasn't designed to be read forward.",
      "Izenzo treats the record differently. Memory is the fifth gate, not an afterthought bolted onto the end of Finality — and the distinction matters. A gate implies the record is read, not just stored: read forward and backward, as the spine's own description puts it. What happened in Trading informs how Compliance is scoped for the next similar match. What surfaced in Execution informs how the next Bidder's brief gets screened before it's even posted.",
      "Concretely, this shows up in things like counterparty ratings that persist and compound (see our piece on re-verification cost), in AI-assisted matching that gets better because it has real outcomes to learn from rather than synthetic training data, and in a Responder's public profile that reflects an actual history of cleared matches rather than a self-reported claim.",
      "The alternative — memory as a log — optimises for compliance and nothing else: can we prove what happened if someone asks. Memory as a stage optimises for that and for making the next match faster, better-screened, and less likely to repeat a mistake the platform has already seen once.",
      "A governed flow that ends at Finality is complete but static. Ours doesn't end there, because the whole point of running enough matches through the same governed pipeline is that the pipeline should get smarter about the next one.",
    ],
  },
];

export function findInsightArticle(slug: string) {
  return INSIGHT_ARTICLES.find((a) => a.slug === slug);
}
