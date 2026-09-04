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
