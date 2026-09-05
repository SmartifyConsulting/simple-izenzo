import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignInForm } from "@/components/auth/SignInForm";
import { SignUpForm } from "@/components/auth/SignUpForm";

/** Sign in and sign up as tabs of one form, shared between /auth and the home page hero. */
export function AuthTabs({
  next,
  defaultTab,
  className,
}: {
  next?: string | undefined;
  defaultTab?: "signin" | "signup" | undefined;
  className?: string | undefined;
}) {
  return (
    <div className={className}>
      <div className="mb-5 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">
          IZ
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">Izenzo Trading Gateway</p>
          <p className="text-xs text-muted-foreground">Governance infrastructure for institutional trade</p>
        </div>
      </div>
      <Tabs defaultValue={defaultTab ?? "signin"}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign in</TabsTrigger>
          <TabsTrigger value="signup">Create account</TabsTrigger>
        </TabsList>
        <TabsContent value="signin" className="pt-6">
          <SignInForm next={next} hideHeader hideFooterLink />
        </TabsContent>
        <TabsContent value="signup" className="pt-6">
          <SignUpForm next={next} hideHeader hideFooterLink />
        </TabsContent>
      </Tabs>
    </div>
  );
}
