import Link from "next/link";
import { getDb } from "@/lib/db";
import { listIdeas, type IdeaStatus } from "@/lib/ideation/repo";
import { FormatChip } from "@/components/ideas/IdeaCard";
import { IdeaActions } from "@/components/ideas/IdeaActions";
import { NewIdeaForm } from "@/components/ideas/NewIdeaForm";
import { CONTENT_FORMATS } from "@/lib/ideation/formats";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const COLUMNS: { status: IdeaStatus; label: string; hint: string }[] = [
  { status: "saved", label: "Saved", hint: "Kept from the deck or added by you" },
  { status: "developing", label: "Developing", hint: "Has a research project" },
  { status: "made", label: "Made", hint: "Published" },
];

export default async function SavedIdeasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = getDb();
  const all = listIdeas(db, { status: ["saved", "developing", "made"], format: sp.format || undefined, medium: sp.medium || undefined, limit: 500 });
  const skipped = listIdeas(db, { status: ["skipped", "dropped"], limit: 30 });

  return (
    <>
    <h1 className="mb-4 font-serif text-[26px] font-semibold tracking-tight">Saved ideas</h1>
    <div className="space-y-6">
      <form className="flex flex-wrap gap-2" action="/ideas/saved">
        <select name="medium" defaultValue={sp.medium ?? ""} className="input !w-auto">
          <option value="">Visual + written</option>
          <option value="visual">Visual</option>
          <option value="written">Written</option>
        </select>
        <select name="format" defaultValue={sp.format ?? ""} className="input !w-auto">
          <option value="">Any format</option>
          {CONTENT_FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </select>
        <button className="btn">Filter</button>
      </form>

      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = all.filter((i) => i.status === col.status);
          return (
            <section key={col.status}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <span className="eyebrow">{col.label} · {items.length}</span>
                <span className="text-[11px] text-muted">{col.hint}</span>
              </div>
              <div className="flex min-h-[100px] flex-col gap-2 rounded-lg bg-surface-2/60 p-1.5">
                {items.map((i) => (
                  <div key={i.id} className="card px-3 py-2.5">
                    <div className="mb-1"><FormatChip format={i.format} /></div>
                    <Link href={`/ideas/${i.id}`} className="block font-serif text-[15px] font-semibold leading-snug hover:underline">{i.title}</Link>
                    {i.hook && <p className="mt-1 line-clamp-2 text-[12.5px] italic text-ink-2">“{i.hook}”</p>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted">{timeAgo(i.updatedAt)}{i.reason ? ` · ${i.reason}` : ""}</span>
                    </div>
                    <div className="mt-1.5"><IdeaActions idea={i} size="sm" /></div>
                  </div>
                ))}
                {!items.length && <p className="px-2 py-4 text-center text-[12px] text-muted">Nothing here yet.</p>}
              </div>
            </section>
          );
        })}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <NewIdeaForm />
        <div>
          <div className="eyebrow mb-2">Recently skipped or dropped</div>
          <ul className="space-y-1 text-[13px]">
            {skipped.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <Link href={`/ideas/${i.id}`} className="truncate text-muted hover:text-ink">{i.title}</Link>
                <span className="shrink-0 text-[11px] text-muted">{i.reason ?? i.status}</span>
              </li>
            ))}
            {!skipped.length && <li className="text-muted">None.</li>}
          </ul>
        </div>
      </div>
    </div>
    </>
  );
}
