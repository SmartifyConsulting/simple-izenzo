/** Catalogue of third-party services Izenzo can connect to.
 * Field values marked `secret: true` are encrypted at rest and never leave the server
 * except when an administrator explicitly reveals them. */

export type IntegrationField = {
  key: string;
  label: string;
  secret: boolean;
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
  docsUrl?: string;
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
  "Archival Storage",
] as const;

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    id: "smile_identity",
    name: "Smile ID",
    group: "KYC & Identity",
    summary: "South African and pan-African ID document checks with liveness.",
    usedAt: "Compliance Gate → Without a Doubt (KYC identity check).",
    environments: ["sandbox", "production"],
    fields: [
      { key: "partner_id", label: "Partner ID", secret: false, placeholder: "0000" },
      { key: "api_key", label: "API key", secret: true },
      { key: "callback_url", label: "Callback URL", secret: false, placeholder: "https://…/smile-callback" },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: false,
    testNote: "Smile ID has no read-only check endpoint — credentials are verified on the first live job.",
  },
  {
    id: "onfido",
    name: "Onfido",
    group: "KYC & Identity",
    summary: "Global identity document and biometric verification.",
    usedAt: "Compliance Gate → Without a Doubt (KYC identity check), for counterparties outside Smile ID's coverage.",
    environments: ["sandbox", "production"],
    fields: [
      { key: "api_token", label: "API token", secret: true, placeholder: "api_sandbox…" },
      { key: "region", label: "Region", secret: false, placeholder: "eu, us or ca" },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "didit",
    name: "Didit",
    group: "KYC & Identity",
    summary:
      "ID document + selfie, company (KYB) and sanctions/PEP checks. Used for self-verification and at the WaD compliance gate.",
    usedAt:
      "Trading Gate → Background screening (per-counterparty ID/KYB/AML checks) and Compliance Gate → Without a Doubt.",
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
    name: "CIPC",
    group: "Business Registry & Tax",
    summary: "Company registration and director verification.",
    usedAt: "Trading Gate → Counterparties (registry lookup during background screening) and Compliance Gate → KYB.",
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
    name: "SARS eFiling",
    group: "Business Registry & Tax",
    summary: "Tax Compliance Status checks. Usually requires a registered practitioner profile.",
    usedAt: "Compliance Gate → Without a Doubt (KYB tax-status check).",
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
    name: "PayFast",
    group: "Payments",
    summary: "South African card and EFT processing with ITN webhooks.",
    usedAt: "Trading Gate → Proof of Intent (token purchase) and Finality Gate → Payment.",
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
    id: "stitch",
    name: "Stitch",
    group: "Payments",
    summary: "Instant EFT / pay-by-bank with account verification.",
    usedAt: "Trading Gate → Proof of Intent (token purchase) and Finality Gate → Payment.",
    environments: ["test", "production"],
    fields: [
      { key: "client_id", label: "Client ID", secret: false },
      { key: "client_secret", label: "Client secret", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "ozow",
    name: "Ozow",
    group: "Payments",
    summary: "Instant EFT rails, widely used for larger South African trade values.",
    usedAt: "Trading Gate → Proof of Intent (token purchase) and Finality Gate → Payment.",
    environments: ["test", "production"],
    fields: [
      { key: "site_code", label: "Site code", secret: false },
      { key: "api_key", label: "API key", secret: true },
      { key: "private_key", label: "Private key", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "peach_payments",
    name: "Peach Payments",
    group: "Payments",
    summary: "Card processing with 3D Secure coverage.",
    usedAt: "Trading Gate → Proof of Intent (token purchase) and Finality Gate → Payment.",
    environments: ["test", "production"],
    fields: [
      { key: "entity_id", label: "Entity ID", secret: false },
      { key: "access_token", label: "Access token", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "escrow_bank",
    name: "Trust / escrow account",
    group: "Banking & Escrow",
    summary:
      "Bank or provider holding funds between counterparties. Compliance-sensitive — confirm the arrangement with your legal and compliance advisers before going live.",
    usedAt: "Execution Gate and Finality Gate → Payment (funds held between parties until completion).",
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
    name: "Resend",
    group: "Email & Notifications",
    summary: "Transactional email for verification, trade and support notices.",
    usedAt:
      "Throughout — account verification, trade/gate notifications, and inviting counterparties who aren't signed up yet.",
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
    id: "twilio",
    name: "Twilio",
    group: "Email & Notifications",
    summary: "SMS alerts for high-value trade events.",
    usedAt: "Throughout — SMS alerts for gate events on higher-value deals.",
    fields: [
      { key: "account_sid", label: "Account SID", secret: false, placeholder: "AC…" },
      { key: "auth_token", label: "Auth token", secret: true },
      { key: "from_number", label: "From number", secret: false, placeholder: "+2771…" },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "complyadvantage",
    name: "ComplyAdvantage",
    group: "Sanctions & Fraud",
    summary: "AML, sanctions and PEP screening with FICA-compatible record keeping.",
    usedAt: "Trading Gate → Background screening (sanctions/PEP check) and Compliance Gate → Without a Doubt.",
    fields: [
      { key: "api_key", label: "API key", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "world_check",
    name: "Refinitiv World-Check",
    group: "Sanctions & Fraud",
    summary: "Enterprise sanctions and PEP screening.",
    usedAt: "Trading Gate → Background screening (sanctions/PEP check) and Compliance Gate → Without a Doubt.",
    fields: [
      { key: "api_key", label: "API key", secret: false },
      { key: "api_secret", label: "API secret", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: false,
    testNote: "World-Check uses signed requests per enterprise contract; no generic test call.",
  },
  {
    id: "exchangerate_host",
    name: "exchangerate.host",
    group: "Currency",
    summary: "Multi-currency conversion for cross-border trade and token pricing.",
    usedAt: "Trading Gate → Bid/Offer (price/currency display) and token pricing.",
    fields: [
      { key: "access_key", label: "Access key", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "open_exchange_rates",
    name: "Open Exchange Rates",
    group: "Currency",
    summary: "Alternative exchange-rate feed.",
    usedAt: "Trading Gate → Bid/Offer (price/currency display), as a fallback feed.",
    fields: [
      { key: "app_id", label: "App ID", secret: true },
      { key: "dev_center_url", label: "Dev center login URL", secret: false, placeholder: "https://…" },
      { key: "portal_username", label: "Username", secret: false },
      { key: "portal_credentials", label: "Credentials", secret: true, help: "Password or API secret used to sign in to the provider portal." },
    ],
    testable: true,
  },
  {
    id: "aws_s3_glacier",
    name: "AWS S3 / Glacier",
    group: "Archival Storage",
    summary: "Cold storage for long-term legal retention of evidence packs.",
    usedAt: "Memory Gate (long-term retention of evidence packs and the transaction record).",
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
];

export function providerById(id: string) {
  return INTEGRATION_PROVIDERS.find((p) => p.id === id);
}
