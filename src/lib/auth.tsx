import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  org_id: string | null;
  seat: string;
  login_count?: number | null;
  email_verified_at?: string | null;
};

export type Org = {
  id: string;
  name: string;
  registration_no: string | null;
  country: string | null;
  sector: string | null;
  address: string | null;
  credits: number;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  org: Org | null;
  roles: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  profile: null,
  org: null,
  roles: [],
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

const bumpedTokens = new Set<string>();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(uid: string | undefined) {
    if (!uid) {
      setProfile(null);
      setOrg(null);
      setRoles([]);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles((r ?? []).map((x: { role: string }) => x.role));
    if (p?.org_id) {
      const { data: o } = await supabase
        .from("organisations")
        .select("*")
        .eq("id", p.org_id)
        .maybeSingle();
      setOrg((o as Org) ?? null);
    } else {
      setOrg(null);
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setTimeout(() => {
        void (async () => {
          if (event === "SIGNED_IN" && s) {
            const token = s.access_token.slice(-24);
            if (!bumpedTokens.has(token)) {
              bumpedTokens.add(token);
              const provider = (s.user.app_metadata as { provider?: string })?.provider ?? "email";
              await supabase.rpc("bump_login_count");
              if (provider !== "email") await supabase.rpc("mark_email_verified_if_oauth");
            }
          }
          await load(s?.user?.id);
          setLoading(false);
        })();
      }, 0);
    });

    void supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await load(data.session?.user?.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    profile,
    org,
    roles,
    loading,
    refresh: () => load(session?.user?.id),
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setOrg(null);
      setRoles([]);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function mapAuthError(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (!m) return "Something went wrong. Please try again.";
  if (m.includes("invalid login credentials") || m.includes("user not found"))
    return "Email or password is incorrect.";
  if (m.includes("pwned") || m.includes("leaked") || m.includes("compromised"))
    return "That password has appeared in a known data breach. Please choose a different one.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "An account with that email already exists. Try signing in instead.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Please wait a moment and try again.";
  if (m.includes("should be at least")) return "That password is too short.";
  if (m.includes("expired") || m.includes("invalid token"))
    return "That link has expired. Please request a new one.";
  if (m.includes("same as the old") || m.includes("different from the old"))
    return "Please choose a password you have not used before.";
  return message ?? "Something went wrong. Please try again.";
}
