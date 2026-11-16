import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { buildDossier, dossierMarkdown } from "@/lib/research/dossier";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/** Minimal Markdown → elements for the dossier's own output (headings, lists, links, emphasis). */
function Md({ text }: { text: string }) {
  const inline = (s: string, k: string) =>
    s.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g).map((p, i) => {
      const link = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (link) return <a key={k + i} href={link[2]} className="text-accent underline">{link[1]}</a>;
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={k + i}>{p.slice(2, -2)}</strong>;
      if ((p.startsWith("*") && p.endsWith("*")) || (p.startsWith("_") && p.endsWith("_"))) return <em key={k + i} className="text-muted">{p.slice(1, -1)}</em>;
      return <span key={k + i}>{p}</span>;
    });
  const out: React.ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it, `l${out.length}-${i}`)}</li>);
    out.push(list.ordered ? <ol key={out.length} className="mb-3 list-decimal space-y-1 pl-6">{items}</ol> : <ul key={out.length} className="mb-3 list-disc space-y-1 pl-6">{items}</ul>);
    list = null;
  };
  for (const line of text.split("\n")) {
    const ul = line.match(/^- (.*)/);
    const ol = line.match(/^\d+\. (.*)/);
    if (ul || ol) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) {
        flush();
        list = { ordered, items: [] };
      }
      list.items.push((ul ?? ol)![1]);
      continue;
    }
    flush();
    if (line.startsWith("# ")) out.push(<h1 key={out.length} className="mb-2 font-serif text-[30px] font-semibold">{line.slice(2)}</h1>);
    else if (line.startsWith("## ")) out.push(<h2 key={out.length} className="mb-2 mt-8 border-b border-line pb-1 font-serif text-[21px] font-semibold">{line.slice(3)}</h2>);
    else if (line.startsWith("### ")) out.push(<h3 key={out.length} className="mb-1.5 mt-5 font-serif text-[16.5px] font-semibold">{line.slice(4)}</h3>);
    else if (line.trim()) out.push(<p key={out.length} className="mb-2.5 leading-relaxed">{inline(line, `p${out.length}`)}</p>);
  }
  flush();
  return <>{out}</>;
}

export default async function DossierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = buildDossier(getDb(), id);
  if (!d) notFound();
  return (
    <div className="mx-auto max-w-[780px] px-6 py-8 text-[14.5px] text-ink print:max-w-none print:p-0">
      <div className="mb-6 flex justify-end gap-2 print:hidden">
        <a className="btn" href={`/research/${id}`}>Back to project</a>
        <a className="btn" href={`/api/projects/${id}/export`}>Download .md</a>
        <PrintButton />
      </div>
      <article>
        <Md text={dossierMarkdown(d)} />
      </article>
    </div>
  );
}
