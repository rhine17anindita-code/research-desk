"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import { AiButton } from "./AiButton";

export function StoryFeedback({ id, state, rating }: { id: string; state: string; rating: number }) {
  const router = useRouter();
  const [s, setS] = useState(state);
  const [r, setR] = useState(rating);
  const send = async (kind: string) => {
    await api(`/api/stories/${id}/feedback`, "POST", { kind });
    if (kind === "save") setS("saved");
    if (kind === "unsave" || kind === "restore") setS("new");
    if (kind === "dismiss") setS("dismissed");
    if (kind === "interesting") setR(1);
    if (kind === "uninteresting") setR(-1);
    if (kind === "clear") setR(0);
    router.refresh();
  };
  return (
    <div className="flex flex-wrap gap-0.5">
      <button className={`btn-ghost ${s === "saved" ? "!text-accent" : ""}`} onClick={() => send(s === "saved" ? "unsave" : "save")}>
        <Icon name="bookmark" size={14} /> {s === "saved" ? "Saved" : "Save"}
      </button>
      <button className={`btn-ghost ${r === 1 ? "!text-ok" : ""}`} onClick={() => send(r === 1 ? "clear" : "interesting")}>
        <Icon name="thumbUp" size={14} /> Interesting
      </button>
      <button className={`btn-ghost ${r === -1 ? "!text-bad" : ""}`} onClick={() => send(r === -1 ? "clear" : "uninteresting")}>
        <Icon name="thumbDown" size={14} />
      </button>
      {s === "dismissed" ? (
        <button className="btn-ghost" onClick={() => send("restore")}>Restore</button>
      ) : (
        <button className="btn-ghost" onClick={() => send("dismiss")}><Icon name="x" size={14} /> Hide</button>
      )}
    </div>
  );
}

export function BriefButton({ id, has }: { id: string; has: boolean }) {
  const router = useRouter();
  return (
    <AiButton
      label={has ? "Regenerate" : "Explain this story"}
      variant={has ? "ghost" : "ai"}
      size="sm"
      title="A short AI explanation, why it matters, and how outlets differ — from the coverage only."
      endpoint={`/api/stories/${id}/brief`}
      payload={{ regenerate: has }}
      confirm={has ? "always" : "auto"}
      onResult={() => router.refresh()}
    />
  );
}
