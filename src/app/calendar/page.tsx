import { getDb } from "@/lib/db";
import { listProductions } from "@/lib/production";
import { listIdeas } from "@/lib/ideation/repo";
import { CalendarBoard } from "@/components/CalendarBoard";

export const dynamic = "force-dynamic";

/** Content calendar: what goes out when, how far along each piece is, and saved ideas waiting for a slot. */
export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams;
  const db = getDb();
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : new Date().toISOString().slice(0, 7);
  const items = listProductions(db);
  const ideas = listIdeas(db, { status: "saved", limit: 40 }).map((i) => ({ id: i.id, title: i.title, format: i.format }));
  return (
    <div className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-8">
      <CalendarBoard month={month} items={items} ideas={ideas} today={new Date().toISOString().slice(0, 10)} />
    </div>
  );
}
