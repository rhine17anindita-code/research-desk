"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { CONTENT_FORMATS } from "@/lib/ideation/formats";

/** Jot down your own idea (no AI); it joins the Saved board. */
export function NewIdeaForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [angle, setAngle] = useState("");
  const [format, setFormat] = useState("youtube-long");
  return (
    <div className="card p-4">
      <div className="eyebrow mb-2">Add your own idea</div>
      <input className="input mb-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Working title" />
      <textarea className="input mb-2 min-h-[56px] text-[13px]" value={angle} onChange={(e) => setAngle(e.target.value)} placeholder="The angle — what's untold about it?" />
      <div className="flex gap-2">
        <select className="input !w-auto" value={format} onChange={(e) => setFormat(e.target.value)}>
          {CONTENT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <button
          className="btn-primary"
          disabled={!title.trim()}
          onClick={async () => {
            await api("/api/ideas", "POST", { title, angle: angle || undefined, format });
            setTitle("");
            setAngle("");
            router.refresh();
          }}
        >
          Add idea
        </button>
      </div>
    </div>
  );
}
