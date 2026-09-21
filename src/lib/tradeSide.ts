/** A plain wording check for when the AI cannot be reached. */
export function guessSideFromWording(text: string): "bid" | "offer" | null {
  const t = text.toLowerCase();
  const buying = /\b(looking for|need|needs|seeking|require|requires|want to buy|procure|procurement|rfp|rfq|tender|source|find (a )?(supplier|vendor|provider)|suppliers?|vendors?)\b/.test(t);
  const selling = /\b(for sale|we sell|i sell|want to sell|selling|we supply|we offer|offering|we export|looking for buyers?|find (a )?buyers?|buyers?|off-?takers?)\b/.test(t);
  if (selling && !buying) return "offer";
  if (buying && !selling) return "bid";
  if (/\bbuyers?\b|off-?takers?/.test(t) && /\blooking for|find|seeking/.test(t)) return "offer";
  return null;
}
