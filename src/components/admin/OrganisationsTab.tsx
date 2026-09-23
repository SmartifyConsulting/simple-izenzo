import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const SUPERUSER_EMAIL = "georgia.adams@smartify.co.za";

type OrgRow = {
  id: string;
  name: string;
  country: string | null;
  industry: string | null;
  sector: string | null;
  credits: number;
  created_at: string;
  updated_at: string;
  website: string | null;
  address: string | null;
  registration_no: string | null;
  years_in_business: number | null;
  offerings: string | null;
  ai_brief: string | null;
  primary_contact_name: string | null;
  primary_contact_email: string | null;
  terms_of_trade: string | null;
  invite_code: string;
};
type MemberRow = { user_id: string; org_id: string; role: string };
type PersonRow = { id: string; email: string | null; full_name: string | null; org_id: string | null };

/** Every organisation, and which users belong to which — a person belongs to an organisation
 * through an explicit membership or through the organisation set on their profile. */
export function useOrgDirectory() {
  const orgs = useQuery({
    queryKey: ["admin-org-directory-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organisations")
        .select(
          "id, name, country, industry, sector, credits, created_at, updated_at, website, address, registration_no, years_in_business, offerings, ai_brief, primary_contact_name, primary_contact_email, terms_of_trade, invite_code",
        )
        .order("name");
      if (error) throw error;
      return (data ?? []) as OrgRow[];
    },
  });
  const members = useQuery({
    queryKey: ["admin-org-directory-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_members").select("user_id, org_id, role");
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });
  const people = useQuery({
    queryKey: ["admin-org-directory-people"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, email, full_name, org_id");
      if (error) throw error;
      return (data ?? []) as PersonRow[];
    },
  });

  const orgList = orgs.data ?? [];
  const memberList = members.data ?? [];
  const peopleList = people.data ?? [];
  const orgName = new Map(orgList.map((o) => [o.id, o.name]));

  /** orgId -> [{ person, role }] */
  const byOrg = new Map<string, { person: PersonRow; role: string | null }[]>();
  /** userId -> organisation names */
  const orgNamesByUser = new Map<string, string[]>();
  const person = new Map(peopleList.map((p) => [p.id, p]));

  const add = (orgId: string, userId: string, role: string | null) => {
    const p = person.get(userId);
    const name = orgName.get(orgId);
    if (!p || !name) return;
    const list = byOrg.get(orgId) ?? [];
    if (list.some((m) => m.person.id === userId)) return;
    list.push({ person: p, role });
    byOrg.set(orgId, list);
    const names = orgNamesByUser.get(userId) ?? [];
    if (!names.includes(name)) names.push(name);
    orgNamesByUser.set(userId, names);
  };
  for (const m of memberList) add(m.org_id, m.user_id, m.role);
  for (const p of peopleList) if (p.org_id) add(p.org_id, p.id, null);

  return {
    orgs: orgList,
    byOrg,
    orgNamesByUser,
    isLoading: orgs.isLoading || members.isLoading || people.isLoading,
  };
}

export function OrganisationsTab() {
  const { orgs, byOrg, isLoading } = useOrgDirectory();
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const visible = orgs.filter((o) => {
    if (!q) return true;
    const people = byOrg.get(o.id) ?? [];
    return (
      o.name.toLowerCase().includes(q) ||
      (o.country ?? "").toLowerCase().includes(q) ||
      people.some(
        (m) =>
          (m.person.email ?? "").toLowerCase().includes(q) ||
          (m.person.full_name ?? "").toLowerCase().includes(q),
      )
    );
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by organisation, country or user…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <Badge variant="secondary" className="font-normal">
          {visible.length} organisation{visible.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="overflow-hidden rounded-md border border-border">
        {isLoading ? (
          <p className="p-6 text-sm text-muted-foreground">Loading organisations…</p>
        ) : visible.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {orgs.length === 0 ? "No organisations yet." : "No organisations match your search."}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((o) => {
              const people = (byOrg.get(o.id) ?? []).filter((m) => m.person.email !== SUPERUSER_EMAIL);
              const open = openId === o.id;
              return (
                <li key={o.id} className="text-sm">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : o.id)}
                    aria-expanded={open}
                    className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[o.country, o.industry].filter(Boolean).join(" · ") || "No details captured"}
                      </p>
                    </div>
                    <div className="hidden shrink-0 text-xs text-muted-foreground sm:flex sm:gap-6">
                      <span>
                        <span className="block text-[10px] uppercase tracking-wide">Users</span>
                        {people.length}
                      </span>
                      <span>
                        <span className="block text-[10px] uppercase tracking-wide">Tokens</span>
                        {o.credits}
                      </span>
                      <span>
                        <span className="block text-[10px] uppercase tracking-wide">Created</span>
                        {new Date(o.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                    />
                  </button>
                  {open && (
                    <div className="border-t border-border bg-muted/20 px-4 py-3">
                      <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 border-b border-border pb-3 text-xs sm:grid-cols-3">
                        {[
                          ["Sector", o.sector ?? "—"],
                          ["Industry", o.industry ?? "—"],
                          ["Website", o.website ?? "—"],
                          ["Address", o.address ?? "—"],
                          ["Registration no.", o.registration_no ?? "—"],
                          ["Years in business", o.years_in_business != null ? String(o.years_in_business) : "—"],
                          ["Primary contact", o.primary_contact_name ?? "—"],
                          ["Contact email", o.primary_contact_email ?? "—"],
                          ["Invite code", o.invite_code],
                          ["Tokens", String(o.credits)],
                          ["Created", new Date(o.created_at).toLocaleDateString()],
                          ["Last updated", new Date(o.updated_at).toLocaleDateString()],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
                            <dd className="mt-0.5 truncate" title={value}>{value}</dd>
                          </div>
                        ))}
                        {o.offerings && (
                          <div className="col-span-2 min-w-0 sm:col-span-3">
                            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Offerings</dt>
                            <dd className="mt-0.5">{o.offerings}</dd>
                          </div>
                        )}
                        {o.terms_of_trade && (
                          <div className="col-span-2 min-w-0 sm:col-span-3">
                            <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Terms of trade</dt>
                            <dd className="mt-0.5">{o.terms_of_trade}</dd>
                          </div>
                        )}
                      </dl>
                      {people.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No users in this organisation yet.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {people.map((m) => (
                            <li key={m.person.id} className="flex items-center justify-between gap-3 text-xs">
                              <span className="min-w-0">
                                <span className="font-medium">{m.person.full_name ?? m.person.email}</span>
                                {m.person.full_name && (
                                  <span className="ml-2 text-muted-foreground">{m.person.email}</span>
                                )}
                              </span>
                              {m.role && (
                                <Badge variant="outline" className="font-normal capitalize">
                                  {m.role}
                                </Badge>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
