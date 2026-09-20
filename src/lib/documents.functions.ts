import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 15 * 1024 * 1024;

/** Reads a stored bid document through the app's own address rather than the storage host.
 * Some browser extensions and ad blockers refuse to load the storage domain outright
 * (ERR_BLOCKED_BY_CLIENT), which killed both preview and download; going through this server
 * function means the browser only ever talks to this app. RLS still applies — the file is fetched
 * with the caller's own session, so nobody can read a document their policies don't allow. */
export const readDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase.storage
      .from("documents")
      .download(data.path);
    if (error || !file) throw new Error(error?.message ?? "This file could not be read.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error("This file is too large to preview here — please download it instead.");
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return {
      base64: btoa(binary),
      contentType: file.type || "application/octet-stream",
    };
  });

/** Same idea as readDocument, for the bug-report attachments bucket: the browser only ever talks to
 * this app, never the storage host that some browsers/extensions block. */
export const readBugAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: file, error } = await context.supabase.storage
      .from("bug-report-images")
      .download(data.path);
    if (error || !file) throw new Error(error?.message ?? "This attachment could not be read.");
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error("This file is too large to open here.");
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return {
      base64: btoa(binary),
      contentType: file.type || "application/octet-stream",
    };
  });
