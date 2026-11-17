import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getProduction } from "@/lib/production";
import { prompterText } from "@/lib/youtube/producer";
import { Prompter } from "@/components/youtube/Prompter";

export const dynamic = "force-dynamic";

export default async function PrompterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = getProduction(getDb(), id);
  if (!p) notFound();
  return <Prompter projectId={id} title={p.title} sections={prompterText(p.docs.script ?? "")} />;
}
