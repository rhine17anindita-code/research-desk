"use client";

import Link from "next/link";
import { useState } from "react";
import { FormatChip } from "../ideas/IdeaCard";
import { IdeaActions } from "../ideas/IdeaActions";
import { PitchCard } from "./PitchCard";
import type { Idea } from "@/lib/ideation/repo";

/** Everything you've kept, in one place: your own ideas, saved ideas, in development, made. */
export function Pipeline({ mine, saved, developing, made }: { mine: Idea[]; saved: Idea[]; developing: Idea[]; made: Idea[] }) {
  const [tab, setTab] = useState<"mine" | "saved" | "developing" | "made">(mine.length ? "mine" : "saved");
  const [openPitch, setOpenPitch] = useState<string | null>(null);
  const lists = { mine, saved, developing, made };
  const labels = { mine: "Your ideas", saved: "Saved", developing: "In development", made: "Made" };
  const items = lists[tab];
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1 border-b border-line">
        <h3 className="mr-3 pb-2 font-serif text-[17px] font-semibold">Your pipeline</h3>
        {(Object.keys(lists) as (keyof typeof lists)[]).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-2.5 pb-2 text-[13px] font-medium ${tab === k ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {labels[k]} <span className="text-[11.5px] text-muted">{lists[k].length}</span>
          </button>
        ))}
        <Link href="/ideas/saved" className="ml-auto pb-2 text-[12px] text-accent hover:underline">Board view</Link>
      </div>
      {items.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted">
          {tab === "mine" ? "Write an idea in the box at the top and press “Develop my idea”." : "Nothing here yet."}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((i) => (
            <li key={i.id} className="py-2.5">
              <div className="flex flex-wrap items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-0.5"><FormatChip format={i.format} /></div>
                  {i.origin === "user" ? (
                    <button className="text-left font-serif text-[15px] font-semibold leading-snug hover:underline" onClick={() => setOpenPitch(openPitch === i.id ? null : i.id)}>
                      {i.packaging?.titles[0] ?? i.title}
                    </button>
                  ) : (
                    <Link href={`/ideas/${i.id}`} className="font-serif text-[15px] font-semibold leading-snug hover:underline">{i.title}</Link>
                  )}
                  {(i.packaging?.firstSeconds || i.hook) && <p className="mt-0.5 line-clamp-1 text-[12.5px] italic text-ink-2">“{i.packaging?.firstSeconds || i.hook}”</p>}
                  {i.origin === "user" && <p className="text-[11.5px] text-muted">{i.expansion ? "Expanded" : "Not expanded yet"}{i.proposal ? " · proposal written" : ""}</p>}
                </div>
                <IdeaActions idea={i} size="sm" />
              </div>
              {openPitch === i.id && <div className="mt-3 rounded-lg border border-line p-3"><PitchCard initial={i} /></div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
