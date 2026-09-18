/** Catalogue of third-party services Izenzo can connect to.
 * Field values marked `secret: true` are encrypted at rest and never leave the server
 * except when an administrator explicitly reveals them. */

export type IntegrationField = {
  key: string;
  label: string;
  secret: boolean;
  /** "switch" renders an on/off control and stores "true"/"false" in the provider config. */
  type?: "text" | "switch";
  placeholder?: string;
  help?: string;
};

export type IntegrationProvider = {
  id: string;
  name: string;
  group: string;
  summary: string;
  /** Where in the trading pipeline this provider is actually called — shown so an admin can tell
   * at a glance what breaks if it's left unconfigured. */
  usedAt: string;
  /** A short, non-binding note on how this provider charges (per-check, subscription, %-of-
   * transaction, etc.) so an admin can see at a glance what turning it on will cost — actual
   * rates depend on the account's own plan/negotiated terms and should be confirmed on the
   * provider's own pricing page before enabling in production. */
  costNote?: string;
  docsUrl?: string;
  /** The provider's own billing/credits page, so an administrator can top up without hunting. */
  topUpUrl?: string;
  /** The provider's console/dashboard, for services with no separate billing page. */
  consoleUrl?: string;
  environments?: string[];
  fields: IntegrationField[];
  /** Whether a live "Test connection" call is available for this provider. */
  testable: boolean;
  testNote?: string;
};

export const INTEGRATION_GROUPS = [
  "KYC & Identity",
  "Business Registry & Tax",
  "Payments",
  "Banking & Escrow",
  "Email & Notifications",
  "Sanctions & Fraud",
  "Currency",
  "Web Scraping",
  "Archival Storage",
  "Izenzo AI+",


] as const;


