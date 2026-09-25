import { describe, expect, it } from "vitest";
import { findRegisteredOrg } from "./counterpartyOutreach.functions";

/** A minimal stand-in for the Supabase query builder: `.from().select().ilike().limit()` — each
 * step returns itself except the last, which resolves with the rows the test hands it. Records
 * what the ilike filter was actually called with, so the "narrows by first word" behaviour is
 * checked too, not just the final match. */
function fakeSupabase(rows: { name: string; website: string | null; primary_contact_email: string | null }[]) {
  const calls: { table: string; pattern: string }[] = [];
  return {
    client: {
      from(table: string) {
        return {
          select() {
            return {
              ilike(_col: string, pattern: string) {
                calls.push({ table, pattern });
                return { limit: async () => ({ data: rows }) };
              },
            };
          },
        };
      },
    },
    calls,
  };
}

describe("findRegisteredOrg", () => {
  it("matches a registered org whose name differs only by suffix and punctuation (the SeedAxis case)", async () => {
    const { client, calls } = fakeSupabase([
      { name: "SeedAxis (Pty) Ltd", website: "https://seedaxis.example", primary_contact_email: "hello@seedaxis.example" },
    ]);
    const result = await findRegisteredOrg(client, "SeedAxis");
    expect(result).toEqual({ website: "https://seedaxis.example", primary_contact_email: "hello@seedaxis.example" });
    // Narrowed the DB query by a short prefix of the name's first significant word (not the whole
    // word, and not an exact match) — a short prefix still lands inside the registered name even
    // when it's spelled with a space the candidate name doesn't have ("Seed Axis" vs "SeedAxis").
    expect(calls[0]?.table).toBe("organisations");
    expect(calls[0]?.pattern).toBe("%seeda%");
  });

  it("matches regardless of case and extra whitespace", async () => {
    const { client } = fakeSupabase([
      { name: "  seedaxis   group  ", website: null, primary_contact_email: "info@seedaxis.example" },
    ]);
    const result = await findRegisteredOrg(client, "SEEDAXIS Group");
    expect(result?.primary_contact_email).toBe("info@seedaxis.example");
  });

  it("matches a registered org spelled with a space the candidate name doesn't have", async () => {
    const { client } = fakeSupabase([
      { name: "Seed Axis (Pty) Ltd", website: null, primary_contact_email: "hello@seedaxis.example" },
    ]);
    const result = await findRegisteredOrg(client, "SeedAxis");
    expect(result?.primary_contact_email).toBe("hello@seedaxis.example");
  });

  it("keeps two distinct companies apart even when they share their first word", async () => {
    const { client } = fakeSupabase([
      { name: "SeedAxis Renewables", website: null, primary_contact_email: "wrong@example.com" },
    ]);
    const result = await findRegisteredOrg(client, "SeedAxis Trading");
    expect(result).toBeNull();
  });

  it("returns null when nothing on file matches", async () => {
    const { client } = fakeSupabase([]);
    const result = await findRegisteredOrg(client, "SeedAxis");
    expect(result).toBeNull();
  });

  it("returns null rather than querying for an empty name", async () => {
    const { client, calls } = fakeSupabase([{ name: "Anything", website: null, primary_contact_email: null }]);
    const result = await findRegisteredOrg(client, "   ");
    expect(result).toBeNull();
    expect(calls.length).toBe(0);
  });
});
