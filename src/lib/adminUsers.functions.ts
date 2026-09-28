import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SUPERUSER_EMAIL = "georgia.adams@smartify.co.za";

async function assertAdmin(supabase: { rpc: (...a: never[]) => unknown }, userId: string) {
  const { data } = (await (supabase as unknown as {
    rpc: (f: string, a: object) => Promise<{ data: boolean | null }>;
  }).rpc("has_role", { _user_id: userId, _role: "admin" }));
  if (!data) throw new Error("Only administrators can manage users.");
}

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
        firstName: z.string().trim().min(1).max(100),
        lastName: z.string().trim().max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.firstName, last_name: data.lastName ?? null },
    });
    if (error) throw new Error(error.message);
    const id = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .upsert(
        { id, email: data.email, full_name: data.firstName, last_name: data.lastName ?? null },
        { onConflict: "id" },
      );
    return { id };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as never, context.userId);
    if (data.userId === context.userId) throw new Error("You can't delete your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (target.user?.email?.toLowerCase() === SUPERUSER_EMAIL) {
      throw new Error("This account is protected and can't be deleted.");
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
