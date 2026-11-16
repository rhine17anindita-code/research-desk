"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * Story workspace frame: a collapsible left context column. Collapsing gives the
 * questions/answers and evidence columns the full width for long research sessions.
 */
export function StoryShell({ left, headline, children }: { left: React.ReactNode; headline: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("rd.storyContext") === "closed") setOpen(false);
    } catch {
      /* ignore */
    }
  }, []);
  const toggle = (v: boolean) => {
    setOpen(v);
    try {
      localStorage.setItem("rd.storyContext", v ? "open" : "closed");
    } catch {
      /* ignore */
    }
  };
  return (
    <div className={`grid gap-6 ${open ? "xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[340px_minmax(0,1fr)]" : ""}`}>
      {open ? (
        <div className="min-w-0">
          {/* Phones/tablets: context starts collapsed so the questions are visible first. */}
          <div className="mb-2 xl:hidden">
            <h1 className="font-serif text-[21px] font-semibold leading-tight tracking-tight">{headline}</h1>
            <button className="btn mt-2 !py-1 !text-[12px]" onClick={() => setMobileOpen((o) => !o)} aria-expanded={mobileOpen}>
              <Icon name={mobileOpen ? "up" : "down"} size={13} /> {mobileOpen ? "Hide story context" : "Story context, coverage & notes"}
            </button>
          </div>
          <div className={mobileOpen ? "" : "hidden xl:block"}>
          <div className="-mt-2 mb-1 hidden justify-end xl:flex">
            <button className="btn-ghost !px-1.5 !text-[12px]" onClick={() => toggle(false)} title="Hide story context">
              <Icon name="arrowLeft" size={13} /> Collapse panel
            </button>
          </div>
          {left}
          </div>
        </div>
      ) : (
        <div className="-mb-2 flex items-center gap-3">
          <button className="btn !py-1 !text-[12px]" onClick={() => toggle(true)}>
            <Icon name="panel" size={13} /> Show story context
          </button>
          <h1 className="truncate font-serif text-[18px] font-semibold tracking-tight">{headline}</h1>
        </div>
      )}
      {children}
    </div>
  );
}
