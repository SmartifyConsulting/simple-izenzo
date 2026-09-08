import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
  avatar_url?: string | null;
};

export type Org = {
  id: string;
  name: string;
  registration_no: string | null;
  country: string | null;
  sector: string | null;
  address: string | null;
  credits: number;
  avatar_url?: string | null;
  offerings?: string | null;
  website?: string | null;
};

type AuthValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  org: Org | null;
  orgs: Org[];
  roles: string[];
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  profile: null,
  org: null,
  orgs: [],
  roles: [],
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
  switchOrg: async () => {},
});

const bumpedTokens = new Set<string>();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const uidRef = useRef<string | undefined>(undefined);


  async function load(uid: string | undefined) {
    uidRef.current = uid;
    if (!uid) {
      setProfile(null);
      setOrg(null);
      setOrgs([]);
      setRoles([]);
      return;
    }
    const [{ data: p }, { data: r }, { data: memberships }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("org_members").select("org_id").eq("user_id", uid),
    ]);
    setProfile((p as Profile) ?? null);
    setRoles((r ?? []).map((x: { role: string }) => x.role));

    const orgIds = (memberships ?? []).map((m: { org_id: string }) => m.org_id);
    if (orgIds.length > 0) {
      const { data: os } = await supabase.from("organisations").select("*").in("id", orgIds);
      setOrgs((os as Org[]) ?? []);
    } else {
      setOrgs([]);
    }

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
              if (provider !== "email" || s.user.email_confirmed_at) {
                await supabase.rpc("mark_email_verified");
              }
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

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === "hidden") return;
      if (!uidRef.current) return;
      void load(uidRef.current);
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  const value: AuthValue = {
    user: session?.user ?? null,
    session,
    profile,
    org,
    orgs,
    roles,
    loading,
    refresh: () => load(session?.user?.id),
    signOut: async () => {
      await supabase.auth.signOut();
      setProfile(null);
      setOrg(null);
      setOrgs([]);
      setRoles([]);
    },
    switchOrg: async (orgId: string) => {
      if (!session?.user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ org_id: orgId })
        .eq("id", session.user.id);
      if (error) throw error;
      await load(session.user.id);
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
