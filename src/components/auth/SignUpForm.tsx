import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PasswordInput } from "@/components/PasswordInput";
import { AuthorityToActPanel } from "@/components/verification/AuthorityToActPanel";
import { mapAuthError } from "@/lib/auth";
import { generateOrgBrief } from "@/lib/orgBrief.functions";
import { beginRegistration, endRegistration } from "@/lib/registrationFlow";
import { COUNTRIES } from "@/lib/countries";
import { cn } from "@/lib/utils";

const SECTORS = [
  "Agriculture",
  "Logistics",
  "Metals & Mining",
  "Energy",
  "Manufacturing",
  "Financial Services",
  "Construction & Infrastructure",
  "Technology",
];

const ADD_NEW_SECTOR = "__add_new__";

function safeNext(next: string | undefined) {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/live-deal-engine";
}

/** The account-creation form, shared between the standalone /auth page and the home page hero.
 * Both steps share a fixed min-height so the form doesn't visibly resize when moving between
 * them. */
export function SignUpForm({
  next,
  className,
  hideHeader = false,
  hideFooterLink = false,
  compact = false,
  initialStep = 1,
}: {
  next?: string | undefined;
  className?: string | undefined;
  hideHeader?: boolean;
  hideFooterLink?: boolean;
  /** Tighter spacing and a shorter min-height — used when this form sits in a small space (the
   * home page hero) rather than the standalone /auth page. */
  compact?: boolean;
  /** 2 when returning from the email confirmation link. */
  initialStep?: 1 | 2 | 3 | undefined;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const [checkEmail, setCheckEmail] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [accountType, setAccountType] = useState<"company" | "individual" | null>(null);
  const [orgName, setOrgName] = useState("");
  const [registrationNo, setRegistrationNo] = useState("");
  const [country, setCountry] = useState("");
  const [sector, setSector] = useState("");
  const [customSector, setCustomSector] = useState("");
  const [yearsInBusiness, setYearsInBusiness] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  const resolvedSector = sector === ADD_NEW_SECTOR ? customSector.trim() : sector;

  const rules = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Za-z]/.test(password) && /\d/.test(password), label: "A letter and a number" },
    {
      ok: password.length > 0 && password.toLowerCase() !== email.split("@")[0]?.toLowerCase(),
      label: "Not your email name",
    },
  ];

  const confirmRedirect = () => `${window.location.origin}/?signup=2`;

  function startCooldown() {
    setResendIn(60);
    const t = window.setInterval(() => {
      setResendIn((n) => {
        if (n <= 1) window.clearInterval(t);
        return n - 1;
      });
    }, 1000);
  }

  // Step 1 creates the account and sends the confirmation email. The organisation details (step 2)
  // are only saved once the person has confirmed and is signed in — the database refuses them
  // before that.
  async function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (rules.some((r) => !r.ok)) {
      setMessage("Please meet all the password requirements.");
      return;
    }
    setBusy(true);
    beginRegistration();
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: confirmRedirect(), data: { full_name: fullName } },
      });
      if (error) throw error;
      if (data.session) {
        setStep(2);
      } else {
        endRegistration();
        setCheckEmail(true);
        startCooldown();
      }
    } catch (err) {
      endRegistration();
      const msg = mapAuthError((err as Error).message);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setMessage("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: confirmRedirect() },
    });
    if (error) {
      const msg = mapAuthError(error.message);
      setMessage(msg);
      toast.error(msg);
      return;
    }
    toast.success("Confirmation email sent again");
    startCooldown();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!accountType) {
      setMessage("Choose whether you're registering as a company or an individual.");
      return;
    }
    if (accountType === "company" && !orgName.trim()) {
      setMessage("Company name is required.");
      return;
    }
    setBusy(true);
    // Signing up creates a session immediately, and the /auth page redirects away the instant it
    // sees one — unless registration is already flagged as in progress. That flag has to be set
    // before the sign-up call, not after it: setting it once the org/profile writes below have
    // finished is too late, since the redirect can fire in the gap between the session appearing
    // and this function reaching that line, tearing the form down before step 3 ever renders.
    beginRegistration();
    try {
      const { data: userData } = await supabase.auth.getUser();
      const authUser = userData.user;
      if (!authUser) throw new Error("Please open the confirmation link in your email first.");
      const email = authUser.email ?? "";
      const fullName =
        [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") ||
        String(authUser.user_metadata?.["full_name"] ?? "");

      const userId = authUser.id;
      if (userId) {
        // Individuals still get an organisation record behind the scenes — every deal is tied to
        // an org_id, so this is what keeps the rest of the app (e.g. "Record and continue") from
        // demanding company details a solo trader was never asked for.
        const isCompany = accountType === "company";
        const { data: org, error: orgErr } = await supabase
          .from("organisations")
          .insert({
            name: isCompany ? orgName : fullName || email,
            registration_no: isCompany ? registrationNo : null,
            country,
            industry: isCompany && resolvedSector ? resolvedSector : null,
            years_in_business:
              isCompany && yearsInBusiness.trim() !== "" ? Number(yearsInBusiness) : null,
            website: isCompany && website ? website : null,
            primary_contact_name: fullName || null,
            primary_contact_email: email || null,
          })
          .select()
          .single();
        if (orgErr) throw orgErr;

        const { error: mErr } = await supabase
          .from("org_members")
          .insert({ org_id: org.id, user_id: userId, role: "owner" });
        if (mErr) throw mErr;

        // full_name/last_name are stored separately (every other screen that shows a person's name
        // joins them back together) — this used to write the whole "First Last" string into
        // full_name and never touch last_name at all, so Last Name was always blank downstream.
        const metadataFullName = String(authUser.user_metadata?.["full_name"] ?? "").trim();
        const [metaFirst, ...metaRest] = metadataFullName.split(/\s+/).filter(Boolean);
        const profileFirstName = firstName.trim() || metaFirst || null;
        const profileLastName = lastName.trim() || (metaRest.length > 0 ? metaRest.join(" ") : null);

        const { error: pErr } = await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              org_id: org.id,
              account_type: accountType,
              full_name: profileFirstName,
              last_name: profileLastName,
              email,
            } as never,
            { onConflict: "id" },
          );
        if (pErr) throw pErr;

        // Best effort: write the company profile from their website in the background. A failure
        // here must never block a brand-new account from getting in.
        if (isCompany && website) {
          void generateOrgBrief({ data: { orgId: org.id } }).catch(() => undefined);
        }
      }

      toast.success("Organisation details saved");
      // One last step before heading in: an ID/passport number and the document that suits the
      // account — an Authority to Act for a company, proof of residential address for an
      // individual. The authenticated layout still catches anyone who closes the tab here.
      setStep(3);
    } catch (err) {
      // Sign-up itself may still have partially succeeded (a session can exist even if an org/
      // profile write below failed) — clear the in-progress flag either way so a real failure
      // doesn't leave /auth's redirect permanently stood down for this browser tab.
      endRegistration();
      const msg = mapAuthError((err as Error).message);
      setMessage(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error(mapAuthError(String(result.error)));
      return;
    }
    if (result.redirected) return;
    // A Google sign-up never sees the steps above, so it cannot have picked a company/individual
    // type or provided a document — the authenticated layout's registration gate walks it through
    // those instead of dropping it straight into the app.
    navigate({ to: safeNext(next), replace: true });
  }

  return (
    <div className={className}>
      {!hideHeader && (
        <>
          <h2 className="text-xl font-semibold tracking-tight">Create your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Open a seat on the Izenzo Trading Gateway.
          </p>
        </>
      )}

      <div
        className={cn(compact ? "mb-2" : "mb-4", !hideHeader && "mt-7", "flex items-center gap-2")}
      >
        {([1, 2, 3] as const).map((n, i) => (
          <span key={n} className="flex items-center gap-2">
            {i > 0 && <span className="h-px w-6 bg-border" />}
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                step === n ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
              )}
            >
              {n}
            </span>
          </span>
        ))}
        <p className="ml-2 text-xs text-muted-foreground">
          {step === 1
            ? "Your details"
            : step === 2
              ? "Organisation details"
              : "Complete registration"}
        </p>
      </div>

      <div className={compact ? "min-h-[260px]" : "min-h-[420px]"}>
        {step === 1 && checkEmail ? (
          <div className="space-y-4" aria-live="polite">
            <h3 className="text-lg font-semibold">Check your email</h3>
            <p className="text-sm text-muted-foreground">
              To continue setting up your account, please verify your email address via the link
              sent to <span className="font-medium text-foreground">{email}</span>.
            </p>
            {message && <p className="text-sm text-destructive">{message}</p>}
            <Button type="button" variant="outline" className="w-full" onClick={resend} disabled={resendIn > 0}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend confirmation email"}
            </Button>
          </div>
        ) : step === 1 ? (
          <form onSubmit={onContinue} className={compact ? "space-y-1.5" : "space-y-4"}>
            <div className={cn("grid grid-cols-2", compact ? "gap-2" : "gap-3")}>
              <div className={compact ? "space-y-1" : "space-y-1.5"}>
                <Label htmlFor="hero-first-name" className={compact ? "text-xs" : undefined}>
                  First name
                </Label>
                <Input
                  id="hero-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                  className={compact ? "h-8 text-sm" : undefined}
                />
              </div>
              <div className={compact ? "space-y-1" : "space-y-1.5"}>
                <Label htmlFor="hero-last-name" className={compact ? "text-xs" : undefined}>
                  Last name
                </Label>
                <Input
                  id="hero-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                  className={compact ? "h-8 text-sm" : undefined}
                />
              </div>
            </div>
            <div className={compact ? "space-y-1" : "space-y-1.5"}>
              <Label htmlFor="hero-email" className={compact ? "text-xs" : undefined}>
                Email
              </Label>
              <Input
                id="hero-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className={compact ? "h-8 text-sm" : undefined}
              />
            </div>
            <div className={compact ? "space-y-1" : "space-y-1.5"}>
              <Label htmlFor="hero-password" className={compact ? "text-xs" : undefined}>
                Password
              </Label>
              <PasswordInput
                id="hero-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className={compact ? "h-8 text-sm" : undefined}
              />
              {!compact && (
                <ul className="mt-2 space-y-1">
                  {rules.map((r) => (
                    <li
                      key={r.label}
                      className={"text-xs " + (r.ok ? "text-success" : "text-muted-foreground")}
                    >
                      {r.ok ? "✓" : "•"} {r.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {message && (
              <p aria-live="polite" className="text-sm text-destructive">
                {message}
              </p>
            )}

            <Button type="submit" size={compact ? "sm" : "default"} className="w-full" disabled={busy}>
              Create account
            </Button>

            <div className={cn("flex items-center gap-3", compact ? "my-2" : "my-5")}>
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button
              type="button"
              variant="outline"
              size={compact ? "sm" : "default"}
              className="w-full"
              onClick={google}
              disabled={busy}
            >
              Continue with Google
            </Button>
          </form>
        ) : step === 2 ? (
          <form onSubmit={onSubmit} className={compact ? "space-y-1.5" : "space-y-4"}>
            <div className="space-y-1.5">
              <Label>Registering as</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAccountType("company")}
                  className={
                    "rounded-md border px-3 py-2.5 text-left text-sm transition-colors " +
                    (accountType === "company"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input text-muted-foreground hover:bg-accent")
                  }
                >
                  <span className="block font-medium">Company</span>
                  <span className="block text-xs text-muted-foreground">
                    Trading as an organisation
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("individual")}
                  className={
                    "rounded-md border px-3 py-2.5 text-left text-sm transition-colors " +
                    (accountType === "individual"
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-input text-muted-foreground hover:bg-accent")
                  }
                >
                  <span className="block font-medium">Individual</span>
                  <span className="block text-xs text-muted-foreground">
                    Trading in your own name
                  </span>
                </button>
              </div>
            </div>

            {accountType === "company" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="org-name">Registered name</Label>
                    <Input
                      id="org-name"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-reg">Registration number</Label>
                    <Input
                      id="org-reg"
                      value={registrationNo}
                      onChange={(e) => setRegistrationNo(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="org-country">Country</Label>
                    <Select value={country} onValueChange={setCountry}>
                      <SelectTrigger id="org-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-sector">Sector</Label>
                    <Select value={sector} onValueChange={setSector}>
                      <SelectTrigger id="org-sector">
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        <SelectItem value={ADD_NEW_SECTOR}>Other — add new…</SelectItem>
                      </SelectContent>
                    </Select>
                    {sector === ADD_NEW_SECTOR && (
                      <Input
                        className="mt-1.5"
                        placeholder="Name your sector"
                        value={customSector}
                        onChange={(e) => setCustomSector(e.target.value)}
                      />
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="org-years">Years in business</Label>
                    <Input
                      id="org-years"
                      type="number"
                      min={0}
                      value={yearsInBusiness}
                      onChange={(e) => setYearsInBusiness(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="org-website">Website</Label>
                    <Input
                      id="org-website"
                      type="url"
                      placeholder="https://"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {accountType === "individual" && (
              <div className="space-y-1.5">
                <Label htmlFor="org-country">Country</Label>
                <Select value={country} onValueChange={setCountry}>
                  <SelectTrigger id="org-country">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {message && (
              <p aria-live="polite" className="text-sm text-destructive">
                {message}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={busy}>
                Continue
              </Button>
            </div>
          </form>
        ) : (
          <AuthorityToActPanel
            onSaved={() => {
              // Registration is finished — let the app take over from here.
              endRegistration();
              navigate({ to: safeNext(next), replace: true });
            }}
          />
        )}
      </div>

      {!hideFooterLink && step !== 3 && (
        <p className={cn("text-center text-sm text-muted-foreground", compact ? "mt-3" : "mt-6")}>
          Already have an account?{" "}
          <Link
            to="/auth"
            search={{ mode: "signin", next }}
            className="font-medium text-foreground hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
