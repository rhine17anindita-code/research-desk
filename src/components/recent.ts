"use client";

/** Recently opened research items, kept per browser (a convenience, not research data). */
export interface RecentItem {
  kind: "story" | "question" | "project" | "source";
  title: string;
  href: string;
  at: number;
}

const KEY = "rd.recent.v1";
const EVENT = "rd-recent-changed";

export function readRecent(): RecentItem[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? (v as RecentItem[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: Omit<RecentItem, "at">): void {
  try {
    const list = readRecent().filter((r) => r.href !== item.href);
    list.unshift({ ...item, at: Date.now() });
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage unavailable: nothing to remember */
  }
}

export function onRecentChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
