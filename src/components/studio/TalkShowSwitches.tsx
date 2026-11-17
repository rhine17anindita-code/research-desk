"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";

type Show = { id: string; name: string; language: string; on: boolean };

/** Which talk shows this channel follows. */
export function TalkShowSwitches({ initial, channel }: { initial: Show[]; channel: string }) {
  const router = useRouter();
  const [shows, setShows] = useState(initial);
  const group = (lang: string) => shows.filter((s) => (lang === "bn" ? s.language === "bn" : s.language !== "bn"));
  return (
    <details className="card px-4 py-3">
      <summary className="cursor-pointer font-serif text-[16px] font-semibold">
        Shows for {channel} <span className="text-[12px] font-normal text-muted">({shows.filter((s) => s.on).length} of {shows.length} on)</span>
      </summary>
      {(["bn", "en"] as const).map((lang) => (
        <div key={lang} className="mt-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{lang === "bn" ? "Bangladesh" : "International"}</div>
          <div className="flex flex-wrap gap-1.5">
            {group(lang).map((s) => (
              <button
                key={s.id}
                className={s.on ? "chip-accent" : "chip line-through opacity-60"}
                onClick={async () => {
                  const r = await api<{ shows: Show[] }>("/api/talk/shows", "POST", { feedId: s.id, on: !s.on });
                  setShows(r.shows);
                  router.refresh();
                }}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </details>
  );
}
