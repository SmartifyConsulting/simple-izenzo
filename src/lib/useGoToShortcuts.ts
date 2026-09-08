import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";

/** "g then <key>" navigation shortcuts, matching compliance-matching.lovable.app's sidebar hints
 * (Shortcut: g then o/c/r/t/k/b/s). Ignored while focus is in a text input, textarea, select, or
 * contenteditable element so typing "g" never gets hijacked. */
const GO_TO: Record<string, string> = {
  o: "/dashboard",
  c: "/discover",
  r: "/registry",
  t: "/trades",
  k: "/compliance",
  b: "/credits",
  s: "/account/settings",
};

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function useGoToShortcuts() {
  const navigate = useNavigate();
  const awaitingKey = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (awaitingKey.current) {
        awaitingKey.current = false;
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        const to = GO_TO[e.key.toLowerCase()];
        if (to) {
          e.preventDefault();
          navigate({ to });
        }
        return;
      }

      if (e.key.toLowerCase() === "g") {
        awaitingKey.current = true;
        timeoutRef.current = setTimeout(() => {
          awaitingKey.current = false;
        }, 1200);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [navigate]);
}
