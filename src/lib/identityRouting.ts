/** VerifyNow / Didit identity-verification routing, by document-issuing country.
 * Per the routing spec: never silently resolve an unsupported combination to a pass — every
 * unmatched or ambiguous case routes to manual review. */

export type IdentityRoute = {
  provider: "VerifyNow" | "Didit" | "Manual review";
  note: string;
};

const VERIFYNOW_LIVE = new Set(["South Africa", "Nigeria"]);
const DIDIT_ROUTED = new Set(["Kenya", "Uganda", "Zambia", "Côte d'Ivoire", "Cote d'Ivoire"]);

export function routeIdentityVerification(country: string | null | undefined): IdentityRoute {
  const c = (country ?? "").trim();
  if (!c) {
    return { provider: "Manual review", note: "No jurisdiction set on this transaction." };
  }
  if (VERIFYNOW_LIVE.has(c)) {
    return { provider: "VerifyNow", note: `Live, primary provider for ${c}.` };
  }
  if (DIDIT_ROUTED.has(c)) {
    return {
      provider: "Didit",
      note: `VerifyNow is a disabled placeholder for ${c} until its API support and field mappings are confirmed.`,
    };
  }
  return {
    provider: "Manual review",
    note: `${c} is not yet supported by VerifyNow or Didit — manual review is the permanent route until a provider is approved.`,
  };
}
