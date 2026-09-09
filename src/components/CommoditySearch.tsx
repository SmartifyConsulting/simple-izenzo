import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** A searchable "Commodity or asset" field: suggests commodities already used elsewhere on the
 * platform (distinct values from `transactions.commodity`), and lets the user add a new one if
 * what they typed isn't in the list — it's still just free text on the `commodity` column, so
 * "adding" simply means using the typed value. */
export function CommoditySearch({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: known = [] } = useQuery({
    queryKey: ["known-commodities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions")
        .select("commodity")
        .not("commodity", "is", null)
        .limit(500);
      if (error) throw error;
      const seen = new Set<string>();
      const list: string[] = [];
      for (const row of data ?? []) {
        const c = (row.commodity ?? "").trim();
        if (!c || seen.has(c.toLowerCase())) continue;
        seen.add(c.toLowerCase());
        list.push(c);
      }
      return list.sort((a, b) => a.localeCompare(b));
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q ? known.filter((c) => c.toLowerCase().includes(q)) : known;
  const hasExactMatch = known.some((c) => c.toLowerCase() === q);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          placeholder={placeholder}
          className="pl-8"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
        />
      </div>
      {open && (filtered.length > 0 || (q && !hasExactMatch)) && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-md">
          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              className={cn(
                "block w-full px-3 py-2 text-left text-sm hover:bg-accent",
                c.toLowerCase() === q && "bg-accent",
              )}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            >
              {c}
            </button>
          ))}
          {q && !hasExactMatch && (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 border-t border-border px-3 py-2 text-left text-sm text-primary hover:bg-accent"
              onClick={() => {
                onChange(value.trim());
                setOpen(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add "{value.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
