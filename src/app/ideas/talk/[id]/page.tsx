import Link from "next/link";
import { TranslateNow } from "@/components/TranslateNow";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { getArticle } from "@/lib/repo/stories";
import { clock, findMoments, transcriptFor, watchUrl, windows } from "@/lib/transcripts";
import { getIdea, type Idea } from "@/lib/ideation/repo";
import { backingFor } from "@/lib/ideation/backing";
import { timeAgo } from "@/lib/format";
import { EpisodeMoments, MineEpisode } from "@/components/studio/Episode";
import { En, EnglishSwitch } from "@/components/English";
import { getTranslation, isBangla } from "@/lib/translate";
import type { Mined } from "@/lib/ideation/talk-mine";

export const dynamic = "force-dynamic";

/** One talk-show / podcast episode: what was said, the moments worth building on, and the AI read. */
export default async function EpisodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const a = getArticle(db, id);
  if (!a) notFound();
  const t = await transcriptFor(db, id);
  const ok = t?.status === "ok";
  const moments = ok ? findMoments(db, t!, 8) : [];
  // English translation (made free on your Mac) for Bangla transcripts, aligned window by window.
  const ws = ok ? windows(t!.segments) : [];
  const bangla = ok && isBangla(ws.slice(0, 5).map((w) => w.text).join(" "));
  const en = bangla ? getTranslation(db, "transcript", t!.videoId) : null;
  const enAt = (start: number) => {
    if (!en) return null;
    const i = ws.findIndex((w) => w.end > start);
    return en[Math.max(0, i)] ?? null;
  };
  const titleEn = isBangla(a.title) ? getTranslation(db, "article", id)?.[0] ?? null : null;
  const mined = (ok ? t!.mined : null) as Mined | null;
  const ideas = (mined?.ideaIds ?? []).map((i) => getIdea(db, i)).filter((x): x is Idea => !!x);
  return (
    <div className="mx-auto max-w-[1000px] space-y-5 px-4 py-6 sm:px-6">
      <Link href="/ideas/talk" className="text-[12.5px] text-accent hover:underline">← All talk shows & podcasts</Link>
      <header className="flex flex-wrap gap-4">
        {a.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={a.imageUrl} alt="" referrerPolicy="no-referrer" className="h-[110px] w-[196px] rounded-xl bg-surface-2 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-medium text-accent">{(a.publisher ?? "Talk show").replace(/ \(YouTube\)$/, "")}{a.publishedAt ? ` · ${timeAgo(a.publishedAt)}` : ""}</div>
          <h1 className="line-clamp-3 font-serif text-[21px] font-bold leading-tight">{a.title.replace(/(\s#[^\s#]+)+\s*$/, "")}</h1>
          <En text={titleEn} className="text-[14px] not-italic" />
          <a href={a.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-[12.5px] text-muted hover:text-ink hover:underline">Watch on YouTube ↗</a>
          {ok && (
            <p className="mt-1 text-[12px] text-muted">
              Transcript: {t!.kind === "asr" ? "automatic captions" : "captions"} ({t!.language}) · {Math.round(t!.chars / 1000)}K characters. Automatic captions mis-hear names and numbers — check the video before quoting.
            </p>
          )}
        </div>
      </header>

      {t?.status === "queued" ? (
        <div className="card px-4 py-4 text-[13px] text-muted">
          The transcript is on its way and appears here within about 10 minutes — refresh the page then. (If it never comes, connect the transcript service in Settings → Connections.)
        </div>
      ) : !ok ? (
        <div className="card px-4 py-4 text-[13px] text-muted">
          No transcript for this one{t?.error ? ` (${t.error})` : " — the show hasn't got captions on YouTube"}. You can still get ideas from its title and description on the talk-shows page.
        </div>
      ) : (
        <>
          {bangla && (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {!en && <TranslateNow kind="transcript" id={t!.videoId} />}
              <EnglishSwitch pending={false} />
            </div>
          )}
          <EpisodeMoments articleId={id} moments={moments.map((m) => ({ ...m, en: enAt(m.start) }))} />
          <MineEpisode articleId={id} mined={mined} ideas={ideas} backing={backingFor(db, ideas)} />
          <details className="card px-4 py-3">
            <summary className="cursor-pointer font-serif text-[16px] font-semibold">Full transcript</summary>
            <div className="mt-3 max-h-[600px] space-y-2 overflow-y-auto pr-2 text-[13px] leading-relaxed text-ink-2">
              {ws.map((w, i) => (
                <p key={w.start}>
                  <a href={watchUrl(t!.videoId, w.start)} target="_blank" rel="noreferrer" className="mr-2 font-mono text-[11.5px] text-accent hover:underline">{clock(w.start)}</a>
                  {w.text}
                  <En text={en?.[i]} className="mt-0.5" />
                </p>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
