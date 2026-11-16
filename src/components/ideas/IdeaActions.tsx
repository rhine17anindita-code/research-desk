"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../api";
import { Icon } from "../Icon";
import type { Idea } from "@/lib/ideation/repo";

/** Status actions for a kept idea: develop, mark made, drop, restore. */
export function IdeaActions({ idea, size = "md" }: { idea: Idea; size?: "sm" | "md" }) {
  const router = useRouter();
  const set = async (status: string) => {
    await api(`/api/ideas/${idea.id}`, "PATCH", { status });
    router.refresh();
  };
  const sm = size === "sm" ? "!px-1.5 !py-0.5 !text-[12px]" : "";
  return (
    <div className="flex flex-wrap gap-1">
      {idea.projectId ? (
        <Link href={`/research/${idea.projectId}`} className={`btn ${sm}`}>
          <Icon name="research" size={13} /> Open project
        </Link>
      ) : (
        <button
          className={`btn-primary ${sm}`}
          onClick={async () => {
            const r = await api<{ projectId: string }>(`/api/ideas/${idea.id}/develop`, "POST", {});
            router.push(`/research/${r.projectId}`);
          }}
        >
          <Icon name="up" size={13} /> Develop
        </button>
      )}
      {idea.status !== "made" && (
        <button className={`btn ${sm}`} onClick={() => set("made")} title="You published something from this idea">
          <Icon name="check" size={13} /> Made it
        </button>
      )}
      {idea.status !== "dropped" && idea.status !== "skipped" ? (
        <button className={`btn-ghost ${sm}`} onClick={() => set("dropped")}>Drop</button>
      ) : (
        <button className={`btn-ghost ${sm}`} onClick={() => set("saved")}>Restore</button>
      )}
    </div>
  );
}
