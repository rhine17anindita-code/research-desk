"use client";

import { useEffect, useSyncExternalStore } from "react";
import { api } from "./api";
import type { LiveStatus } from "@/lib/live";

/**
 * Keeps an eye on the desk while any page is open: polls what's new every 2 minutes,
 * puts the count in the tab title, and (if allowed) shows a desktop notification when
 * a story in this channel's focus starts spiking. Free: reads the local database only.
 */

let current: LiveStatus | null = null;
const listeners = new Set<() => void>();
const publish = (s: LiveStatus) => {
  current = s;
  listeners.forEach((l) => l());
};
export const useLive = () =>
  useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => current,
    () => null,
  );

export async function pollLive() {
  try {
    const r = await api<{ live: LiveStatus }>("/api/live");
    publish(r.live);
    return r.live;
  } catch {
    return null;
  }
}

const NOTIFIED = "rd.notified";
function notifySpikes(s: LiveStatus) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  let seen: string[] = [];
  try {
    seen = JSON.parse(localStorage.getItem(NOTIFIED) ?? "[]");
  } catch {}
  for (const st of s.spiking) {
    if (seen.includes(st.id)) continue;
    const n = new Notification(`Spiking: ${st.headline}`, { body: `${st.sources} outlets · ${st.why}`, tag: st.id });
    n.onclick = () => {
      window.focus();
      location.href = `/story/${st.id}`;
    };
    seen.push(st.id);
  }
  try {
    localStorage.setItem(NOTIFIED, JSON.stringify(seen.slice(-100)));
  } catch {}
}

export function LiveWatcher() {
  const live = useLive();
  useEffect(() => {
    const run = () => pollLive().then((s) => s && notifySpikes(s));
    run();
    const t = setInterval(run, 120_000);
    const onFocus = () => run();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    const n = (live?.fresh.length ?? 0) + (live?.spiking.length ? 1 : 0);
    document.title = n ? `(${n}) ${base}` : base;
  }, [live]);
  return null;
}
