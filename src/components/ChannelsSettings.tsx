"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";
import { Icon } from "./Icon";
import type { Channel } from "@/lib/channels";

interface FeedLite { id: string; name: string; category: string; region: string | null; enabled: number }

const TEMPLATES: [string, string][] = [
  ["news", "News, politics & current affairs"],
  ["culture", "Books, film, music & culture"],
  ["business", "Business, tech & science"],
  ["blank", "Start empty (pick sources yourself)"],
];

function ChannelCard({ ch, feeds, members, active, onlyOne }: { ch: Channel; feeds: FeedLite[]; members: string[]; active: boolean; onlyOne: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: ch.name, description: ch.description ?? "", profile: ch.profile, geo: ch.geo, dailyIdeas: ch.dailyIdeas, color: ch.color, newsRatio: ch.newsRatio,
    boostTerms: ch.boostTerms.join(", "), muteTerms: ch.muteTerms.join(", "), goodExamples: ch.goodExamples, badExamples: ch.badExamples, referenceCreators: ch.referenceCreators,
  });
  const [inChannel, setIn] = useState(new Set(members));
  const [showSources, setShowSources] = useState(false);
  const [saved, setSaved] = useState(false);
  const byCat = feeds.reduce<Record<string, FeedLite[]>>((m, x) => ((m[x.category] ??= []).push(x), m), {});

  const toggle = async (feedId: string, on: boolean) => {
    await api(`/api/channels/${ch.id}/feeds`, "POST", { feedId, on });
    setIn((s) => {
      const n = new Set(s);
      if (on) n.add(feedId);
      else n.delete(feedId);
      return n;
    });
  };

  return (
    <section className={`card p-4 ${active ? "border-accent/50" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input className="input !w-auto flex-1 font-serif !text-[17px] font-semibold" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        {active ? (
          <span className="chip border-accent/40 text-accent">Active</span>
        ) : (
          <button className="btn" onClick={async () => { await api("/api/channels/active", "POST", { id: ch.id }); router.refresh(); }}>Switch to this</button>
        )}
        {!onlyOne && (
          <button
            className="btn-ghost !px-1.5"
            title="Delete channel (its ideas and projects move to another channel)"
            onClick={async () => {
              if (!confirm(`Delete the channel “${ch.name}”? Its ideas, inspirations and projects are kept and moved to another channel.`)) return;
              await api(`/api/channels/${ch.id}`, "DELETE");
              router.refresh();
            }}
          >
            <Icon name="trash" size={14} />
          </button>
        )}
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_140px]">
        <input className="input text-[13px]" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="One line: what this channel covers" />
        <input className="input text-[13px]" value={f.geo} onChange={(e) => setF({ ...f, geo: e.target.value })} placeholder="Trends country (BD, US, GB…)" title="Country code for trending searches" />
      </div>
      <label className="label mt-3">Profile — who it's for, tone, formats, what you want more of</label>
      <textarea
        className="input min-h-[110px] text-[13px] leading-relaxed"
        value={f.profile}
        onChange={(e) => setF({ ...f, profile: e.target.value })}
        placeholder="e.g. YouTube + Reels for 18–35 Bangladeshis. Punchy, myth-busting, 'the real story behind' energy. Loves hidden history, money and power, and anything that reframes something everyone thinks they know."
      />
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div>
          <label className="label">Ideas you&apos;d jump on (titles or one-liners, one per line)</label>
          <textarea className="input min-h-[110px] text-[12.5px]" value={f.goodExamples} onChange={(e) => setF({ ...f, goodExamples: e.target.value })} />
        </div>
        <div>
          <label className="label">Ideas that bore you (and why)</label>
          <textarea className="input min-h-[110px] text-[12.5px]" value={f.badExamples} onChange={(e) => setF({ ...f, badExamples: e.target.value })} />
        </div>
        <div>
          <label className="label">Prioritise (people, places, topics — comma separated)</label>
          <input className="input text-[12.5px]" value={f.boostTerms} onChange={(e) => setF({ ...f, boostTerms: e.target.value })} />
        </div>
        <div>
          <label className="label">Play down unless major</label>
          <input className="input text-[12.5px]" value={f.muteTerms} onChange={(e) => setF({ ...f, muteTerms: e.target.value })} />
        </div>
        <div>
          <label className="label">Creators whose style to aim for</label>
          <input className="input text-[12.5px]" value={f.referenceCreators} onChange={(e) => setF({ ...f, referenceCreators: e.target.value })} />
        </div>
        <div>
          <label className="label">News vs evergreen: {f.newsRatio}% news · {100 - f.newsRatio}% evergreen</label>
          <input type="range" min={0} max={100} step={10} value={f.newsRatio} onChange={(e) => setF({ ...f, newsRatio: Number(e.target.value) })} className="w-full" />
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span className="label !mb-0">Colour</span>
        {["coral", "teal", "violet", "amber", "blue", "rose", "green"].map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setF({ ...f, color: c })}
            className={`h-6 w-6 rounded-full ch-dot-${c} ${f.color === c ? "ring-2 ring-offset-2 ring-ink/40" : ""}`}
          />
        ))}
      </div>
      <label className="mt-2 flex items-center gap-2 text-[13px] text-ink-2">
        <input type="checkbox" checked={f.dailyIdeas} onChange={(e) => setF({ ...f, dailyIdeas: e.target.checked })} />
        Start each day with a fresh batch of ideas for this channel (one AI call per day, counted in your budget)
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="btn-primary"
          onClick={async () => {
            await api(`/api/channels/${ch.id}`, "PATCH", f);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
            router.refresh();
          }}
        >
          Save channel
        </button>
        {saved && <span className="text-[12px] text-ok">Saved</span>}
        <button className="btn-ghost ml-auto !text-[12.5px]" onClick={() => setShowSources((s) => !s)}>
          <Icon name={showSources ? "up" : "down"} size={13} /> Sources ({inChannel.size})
        </button>
      </div>
      {showSources && (
        <div className="mt-3 grid gap-3 border-t border-line pt-3 md:grid-cols-2">
          {Object.entries(byCat).map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-1 flex items-center justify-between">
                <span className="eyebrow">{cat}</span>
                <button
                  className="btn-ghost !px-1 !py-0 !text-[11.5px]"
                  onClick={async () => {
                    const allOn = list.every((x) => inChannel.has(x.id));
                    for (const x of list) await toggle(x.id, !allOn);
                  }}
                >
                  {list.every((x) => inChannel.has(x.id)) ? "None" : "All"}
                </button>
              </div>
              {list.map((x) => (
                <label key={x.id} className={`flex items-center gap-2 py-0.5 text-[12.5px] ${x.enabled ? "text-ink-2" : "text-muted line-through"}`}>
                  <input type="checkbox" checked={inChannel.has(x.id)} onChange={(e) => toggle(x.id, e.target.checked)} />
                  {x.name}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function ChannelsSettings({ channels, active, feeds, membership }: { channels: Channel[]; active: string; feeds: FeedLite[]; membership: Record<string, string[]> }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("culture");
  return (
    <div className="space-y-5">
      <p className="text-[13px] text-muted">
        Each channel is a separate creator personality or brand. It has its own sources, profile, learned taste, ideas, inspirations and projects; the news library underneath is shared. Switch channels from the top of the sidebar.
      </p>
      {channels.map((c) => (
        <ChannelCard key={c.id} ch={c} feeds={feeds} members={membership[c.id] ?? []} active={c.id === active} onlyOne={channels.length === 1} />
      ))}
      <section className="card p-4">
        <div className="eyebrow mb-2">New channel</div>
        <div className="flex flex-wrap gap-2">
          <input className="input !w-64" value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel name" />
          <select className="input !w-auto" value={template} onChange={(e) => setTemplate(e.target.value)}>
            {TEMPLATES.map(([id, label]) => <option key={id} value={id}>Start with: {label}</option>)}
          </select>
          <button
            className="btn-primary"
            disabled={!name.trim()}
            onClick={async () => {
              await api("/api/channels", "POST", { name, template });
              setName("");
              router.refresh();
            }}
          >
            Create channel
          </button>
        </div>
      </section>
    </div>
  );
}
