import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { when } from "@/lib/tx";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({
    meta: [
      { title: "Support — Izenzo" },
      { name: "description", content: "Submit and track support tickets." },
    ],
  }),
  component: SupportPage,
});

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  waiting_on_customer: "Waiting on you",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

function SupportPage() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [form, setForm] = useState({ subject: "", description: "", priority: "medium" });

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["my-support-tickets"],
    enabled: Boolean(profile?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["support-ticket-messages", selectedId],
    enabled: Boolean(selectedId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_ticket_messages")
        .select("*")
        .eq("ticket_id", selectedId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.subject.trim() || !form.description.trim()) {
      toast.error("Subject and description are required.");
      return;
    }
    const { error } = await supabase.rpc("support_create_ticket", {
      p_subject: form.subject,
      p_description: form.description,
      p_priority: form.priority as "low" | "medium" | "high" | "urgent",
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Ticket submitted");
    setShowForm(false);
    setForm({ subject: "", description: "", priority: "medium" });
    await qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
  }

  async function sendReply() {
    if (!selectedId || !reply.trim()) return;
    const { error } = await supabase.rpc("support_customer_reply", {
      p_ticket_id: selectedId,
      p_body: reply,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setReply("");
    await qc.invalidateQueries({ queryKey: ["support-ticket-messages", selectedId] });
    await qc.invalidateQueries({ queryKey: ["my-support-tickets"] });
  }

  const selected = tickets.find((t) => t.id === selectedId);

  return (
    <AppShell
      pureBlack
      title="Support"
      description="Submit and track support tickets"
      actions={
        <Button
          size="sm"
          onClick={() => {
            setSelectedId(null);
            setShowForm((v) => !v);
          }}
        >
          {showForm ? "Close" : "New ticket"}
        </Button>
      }
    >
      {showForm && (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-border bg-card p-7">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">New ticket</p>
          <h2 className="mt-1 text-lg font-semibold">Log a support request</h2>
          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="priority">Priority</Label>
              <select
                id="priority"
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" required rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
          <div className="mt-6 text-right">
            <Button type="submit" size="sm">
              Submit ticket
            </Button>
          </div>
        </form>
      )}

      {selected ? (
        <div className="space-y-4">
          <Button size="sm" variant="ghost" onClick={() => setSelectedId(null)}>
            ← Back to tickets
          </Button>
          <div className="rounded-2xl border border-border bg-card p-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">{selected.subject}</p>
              <Badge variant="secondary" className="font-normal">
                {STATUS_LABEL[selected.status] ?? selected.status}
              </Badge>
            </div>
            <ul className="mt-4 space-y-3">
              {messages.map((m) => (
                <li key={m.id} className="rounded-md bg-muted/40 p-3 text-sm">
                  <p>{m.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{when(m.created_at)}</p>
                </li>
              ))}
            </ul>
            {!["resolved", "closed"].includes(selected.status) && (
              <div className="mt-4 space-y-2">
                <Textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add a reply…" />
                <div className="text-right">
                  <Button size="sm" onClick={sendReply}>
                    Send
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : tickets.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No support tickets yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {tickets.map((t) => (
                <li
                  key={t.id}
                  className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 hover:bg-muted/40"
                  onClick={() => setSelectedId(t.id)}
                >
                  <div>
                    <p className="text-sm font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.priority} priority · Submitted {when(t.created_at)}
                    </p>
                  </div>
                  <Badge variant="secondary" className="font-normal">
                    {STATUS_LABEL[t.status] ?? t.status}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </AppShell>
  );
}
