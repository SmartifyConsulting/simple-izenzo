import { useEffect, useRef, type ReactNode } from "react";
import { useWorkflowTemplate } from "@/lib/workflowTemplate";

/** Swaps the default trading wording (Bid, Counterparty, Seal Intent…) for the organisation's
 * template wording in all visible text inside. Does nothing for the default Izenzo template. */
export function RelabelScope({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const { templateKey, relabel } = useWorkflowTemplate();
  const active = templateKey !== "izenzo_default";

  useEffect(() => {
    const root = ref.current;
    if (!root || !active) return;
    const fix = (node: Node) => {
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const p = n.parentElement;
        if (!p || p.closest("input,textarea,[contenteditable='true'],script,style")) continue;
        const v = n.nodeValue ?? "";
        const next = relabel(v);
        if (next !== v) n.nodeValue = next;
      }
    };
    fix(root);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        if (m.type === "characterData") fix(m.target.parentNode ?? m.target);
        m.addedNodes.forEach(fix);
      }
    });
    obs.observe(root, { subtree: true, childList: true, characterData: true });
    return () => obs.disconnect();
  }, [active, relabel]);

  return <div ref={ref} className="contents">{children}</div>;
}
