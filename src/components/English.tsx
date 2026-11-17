"use client";

import { useEffect, useState } from "react";

/**
 * English translations of Bangla content (headlines translated free on the server). One switch for the whole app,
 * remembered on this device; on by default.
 */
const KEY = "rd.english";
const EVT = "rd-english";

export function useShowEnglish(): [boolean, (v: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    try {
      setOn(localStorage.getItem(KEY) !== "0");
    } catch {}
    const h = (e: Event) => setOn((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);
  const set = (v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {}
    window.dispatchEvent(new CustomEvent(EVT, { detail: v }));
  };
  return [on, set];
}

export function EnglishSwitch({ pending }: { pending?: boolean }) {
  const [on, set] = useShowEnglish();
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px]">
      <button className={on ? "chip-accent" : "chip"} onClick={() => set(!on)} title="Show English translations of Bangla text">
        English {on ? "on" : "off"}
      </button>
      {pending && on && <span className="text-muted">translation coming…</span>}
    </span>
  );
}

/** An English line under Bangla text, when translations are switched on. */
export function En({ text, className = "" }: { text: string | null | undefined; className?: string }) {
  const [on] = useShowEnglish();
  if (!on || !text) return null;
  return <span className={`block text-[0.92em] italic text-accent/90 ${className}`}>{text}</span>;
}
