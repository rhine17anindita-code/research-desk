"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiButton } from "./AiButton";

const FORMATS: [string, string][] = [
  ["youtube-explainer", "YouTube explainer (6–12 min)"],
  ["short-video", "Short video / reel"],
  ["article", "Explanatory article"],
  ["investigation", "Investigative piece"],
  ["thread", "Social thread"],
];

/** Turn the project's research into output. AI drafts land in Notes, marked as assistant drafts. */
export function CreatorPanel({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [format, setFormat] = useState("youtube-explainer");
  const [angle, setAngle] = useState("");
  return (
    <section className="card p-4">
      <h2 className="font-serif text-[18px] font-semibold">Create from this research</h2>
      <p className="mb-3 text-[12.5px] text-muted">Drafts are grounded in this project&apos;s sources and saved to Notes below, marked as AI drafts with numbered sources and a list of claims to verify.</p>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="eyebrow mb-1.5">Angles & hooks</div>
          <p className="mb-2 text-[12.5px] text-ink-2">4–6 distinct angles, each with an opening hook, format, why-now and what to verify.</p>
          <AiButton label="Find angles & hooks" endpoint={`/api/projects/${projectId}/angles`} confirm="always" runningLabel="Finding angles…" onResult={() => router.refresh()} />
        </div>
        <div>
          <div className="eyebrow mb-1.5">Outline</div>
          <div className="mb-2 flex flex-col gap-1.5">
            <select className="input !py-1 text-[13px]" value={format} onChange={(e) => setFormat(e.target.value)}>
              {FORMATS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
            <input className="input !py-1 text-[13px]" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="Angle to take (optional — paste one from above)" />
          </div>
          <AiButton label="Draft outline" endpoint={`/api/projects/${projectId}/outline`} payload={{ format, angle: angle || undefined }} confirm="always" runningLabel="Drafting outline…" onResult={() => router.refresh()} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
        <a className="btn" href={`/research/${projectId}/dossier`}>Open printable dossier</a>
        <a className="btn" href={`/api/projects/${projectId}/export`}>Download dossier (.md)</a>
        <span className="self-center text-[12px] text-muted">Free: stories, questions, answers with numbered references, sources and notes.</span>
      </div>
    </section>
  );
}
