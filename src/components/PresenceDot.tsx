import { cn } from "@/lib/utils";

const ONLINE_WITHIN_MS = 2 * 60 * 1000;
const AWAY_WITHIN_MS = 10 * 60 * 1000;

export type PresenceStatus = "online" | "away" | "offline" | "never";

export function presenceStatus(lastAccessedAt: string | null | undefined): PresenceStatus {
  if (!lastAccessedAt) return "never";
  const ageMs = Date.now() - new Date(lastAccessedAt).getTime();
  if (ageMs <= ONLINE_WITHIN_MS) return "online";
  if (ageMs <= AWAY_WITHIN_MS) return "away";
  return "offline";
}

const DOT_CLASS: Record<PresenceStatus, string> = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-red-500",
  // Never used the app at all — distinct from "offline" (which means they have an account and
  // have simply stepped away), so this gets its own neutral charcoal rather than red.
  never: "bg-slate-600",
};

const LABEL: Record<PresenceStatus, string> = {
  online: "Online now",
  away: "Away",
  offline: "Offline",
  never: "Not on the app",
};

/** Small status dot meant to sit at an avatar's corner — green/amber/red/charcoal per
 * `presenceStatus`. Pass `lastAccessedAt` straight from `profiles.last_accessed_at`. */
export function PresenceDot({
  lastAccessedAt,
  className,
}: {
  lastAccessedAt: string | null | undefined;
  className?: string;
}) {
  const status = presenceStatus(lastAccessedAt);
  return (
    <span
      title={LABEL[status]}
      className={cn("block h-2.5 w-2.5 rounded-full ring-2 ring-white", DOT_CLASS[status], className)}
    />
  );
}

/** An avatar (image or initials) with a `PresenceDot` pinned to its bottom-right corner. */
export function AvatarWithPresence({
  name,
  avatarUrl,
  lastAccessedAt,
  size = 28,
}: {
  name: string;
  avatarUrl?: string | null;
  lastAccessedAt: string | null | undefined;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
          {initials || "?"}
        </span>
      )}
      <PresenceDot lastAccessedAt={lastAccessedAt} className="absolute -bottom-0.5 -right-0.5" />
    </span>
  );
}