export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: "didit",
    topUpUrl: "https://business.didit.me/billing",
    consoleUrl: "https://business.didit.me",
    name: "Didit",
    group: "KYC & Identity",
    summary:
      "ID document + selfie, company (KYB) and sanctions/PEP checks. Used for self-verification and at the WaD compliance gate.",
    usedAt:
      "Trading Gate → Background screening (per-counterparty ID/KYB/AML checks) and Compliance Gate → Without a Doubt.",
    costNote: "Charged per verification/check run (ID, KYB, sanctions/PEP) — see Didit's pricing page for current rates on your plan.",
    docsUrl: "https://docs.didit.me",
    environments: ["sandbox", "production"],
    fields: [
      { key: "api_key", label: "API key", secret: true, help: "From the Didit console, Business settings → API keys." },
      {
        key: "webhook_secret",
        label: "Webhook secret",
        secret: true,
        help: "Paste the same value into Didit's webhook settings so results can be trusted.",
      },
      { key: "workflow_id_document", label: "Workflow ID — ID document + selfie", secret: false },
      { key: "workflow_kyb", label: "Workflow ID — company (KYB)", secret: false },
      { key: "workflow_aml", label: "Workflow ID — sanctions / PEP", secret: false },
      {
        key: "aml_enabled",
        label: "Run the separate sanctions / PEP (AML) check",
        secret: false,
        type: "switch",
        help: "Off by default — the KYB workflow already covers UBO and AML. Switch on to run a separate sanctions / PEP check as well.",
      },
      {
        key: "base_url",
        label: "API base URL",
        secret: false,
        placeholder: "https://verification.didit.me",
        help: "Leave blank to use Didit's default.",
      },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "cipc",
    consoleUrl: "https://eservices.cipc.co.za",
    name: "CIPC",
    group: "Business Registry & Tax",
    summary: "Company registration and director verification.",
    usedAt: "Trading Gate → Counterparties (registry lookup during background screening) and Compliance Gate → KYB.",
    costNote: "Charged per registry lookup, per CIPC's own published fee schedule.",
    fields: [
      { key: "customer_code", label: "Customer code", secret: false },
      { key: "username", label: "Username", secret: false },
      { key: "password", label: "Password", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: false,
    testNote: "CIPC issues per-account endpoints; the first live lookup confirms the credentials.",
  },
  {
    id: "sars_efiling",
    consoleUrl: "https://secure.sarsefiling.co.za",
    name: "SARS eFiling",
    group: "Business Registry & Tax",
    summary: "Tax Compliance Status checks. Usually requires a registered practitioner profile.",
    usedAt: "Compliance Gate → Without a Doubt (KYB tax-status check).",
    costNote: "No per-check fee from SARS itself, but access typically requires a paid registered tax practitioner profile.",
    fields: [
      { key: "client_id", label: "Client ID", secret: false },
      { key: "client_secret", label: "Client secret", secret: true },
      { key: "practitioner_ref", label: "Practitioner reference", secret: false },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: false,
    testNote: "SARS access is granted per practitioner profile; no open test endpoint.",
  },
  {
    id: "payfast",
    consoleUrl: "https://dashboard.payfast.io",
    name: "PayFast",
    group: "Payments",
    summary: "South African card and EFT processing with ITN webhooks.",
    usedAt: "Trading Gate → Proof of Intent (token purchase) and Finality Gate → Payment.",
    costNote: "Percentage + fixed fee per successful transaction — see PayFast's pricing page for current rates.",
    environments: ["sandbox", "production"],
    fields: [
      { key: "merchant_id", label: "Merchant ID", secret: false },
      { key: "merchant_key", label: "Merchant key", secret: true },
      { key: "passphrase", label: "Passphrase", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: false,
    testNote: "PayFast validates credentials on the first payment or ITN callback.",
  },
  {
    id: "escrow_bank",
    name: "Trust / escrow account",
    group: "Banking & Escrow",
    summary:
      "Bank or provider holding funds between counterparties. Compliance-sensitive — confirm the arrangement with your legal and compliance advisers before going live.",
    usedAt: "Execution Gate and Finality Gate → Payment (funds held between parties until completion).",
    costNote: "Set by your bank/provider's own escrow agreement — typically a flat or %-of-value holding fee.",
    fields: [
      { key: "provider_name", label: "Provider name", secret: false },
      { key: "account_reference", label: "Account reference", secret: false },
      { key: "api_base_url", label: "API base URL", secret: false },
      { key: "api_key", label: "API key", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: false,
    testNote: "Escrow arrangements are bank-specific; connection is confirmed with your bank.",
  },
  {
    id: "resend",
    topUpUrl: "https://resend.com/settings/billing",
    consoleUrl: "https://resend.com/overview",
    name: "Resend",
    group: "Email & Notifications",
    summary: "Transactional email for verification, trade and support notices.",
    usedAt:
      "Throughout — account verification, trade/gate notifications, and inviting counterparties who aren't signed up yet.",
    costNote: "Free tier for low volume, then a monthly plan or pay-as-you-go per email above that — see Resend's pricing page.",
    fields: [
      { key: "api_key", label: "API key", secret: true, placeholder: "re_…" },
      { key: "from_address", label: "From address", secret: false, placeholder: "no-reply@izenzo.co.za" },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "open_exchange_rates",
    topUpUrl: "https://openexchangerates.org/account/billing",
    consoleUrl: "https://openexchangerates.org/account",
    name: "Open Exchange Rates",
    group: "Currency",
    summary: "Alternative exchange-rate feed.",
    usedAt: "Trading Gate → Bid/Offer (price/currency display), as a fallback feed.",
    costNote: "Free tier available; higher request volumes need a paid plan — see Open Exchange Rates' pricing page.",
    fields: [
      { key: "app_id", label: "App ID", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "firecrawl",
    topUpUrl: "https://www.firecrawl.dev/app/billing",
    consoleUrl: "https://www.firecrawl.dev/app",
    name: "Firecrawl",
    group: "Web Scraping",
    summary:
      "Live web, marketplace, directory and news reading. Powers counterparty matching and the online media checks.",
    usedAt:
      "Trading Gate → Counterparties (AI / AI+ web matching) and Online Media Checks (social, marketplace and news reading).",
    costNote: "Metered by pages/credits scraped per month — see Firecrawl's pricing page for current plan rates.",
    docsUrl: "https://docs.firecrawl.dev",
    fields: [
      {
        key: "api_key",
        label: "API key",
        secret: true,
        placeholder: "fc-…",
        help: "Firecrawl → Dashboard → API Keys. Also read from the server secret FIRECRAWL_API_KEY.",
      },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],

    testable: true,
  },
  {
    id: "aws_s3_glacier",
    topUpUrl: "https://console.aws.amazon.com/billing/home",
    consoleUrl: "https://s3.console.aws.amazon.com/s3/home",
    name: "AWS S3 / Glacier",

    group: "Archival Storage",
    summary: "Cold storage for long-term legal retention of evidence packs.",
    usedAt: "Memory Gate (long-term retention of evidence packs and the transaction record).",
    costNote: "Charged per GB stored per month plus retrieval fees — see AWS's S3/Glacier pricing pages for your region.",
    fields: [
      { key: "region", label: "Region", secret: false, placeholder: "af-south-1" },
      { key: "bucket", label: "Bucket", secret: false },
      { key: "access_key_id", label: "Access key ID", secret: false },
      { key: "secret_access_key", label: "Secret access key", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: false,
    testNote: "Bucket access is confirmed on the first archival upload.",
  },
  {
    id: "izenzo_ai_plus",
    name: "Izenzo AI+",
    group: "Izenzo AI+",
    summary:
      "The protected AI+ decision service. It proposes candidates, pricing, risk flags, structure and timing for a person to adopt or reject — it never records an outcome itself.",
    usedAt:
      "Five moments: after a counterparty is chosen, at Intent confirmation, after Proof of Intent is sealed, when a Without a Doubt case changes, and after Finality is recorded.",
    costNote: "Internal Izenzo service — cost is whatever the underlying model/compute contract for this deployment runs, not a third-party bill.",
    environments: ["sandbox", "production"],
    fields: [
      {
        key: "private_url",
        label: "Private service address",
        secret: true,
        placeholder: "https://…",
        help: "Stored server-side only as AI_PLUS_PRIVATE_URL. Sandbox and production must stay separate.",
      },
      { key: "hmac_key_id", label: "Signing key ID", secret: true, help: "AI_PLUS_HMAC_KEY_ID." },
      { key: "hmac_secret", label: "Signing secret", secret: true, help: "AI_PLUS_HMAC_SECRET. Never exposed to the browser." },
    ],
    testable: false,
    testNote:
      "AI+ only proposes. It never records a Choice, Intent, Proof of Intent, Without a Doubt, Execution or Finality outcome — every proposal still needs a person to accept or reject it.",
  },
];


export function providerById(id: string) {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id);
}
