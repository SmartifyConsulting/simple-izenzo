import { Link, useNavigate } from "@tanstack/react-router";
import { LifeBuoy, LogOut, Moon, Settings, Sun, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** The app's one profile menu — identity destinations (Settings, Support), then the
 * light/dark switch, then sign out, then the legal footer links. */
export function ProfileAvatarMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const [viewing, setViewing] = useState(false);

  const name = profile?.full_name ?? profile?.email ?? "";
  const initials = (name || "?").slice(0, 2).toUpperCase();

  return (
    <>
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
          <DropdownMenuItem onClick={() => setViewing(true)}>
            <UserRound className="mr-2 h-3.5 w-3.5" /> View picture
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/account/settings" className="flex items-center">
              <Settings className="mr-2 h-3.5 w-3.5" /> Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href="/support" className="flex items-center">
              <LifeBuoy className="mr-2 h-3.5 w-3.5" /> Support
            </a>
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

      <Dialog open={viewing} onOpenChange={setViewing}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-sm font-medium">{name || "Profile picture"}</DialogTitle>
          <div className="flex flex-col items-center gap-4 pt-2">
            <div className="flex h-56 w-56 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-4xl font-semibold text-muted-foreground">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <Link
              to="/account/settings"
              onClick={() => setViewing(false)}
              className="text-xs font-medium text-foreground hover:underline"
            >
              Change image
            </Link>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
