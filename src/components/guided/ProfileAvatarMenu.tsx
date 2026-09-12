import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Moon, Settings, ShieldCheck, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStylePreset } from "@/lib/stylePreset";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The app's one profile menu — Settings, the light/dark switch (also available on its own next
 * to the avatar, see ThemeToggle — kept here too so it's easy to find either way), then sign out,
 * then the legal footer links. */
export function ProfileAvatarMenu() {
  const { profile, signOut, roles } = useAuth();
  const navigate = useNavigate();
  const [preset, setPreset] = useStylePreset();
  const isLight = preset === "cream";


  const name = profile?.full_name ?? profile?.email ?? "";
  const initials = (name || "?").slice(0, 2).toUpperCase();

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
            {profile?.email}
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
          <DropdownMenuItem onClick={() => setPreset(isLight ? "black" : "cream")}>
            {isLight ? (
              <Moon className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Sun className="mr-2 h-3.5 w-3.5" />
            )}
            {isLight ? "Switch to dark mode" : "Switch to light mode"}
          </DropdownMenuItem>
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
    </DropdownMenu>
  );
}
