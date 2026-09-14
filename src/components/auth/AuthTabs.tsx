import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";
import { cn } from "@/lib/utils";

/** Sign in and sign up as tabs of one form, shared between /auth and the home page hero. */
export function AuthTabs({
  next,
  defaultTab,
  className,
  compact = false,
}: {
  next?: string | undefined;
  defaultTab?: "signin" | "signup" | undefined;
  className?: string | undefined;
  /** Tighter spacing throughout — used when this sits in a small space (the home page hero)
   * rather than the standalone /auth page. */
  compact?: boolean;
}) {
  return (
    <div className={className}>
      <div className={cn("flex items-center gap-2", compact ? "mb-1.5" : "mb-5")}>
        <span className="flex h-7 w-7 items-center justify-center rounded bg-sidebar text-[11px] font-bold text-sidebar-foreground">
          IZ
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">Izenzo Trading Gateway</p>
          {!compact && (
            <p className="text-xs text-muted-foreground">Governance infrastructure for institutional trade</p>
          )}
        </div>
      </div>
      <Tabs defaultValue={defaultTab ?? "signin"}>
        <TabsList className={cn("grid w-full grid-cols-2", compact && "h-7")}>
          <TabsTrigger value="signin" className={compact ? "text-xs" : undefined}>Sign in</TabsTrigger>
          <TabsTrigger value="signup" className={compact ? "text-xs" : undefined}>Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className={compact ? "pt-1.5" : "pt-6"}>
          <SignInForm next={next} hideHeader hideFooterLink compact={compact} />
        </TabsContent>
        <TabsContent value="signup" className={compact ? "pt-1.5" : "pt-6"}>
          <SignUpForm next={next} hideHeader hideFooterLink compact={compact} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
