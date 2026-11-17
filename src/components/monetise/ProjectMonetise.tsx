"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../api";
import type { MonItem, ProjectPlan } from "@/lib/monetise";

const SAFETY: Record<string, string> = { "brand-safe": "bg-ok-soft text-ok", mixed: "bg-warn-soft text-warn", sensitive: "bg-bad-soft text-bad" };
const bdt = (n: number) => `৳${Math.round(n).toLocaleString("en-IN")}`;

/** For one project: how to grow and earn from it — matched by topic, format and your goals. No AI. */
export function ProjectMonetise({ projectId }: { projectId: string }) {
  const [plan, setPlan] = useState<ProjectPlan | null>(null);
  const [open, setOpen] = useState(false);
  const [picks, setPicks] = useState<string[]>([]);
  useEffect(() => {
    if (!open || plan) return;
    api<{ plan: ProjectPlan }>(`/api/projects/${projectId}/monetise`).then((r) => {
      setPlan(r.plan);
      setPicks(r.plan?.picks ?? []);
    });
  }, [open, plan, projectId]);
  const toggle = async (id: string) => {
    const next = picks.includes(id) ? picks.filter((x) => x !== id) : [...picks, id];
    setPicks(next);
    await api(`/api/projects/${projectId}/monetise`, "PATCH", { picks: next });
  };
  const Items = ({ title, items }: { title: string; items: MonItem[] }) =>
    items.length ? (
      <div>
        <h3 className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.id} className="flex items-start gap-2 text-[12.5px]">
              <input type="checkbox" className="mt-1" checked={picks.includes(i.id)} onChange={() => toggle(i.id)} title="Plan to use this" />
              <span>
                <b className="text-ink">{i.title}.</b> <span className="text-ink-2">{i.how}</span>
                {i.example && <span className="block italic text-muted">{i.example}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <section className="card overflow-hidden">
      <button className="flex w-full items-center justify-between bg-ok-soft/40 px-4 py-3 text-left" onClick={() => setOpen((o) => !o)}>
        <span>
          <span className="font-serif text-[18px] font-semibold">Monetise & grow this</span>
          <span className="ml-2 text-[12px] text-muted">CTAs, follow-ups, sponsor fit and price — optional, no AI</span>
        </span>
        <span className="text-[12px] text-accent">{open ? "Close" : "Open"}</span>
      </button>
      {open && !plan && <p className="px-4 py-3 text-[12.5px] text-muted">Reading the project…</p>}
      {open && plan && (
        <div className="space-y-4 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${SAFETY[plan.safety.level]}`}>{plan.safety.level === "brand-safe" ? "Brand-friendly" : plan.safety.level === "mixed" ? "Some brands will pass" : "Sensitive for brands"}</span>
            <span className="text-muted">Topics: {plan.topics.join(", ") || "general"} · format: {plan.format}</span>
            {plan.price && <span className="ml-auto font-semibold text-ink">Sponsor price for this: {bdt(plan.price.low)}–{bdt(plan.price.high)}</span>}
          </div>
          <p className="text-[12.5px] text-ink-2">{plan.safety.note}</p>
          <div className="grid gap-4 md:grid-cols-2">
            <Items title="Grow from it (calls to action)" items={plan.growth} />
            <Items title="Build on it afterwards" items={plan.followups} />
            <Items title={plan.safety.level === "sensitive" ? "Support that suits serious topics" : "Sponsor segment that won't hurt the video"} items={plan.integrations} />
            <Items title="Your own offers & community" items={plan.offers} />
          </div>
          {plan.categories.length > 0 && (
            <div>
              <h3 className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted">Who might sponsor this</h3>
              <ul className="space-y-1 text-[12.5px]">
                {plan.categories.map((c) => (
                  <li key={c.id}>
                    <b className="text-ink">{c.label}:</b> <span className="text-ink-2">{c.angle}</span>{" "}
                    <span className="text-muted">{plan.sponsors.filter((s) => s.category === c.id).map((s) => s.name).join(", ")}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {plan.series.length > 0 && (
            <p className="text-[12.5px] text-ink-2">
              <b>Could be an episode of:</b> {plan.series.map((s) => s.name).join(", ")} — series sell better than one-off videos.
            </p>
          )}
          <div className="flex flex-wrap gap-3 text-[12.5px]">
            <Link href="/monetise?tab=proposals" className="text-accent hover:underline">Make a proposal →</Link>
            <Link href="/monetise?tab=playbook" className="text-accent hover:underline">Edit your playbook →</Link>
            <span className="text-muted">Ticked ideas are saved with this project.</span>
          </div>
        </div>
      )}
    </section>
  );
}
