"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { InlineIdeas } from "./InlineIdeas";
import { timeAgo } from "@/lib/format";
import type { Statement } from "@/lib/ideation/statements";
import type { Opportunity } from "@/lib/ideation/opportunities";
import type { Inspiration } from "@/lib/ideation/repo";
import type { CreatorVideo } from "@/lib/ideation/creators";
import type { OwnChannel } from "@/lib/media";
import type { TalkEpisode } from "@/lib/ideation/talk";

/** Talk shows & podcasts: what hosts and guests are arguing about, as raw material for ideas. */
export function TalkSection({ bn, en, full }: { bn: TalkEpisode[]; en: TalkEpisode[]; full?: boolean }) {
  const [tab, setTab] = useState<"bn" | "en">(bn.length ? "bn" : "en");
  const list = (tab === "bn" ? bn : en).slice(0, full ? 30 : 5);
  return (
    <Section
      title="Talk shows & podcasts"
      hint="Claims, insider details and arguments from Bangladeshi and international shows — ideas to check, explain or challenge."
      more={full ? undefined : { href: "/ideas/talk", label: "All" }}
    >
      <div className="mb-2 flex gap-1">
        <button className={tab === "bn" ? "chip-accent" : "chip"} onClick={() => setTab("bn")}>Bangladesh ({bn.length})</button>
        <button className={tab === "en" ? "chip-accent" : "chip"} onClick={() => setTab("en")}>International ({en.length})</button>
      </div>
      <ul className={full ? "grid gap-x-6 md:grid-cols-2" : ""}>
        {list.map((e) => (
          <Expandable key={e.articleId} label="Ideas from this episode" payload={{ talkIds: [e.articleId] }}>
            <a href={e.url} target="_blank" rel="noreferrer" className="flex gap-2.5">
              {e.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[52px] w-[92px] shrink-0 rounded-lg bg-surface-2 object-cover" />
              )}
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink hover:underline">{e.title}</span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {e.show}{e.publishedAt ? ` · ${timeAgo(e.publishedAt)}` : ""}{e.views != null ? ` · ${compact(e.views)} views` : ""}{e.short ? " · clip" : ""}
                </span>
              </span>
            </a>
            {e.reasons.length > 0 && <div className="mt-1 text-[11.5px] leading-snug text-accent">{e.reasons.slice(0, 2).join(" · ")}</div>}
          </Expandable>
        ))}
        {!list.length && <li className="text-[12.5px] text-muted">No episodes yet — refresh feeds to pull the latest shows.</li>}
      </ul>
    </Section>
  );
}
import type { ChannelLinks } from "@/lib/channels";

