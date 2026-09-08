import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useModules } from "@/lib/useModules";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/** Simple Mode's own compact profile menu — same names and order as the Modules row below the
 * board, so the two stay consistent rather than presenting two different destination lists. */
export function ProfileAvatarMenu() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const modules = useModules();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex shrink-0 items-center gap-2 rounded-full hover:opacity-80">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-border bg-muted text-[12px] font-semibold text-foreground">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (profile?.full_name ?? profile?.email ?? "?").slice(0, 2).toUpperCase()
            )}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {profile?.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modules.map((item) => (
          <DropdownMenuItem key={item.to} asChild>
            <Link to={item.to} className="flex items-center">
              <item.icon className="mr-2 h-3.5 w-3.5" /> {item.label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-2 h-3.5 w-3.5" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
