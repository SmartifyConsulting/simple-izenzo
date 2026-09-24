import { useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { LogOut, Moon, Settings, ShieldCheck, Sun, Users } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStylePreset } from "@/lib/stylePreset";
import { supabase } from "@/integrations/supabase/client";
import { TEST_USERS } from "@/lib/testUsers";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import { Label } from "@/components/ui/label";

/** Session-only — never persisted to disk, never sent anywhere but Supabase's own sign-in call.
 * Cleared the moment the tab closes, same as any other sessionStorage value. */
function cachedTestPassword(email: string): string | null {
  try {
    return window.sessionStorage.getItem(`izenzo:test-pw:${email}`);
  } catch {
    return null;
  }
}
function cacheTestPassword(email: string, password: string) {
  try {
    window.sessionStorage.setItem(`izenzo:test-pw:${email}`, password);
  } catch {
    /* best-effort only */
  }
}

/** The app's one profile menu — Settings, sign out, then the light/dark switch below that divider,
 * then the legal footer links. The light/dark switch lives only here once signed in; ThemeToggle
 * next to the avatar is for signed-out visitors. */
export function ProfileAvatarMenu() {
  const { user, profile, signOut, roles, refresh } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [preset, setPreset] = useStylePreset();
  const isLight = preset === "cream";
  const [pwPromptFor, setPwPromptFor] = useState<{ label: string; email: string } | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [switching, setSwitching] = useState(false);

  // Falls back to the auth user's own email when the profiles row hasn't got a name/email of its
  // own yet (e.g. a freshly created or admin-inserted account) — otherwise the avatar shows a
  // bare "?" even though we know exactly who's signed in.
  const name = profile?.full_name ?? profile?.email ?? user?.email ?? "";
  const initials = (name || "?").slice(0, 2).toUpperCase();

  async function switchTo(email: string, password: string) {
    setSwitching(true);
    try {
      await supabase.auth.signOut({ scope: "local" });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      cacheTestPassword(email, password);
      await refresh();
      await router.invalidate();
      setPwPromptFor(null);
      setPwInput("");
      await navigate({ to: "/live-deal-engine", replace: true });
      toast.success(`Signed in as ${email}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSwitching(false);
    }
  }

  function pickTestUser(u: { label: string; email: string }) {
    const cached = cachedTestPassword(u.email);
    if (cached) {
      void switchTo(u.email, cached);
    } else {
      setPwPromptFor(u);
      setPwInput("");
    }
  }

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex shrink-0 items-center gap-2 rounded-full hover:opacity-80">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary bg-primary text-[12px] font-semibold text-primary-foreground">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                initials
              )}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            {profile?.email ?? user?.email}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {roles.includes("admin") && (
            <DropdownMenuItem asChild>
              <Link to="/admin" className="flex items-center">
                <ShieldCheck className="mr-2 h-3.5 w-3.5" /> Admin
              </Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild>
            <Link to="/account/settings" className="flex items-center">
              <Settings className="mr-2 h-3.5 w-3.5" /> Settings
            </Link>
          </DropdownMenuItem>
          {TEST_USERS.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Users className="mr-2 h-3.5 w-3.5" /> Switch test user
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {TEST_USERS.map((u) => (
                    <DropdownMenuItem key={u.email} onClick={() => pickTestUser(u)} disabled={switching}>
                      {u.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setPreset(isLight ? "black" : "cream")}>
            {isLight ? (
              <Moon className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Sun className="mr-2 h-3.5 w-3.5" />
            )}
            {isLight ? "Switch to dark mode" : "Switch to light mode"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <div className="flex flex-col gap-1 px-2 py-1.5">
            <div className="flex items-center gap-3">
              <a href="/privacy" className="text-[11px] text-muted-foreground hover:text-foreground">
                Privacy Policy
              </a>
              <a href="/terms" className="text-[11px] text-muted-foreground hover:text-foreground">
                Terms &amp; Conditions
              </a>
            </div>
            <p className="text-[11px] text-muted-foreground">© Izenzo 2026</p>
          </div>
      </DropdownMenuContent>

      <Dialog open={Boolean(pwPromptFor)} onOpenChange={(open) => !open && setPwPromptFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in as {pwPromptFor?.label}</DialogTitle>
            <DialogDescription>
              First switch this session — the password is kept only in this browser tab, never saved anywhere
              else. You won't be asked again until you close the tab.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="test-user-password">Password for {pwPromptFor?.email}</Label>
            <PasswordInput
              id="test-user-password"
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && pwPromptFor && pwInput) void switchTo(pwPromptFor.email, pwInput);
              }}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPwPromptFor(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!pwInput || switching}
              onClick={() => pwPromptFor && void switchTo(pwPromptFor.email, pwInput)}
            >
              {switching ? "Switching…" : "Switch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DropdownMenu>
  );
}
