import Link from "next/link";
import { getDb } from "@/lib/db";
import { findOpportunities } from "@/lib/ideation/opportunities";
import { UntoldList } from "@/components/ideas/UntoldList";

export const dynamic = "force-dynamic";

export default async function UntoldPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const days = Number(sp.days ?? 7);
  const opps = findOpportunities(getDb(), { limit: 40, days, excludeUsed: false });
  return (
    <>
    <h1 className="mb-4 font-serif text-[26px] font-semibold tracking-tight">Untold stories</h1>
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-muted">
          Stories in your database with the most room for an original angle: covered by regional outlets but missed internationally, conflicting accounts, money and power, historical hooks, your open questions, and themes from your inspirations. Scored locally — no AI. Pick some and turn them into ideas.
        </p>
        <div className="flex gap-1 text-[12.5px]">
          {[3, 7, 14, 30].map((d) => (
            <Link key={d} href={`/ideas/untold?days=${d}`} className={`rounded-full border px-2.5 py-0.5 ${d === days ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"}`}>
              {d} days
            </Link>
          ))}
        </div>
      </div>
      <UntoldList opps={opps} />
    </div>
    </>
  );
}
