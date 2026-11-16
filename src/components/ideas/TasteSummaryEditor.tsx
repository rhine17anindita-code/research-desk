"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../api";
import { AiButton } from "../AiButton";

export function TasteSummaryEditor({ initial, eventsSince }: { initial: string; eventsSince: number }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <textarea
        className="input min-h-[130px] text-[13.5px] leading-relaxed"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nothing learned yet. Browse and save/skip some ideas, add inspirations, then update from your activity — or write it yourself."
      />
      <div className="mt-2 flex flex-wrap items-start gap-2">
        <button
          className="btn"
          disabled={text === initial}
          onClick={async () => {
            await api("/api/settings", "PATCH", { "taste.summary": text });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            router.refresh();
          }}
        >
          Save edits
        </button>
        <AiButton
          label={eventsSince ? `Update from my activity (${eventsSince} new)` : "Update from my activity"}
          endpoint="/api/taste"
          onResult={() => {
            router.refresh();
            setTimeout(() => window.location.reload(), 300);
          }}
        />
        {saved && <span className="self-center text-[12px] text-ok">Saved</span>}
      </div>
    </div>
  );
}
