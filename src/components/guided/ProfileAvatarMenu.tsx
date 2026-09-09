import { Link, useNavigate } from "@tanstack/react-router";
import { History, LogOut, Moon, Settings, Sun } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The app's one profile menu — Settings, then the light/dark switch, then sign out, then the
 * legal footer links. Pricing/API's/Support live in the top nav instead. */
export function ProfileAvatarMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();

  const name = profile?.full_name ?? profile?.email ?? "";
  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex shrink-0 items-center gap-2 rounded-full hover:opacity-80">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-primary bg-primary text-[12px] font-semibold text-black">
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
          <DropdownMenuItem asChild>
            <Link to="/activity" className="flex items-center">
              <History className="mr-2 h-3.5 w-3.5" /> Activity Log
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/settings" className="flex items-center">
              <Settings className="mr-2 h-3.5 w-3.5" /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleTheme}>
            {theme === "dark" ? (
              <Sun className="mr-2 h-3.5 w-3.5" />
            ) : (
              <Moon className="mr-2 h-3.5 w-3.5" />
            )}
            {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
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
