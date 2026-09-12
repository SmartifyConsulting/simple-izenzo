import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput } from "@/components/PasswordInput";
import { mapAuthError } from "@/lib/auth";
import { generateOrgBrief } from "@/lib/orgBrief.functions";
import { COUNTRIES } from "@/lib/countries";

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
}: {
  next?: string | undefined;
  className?: string | undefined;
  hideHeader?: boolean;
  hideFooterLink?: boolean;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
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

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (rules.some((r) => !r.ok)) {
      setMessage("Please meet all the password requirements.");
      return;
    }
    setStep(2);
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
    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${safeNext(next)}`,
          data: { full_name: fullName },
        },
      });
      if (error) throw error;

      const userId = signUpData.user?.id;
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

        const { error: pErr } = await supabase
          .from("profiles")
          .update({ org_id: org.id })
          .eq("id", userId);
        if (pErr) throw pErr;

        // Best effort: write the company profile from their website in the background. A failure
        // here must never block a brand-new account from getting in.
        if (isCompany && website) {
          void generateOrgBrief({ data: { orgId: org.id } }).catch(() => undefined);
        }
      }

      toast.success("Account created");
      navigate({ to: "/verify-identity", search: { next: safeNext(next) }, replace: true });
    } catch (err) {
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
    navigate({ to: safeNext(next), replace: true });
  }

  return (
    <div className={className}>
      {!hideHeader && (
        <>
          <h2 className="text-xl font-semibold tracking-tight">Create your account</h2>
          <p className="mt-1 text-sm text-muted-foreground">Open a seat on the Izenzo Trading Gateway.</p>
        </>
      )}

      <div className={hideHeader ? "mb-4 flex items-center gap-2" : "mb-4 mt-7 flex items-center gap-2"}>
        <span
          className={
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
            (step === 1 ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
          }
        >
          1
        </span>
        <span className="h-px w-6 bg-border" />
        <span
          className={
            "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold " +
            (step === 2 ? "bg-foreground text-background" : "bg-muted text-muted-foreground")
          }
        >
          2
        </span>
        <p className="ml-2 text-xs text-muted-foreground">
          {step === 1 ? "Your details" : "Organisation details"}
        </p>
      </div>

      <div className="min-h-[420px]">
        {step === 1 ? (
          <form onSubmit={onContinue} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="hero-first-name">First name</Label>
                <Input
                  id="hero-first-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hero-last-name">Last name</Label>
                <Input
                  id="hero-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hero-email">Email</Label>
              <Input
                id="hero-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hero-password">Password</Label>
              <PasswordInput
                id="hero-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
              <ul className="mt-2 space-y-1">
                {rules.map((r) => (
                  <li key={r.label} className={"text-xs " + (r.ok ? "text-success" : "text-muted-foreground")}>
                    {r.ok ? "✓" : "•"} {r.label}
                  </li>
                ))}
              </ul>
            </div>

            {message && (
              <p aria-live="polite" className="text-sm text-destructive">
                {message}
              </p>
            )}

            <Button type="submit" className="w-full">
              Continue
            </Button>

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
              Continue with Google
            </Button>
          </form>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
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
                  <span className="block text-xs text-muted-foreground">Trading as an organisation</span>
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
                  <span className="block text-xs text-muted-foreground">Trading in your own name</span>
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
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={busy}>
                Back
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                Create account
              </Button>
            </div>
          </form>
        )}
      </div>

      {!hideFooterLink && (
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/auth" search={{ mode: "signin", next }} className="font-medium text-foreground hover:underline">
            Sign in with facial recognition
          </Link>
        </p>
      )}
    </div>
  );
}