/** The creator's own channel at a glance: totals, latest uploads, and how each did against the usual. */
export function YourChannelSection({ yt, links }: { yt: OwnChannel | null; links: ChannelLinks }) {
  const longs = yt?.recent.filter((v) => v.seconds == null || v.seconds > 180) ?? [];
  const median = (arr: number[]) => (arr.length ? [...arr].sort((a, b) => a - b)[Math.floor(arr.length / 2)] : 0);
  const typical = median((yt?.recent ?? []).map((v) => v.views));
  const best = Math.max(1, ...(yt?.recent ?? []).map((v) => v.views));
  const others = (["instagram", "facebook", "tiktok"] as const).filter((p) => links[p]);
  if (!yt && !links.youtube && !others.length) return null;
  return (
    <Section title="Your channel" hint={yt ? `Latest uploads vs your typical ${compact(typical)} views.` : links.youtube ? "Add the YouTube key to see your numbers." : undefined}>
      {yt && (
        <>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            {[
              ["Subscribers", yt.subscribers != null ? compact(yt.subscribers) : "hidden"],
              ["Total views", compact(yt.totalViews)],
              ["Videos", String(yt.videoCount)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-accent-soft px-2 py-2">
                <div className="font-serif text-[18px] font-bold text-ink">{v}</div>
                <div className="text-[10.5px] uppercase tracking-wide text-muted">{k}</div>
              </div>
            ))}
          </div>
          <ul className="space-y-2">
            {yt.recent.slice(0, 6).map((v) => {
              const x = typical ? v.views / typical : 0;
              return (
                <li key={v.id}>
                  <a href={v.url} target="_blank" rel="noreferrer" className="block">
                    <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
                      <span className="truncate text-ink-2 hover:underline">{v.title}</span>
                      <span className={`shrink-0 tabular-nums ${x >= 1.5 ? "font-semibold text-ok" : x && x < 0.6 ? "text-warn" : "text-muted"}`}>
                        {compact(v.views)}{x >= 1.5 ? ` · ${x.toFixed(1)}×` : ""}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-2" style={{ width: `${Math.max(3, (v.views / best) * 100)}%` }} />
                    </div>
                    <div className="mt-0.5 text-[10.5px] text-muted">
                      {timeAgo(v.publishedAt)}{v.seconds != null && v.seconds <= 180 ? " · Short" : ""}{v.comments ? ` · ${v.comments} comment${v.comments === 1 ? "" : "s"}` : ""}
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
          {longs.length === 0 && yt.recent.length > 0 && <p className="mt-2 text-[11.5px] text-muted">All recent uploads are Shorts.</p>}
        </>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {links.youtube && <a href={yt?.url ?? links.youtube} target="_blank" rel="noreferrer" className="chip hover:border-line-strong">YouTube ↗</a>}
        {others.map((p) => (
          <a key={p} href={links[p]} target="_blank" rel="noreferrer" className="chip hover:border-line-strong" title="Stats for this platform come in Phase 3 (CSV import until the API is approved)">
            {{ instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok" }[p]} ↗
          </a>
        ))}
        <Link href="/settings?tab=channels" className="chip hover:border-line-strong">Edit links</Link>
      </div>
    </Section>
  );
}

const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}K` : String(Math.round(n)));

export function CreatorsSection({ videos, hasKey }: { videos: CreatorVideo[]; hasKey: boolean }) {
  return (
    <Section title="What creators are making" hint={hasKey ? "Latest from your reference channels — breakouts first." : "Latest from your reference channels. Add the YouTube key to see views and breakouts."}>
      <ul>
        {videos.slice(0, 6).map((v) => (
          <Expandable
            key={v.url}
            label="Make my version"
            payload={{ focus: `Inspired by ${v.channel}'s video “${v.title}”${v.breakout && v.breakout > 1.5 ? ` (a breakout: ${v.breakout.toFixed(1)}× their usual views)` : ""}. Take what makes it work (topic type, curiosity gap, framing) and build ideas for THIS channel's audience from our own stories and research — not a copy.` }}
          >
            <a href={v.url} target="_blank" rel="noreferrer" className="flex gap-2.5">
              {v.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={v.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-[52px] w-[92px] shrink-0 rounded-lg bg-surface-2 object-cover" />
              )}
              <span className="min-w-0">
                <span className="line-clamp-2 text-[13px] font-medium leading-snug text-ink hover:underline">{v.title}</span>
                <span className="mt-0.5 block text-[11.5px] text-muted">
                  {v.channel}
                  {v.views != null && ` · ${compact(v.views)} views`}
                  {v.breakout != null && v.breakout >= 1.5 && <span className="ml-1 font-semibold text-accent">· {v.breakout.toFixed(1)}× breakout</span>}
                </span>
              </span>
            </a>
          </Expandable>
        ))}
        {!videos.length && <li className="text-[12.5px] text-muted">No recent videos yet — refresh feeds.</li>}
      </ul>
    </Section>
  );
}

function Section({ title, hint, children, more }: { title: string; hint?: string; children: React.ReactNode; more?: { href: string; label: string } }) {
  return (
    <section className="card p-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="font-serif text-[16px] font-semibold">{title}</h3>
        {more && <Link href={more.href} className="shrink-0 text-[12px] text-accent hover:underline">{more.label}</Link>}
      </div>
      {hint && <p className="-mt-1 mb-2 text-[11.5px] text-muted">{hint}</p>}
      {children}
    </section>
  );
}

/** One expandable row: click to reveal ideas built from it, right here. */
function Expandable({ children, payload, label }: { children: React.ReactNode; payload: Record<string, unknown>; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line py-2.5 last:border-0">
      {children}
      <button className="btn-ghost mt-1 !px-0 !text-[12px] !text-accent" onClick={() => setOpen((o) => !o)}>
        <Icon name={open ? "up" : "bulb"} size={12} /> {open ? "Close" : "Ideas from this"}
      </button>
      {open && <div className="mt-2"><InlineIdeas payload={payload} label={label} count={3} /></div>}
    </li>
  );
}

export function StatementsSection({ statements }: { statements: Statement[] }) {
  return (
    <Section title="Statements radar" hint="Consequential things public figures said — from today's coverage.">
      {statements.length === 0 ? (
        <p className="text-[12.5px] text-muted">No strong statements found in this channel&apos;s recent coverage.</p>
      ) : (
        <ul>
          {statements.slice(0, 7).map((s, i) => (
            <Expandable
              key={i}
              label="Ideas from this statement"
              payload={{
                clusterIds: s.clusterId ? [s.clusterId] : undefined,
                focus: `Build ideas around this statement by ${s.speaker}: “${s.quote}”. Explore what it really means, what's behind it, the consequences, what they didn't say, and the history of similar statements.`,
              }}
            >
              <blockquote className="font-serif text-[14.5px] leading-snug text-ink">“{s.quote}”</blockquote>
              <div className="mt-1 text-[12px] text-muted">
                <span className="font-medium text-ink-2">{s.speaker}</span> {s.verb} · <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">{s.publisher}</a> · {timeAgo(s.publishedAt)}
              </div>
              {s.clusterId && <Link href={`/story/${s.clusterId}`} className="block truncate text-[12px] text-muted hover:text-ink hover:underline">{s.headline}</Link>}
            </Expandable>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function UntoldSection({ opps }: { opps: Opportunity[] }) {
  return (
    <Section title="Untold stories" hint="Big potential, little coverage — scored for free." more={{ href: "/ideas/untold", label: "All" }}>
      <ul>
        {opps.slice(0, 6).map((o) => (
          <Expandable key={o.clusterId} label="Ideas from this story" payload={{ clusterIds: [o.clusterId] }}>
            <Link href={`/story/${o.clusterId}`} className="text-[13.5px] font-medium leading-snug text-ink hover:underline">{o.headline}</Link>
            <div className="text-[11.5px] leading-snug text-muted">{o.reasons[0]}</div>
          </Expandable>
        ))}
        {!opps.length && <li className="text-[12.5px] text-muted">Refresh feeds to find untold stories.</li>}
      </ul>
    </Section>
  );
}

export function PulseSection({ trends, mostRead, onThisDay, geo }: { trends: { term: string; traffic: string | null }[]; mostRead: { title: string; views: number }[]; onThisDay: { year: number; text: string }[]; geo: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const empty = !trends.length && !mostRead.length;
  useEffect(() => {
    if (!empty) return;
    setLoading(true);
    api("/api/pulse", "POST", {}).then(() => router.refresh()).catch(() => {}).finally(() => setLoading(false));
  }, [empty, router]);
  return (
    <Section title="What people are into right now" hint={`Trending searches (${geo}), Wikipedia's most-read, and this day in history.`}>
      {loading && <p className="text-[12px] text-muted">Checking trends…</p>}
      {trends.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {trends.slice(0, 10).map((t) => <span key={t.term} className="chip" title={`${t.traffic ?? ""} searches`}>{t.term}</span>)}
        </div>
      )}
      {mostRead.length > 0 && (
        <ul className="mb-2 space-y-0.5 text-[12.5px]">
          {mostRead.slice(0, 6).map((m) => <li key={m.title} className="flex justify-between gap-2"><span className="truncate text-ink-2">{m.title}</span><span className="shrink-0 tabular-nums text-muted">{Math.round(m.views / 1000)}k reads</span></li>)}
        </ul>
      )}
      {onThisDay.length > 0 && <p className="mb-2 text-[12.5px] text-ink-2"><span className="eyebrow mr-1">On this day</span>{onThisDay[0].year}: {onThisDay[0].text}</p>}
      {!empty && <InlineIdeas label="Ideas riding these" payload={{ sourceKinds: ["trend", "history"], focus: "Build on what large audiences are searching for and reading right now, and on today's anniversaries — connected to this channel's audience." }} count={4} />}
    </Section>
  );
}

export function InspirationSection({ items }: { items: Inspiration[] }) {
  return (
    <Section title="Your inspiration" hint="Paste links in the box at the top to add more." more={{ href: "/ideas/inspiration", label: "All" }}>
      <ul>
        {items.slice(0, 4).map((i) => (
          <Expandable key={i.id} label="Ideas from this" payload={{ inspirationId: i.id, clusterIds: i.matchedClusters.length ? i.matchedClusters.slice(0, 5) : undefined }}>
            <div className="text-[13px] font-medium leading-snug text-ink">{i.url ? <a href={i.url} target="_blank" rel="noreferrer" className="hover:underline">{i.title ?? i.url}</a> : i.title}</div>
            {i.note && <div className="line-clamp-2 text-[12px] text-muted">“{i.note}”</div>}
          </Expandable>
        ))}
        {!items.length && <li className="text-[12.5px] text-muted">Nothing yet — paste a reel, video or article above.</li>}
      </ul>
    </Section>
  );
}
