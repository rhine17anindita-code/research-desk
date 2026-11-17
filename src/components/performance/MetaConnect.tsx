"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { timeAgo } from "@/lib/format";
import type { MetaStatus, MetaSyncResult } from "@/lib/performance/meta";

const SCOPES = "pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, instagram_manage_comments, business_management";
const MSG_SCOPES = "instagram_manage_messages, pages_messaging, pages_manage_metadata";

/** Connect Instagram & Facebook directly: which account belongs to this channel, connection health, token expiry, sync, setup steps. */
export function MetaConnect() {
  const router = useRouter();
  const [st, setSt] = useState<MetaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const load = () => api<{ status: MetaStatus }>("/api/performance/meta").then((r) => setSt(r.status)).catch((e) => setMsg((e as Error).message));
  useEffect(() => {
    load();
  }, []);
  const copy = async (k: string, v: string) => {
    await navigator.clipboard.writeText(v);
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };

  const days = st?.expiresAt ? Math.round((Date.parse(st.expiresAt) - Date.now()) / 86_400_000) : null;
  const connected = st?.ok;

  const sync = async () => {
    setBusy(true);
    setMsg(null);
    setWarn([]);
    try {
      const r = await api<{ result: MetaSyncResult }>("/api/performance/meta", "POST", {});
      setMsg(`${r.result.instagram} Instagram posts, ${r.result.facebook} Facebook posts, ${r.result.comments} comments`);
      setWarn(r.result.warnings);
      router.refresh();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-[18px] font-semibold">Instagram & Facebook — direct connection</h2>
          <p className="text-[12.5px] text-muted">Pulls posts, views, reach, saves, shares and Instagram comments every 6 hours, for every channel. Read-only: it never posts or changes anything.</p>
        </div>
        {connected && st?.page && (
          <button className="btn !py-1 !text-[12.5px]" disabled={busy} onClick={sync}>
            <Icon name="refresh" size={13} className={busy ? "animate-spin" : ""} /> {busy ? "Syncing… (a minute or two)" : "Sync now"}
          </button>
        )}
      </div>

      {!st && !msg && <p className="mt-2 text-[12.5px] text-muted">Checking the connection…</p>}
      {st && connected && (
        <div className="mt-2 space-y-1.5 text-[12.5px]">
          <label className="flex flex-wrap items-center gap-2">
            <span className="text-ink-2">Accounts for the <b>{st.channel.name}</b> channel:</span>
            <select
              className="input !w-auto !py-1 text-[12.5px]"
              value={st.chosen ? st.page?.id ?? "" : ""}
              onChange={async (e) => {
                await api(`/api/channels/${st.channel.id}`, "PATCH", { metaPageId: e.target.value || null });
                await load();
                router.refresh();
              }}
            >
              <option value="">{st.page && !st.chosen ? `Best guess: ${st.page.name}` : "Choose…"}</option>
              {st.pages.map((p) => <option key={p.id} value={p.id}>{p.name}{p.instagram ? ` · @${p.instagram}` : " · no Instagram linked"}</option>)}
            </select>
          </label>
          {st.page ? (
            <p className="text-ok">
              <Icon name="check" size={12} className="inline" /> Facebook Page <b>{st.page.name}</b>
              {st.instagram ? <> · Instagram <b>@{st.instagram.username}</b></> : <span className="text-warn"> · no Instagram linked to this Page</span>}
            </p>
          ) : (
            <p className="text-warn">This channel hasn&apos;t picked its accounts yet — choose them above. Each channel can have its own Page and Instagram.</p>
          )}
          <p className="text-muted">
            {st.tokenKind === "page" || !st.expiresAt ? "Token doesn't expire." : days != null && days <= 14 ? <span className="text-warn">Token expires in {days} days — make a fresh one (steps below).</span> : `Token expires in ${days} days; you'll get a warning here two weeks before.`}
            {st.syncedAt ? ` Last synced ${timeAgo(st.syncedAt)}.` : ""}
            {st.tokenKind === "page" ? " This token only sees one Page — for several channels, use the user token (step 5)." : ""}
          </p>
          {st.missingScopes.length > 0 && <p className="text-warn">Missing permissions: {st.missingScopes.join(", ")} — some numbers may be blank.</p>}
        </div>
      )}
      {st?.configured && !connected && <p className="mt-2 text-[12.5px] text-bad">{st.error}</p>}
      {msg && <p className="mt-2 text-[12.5px] text-muted">{msg}</p>}
      {warn.map((w) => <p key={w} className="text-[12px] text-warn">{w}</p>)}

      <details className="mt-2" open={!!st && !st.configured}>
        <summary className="cursor-pointer text-[12.5px] font-medium text-accent">{st?.configured ? "How to make a new token" : "Set it up (about 15 minutes, once)"}</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12.5px] text-ink-2">
          <li>
            <b>Each Instagram must be a Professional account linked to a Facebook Page.</b> Instagram app → Settings → Account type and tools → Creator. Then in Accounts Center, link it to the Page. Do this for every account you want here (one Page + Instagram per channel).
            <span className="text-muted"> A Facebook <i>profile</i> (even in professional mode) can&apos;t be read by Meta&apos;s API — only Pages can.</span>
          </li>
          <li>Your app <b>“Research Desk”</b> at <a className="text-accent underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> is already made — keep it. (Only if you ever make another: pick the use case <b>“Manage everything on your Page”</b>, and add <b>“Manage messaging & content on Instagram”</b>.)</li>
          <li>Open the <a className="text-accent underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a>. On the right: <b>Meta App</b> = Research Desk, <b>User or Page</b> = <b>User Token</b>.</li>
          <li>
            Under <b>Permissions</b> add these, press <b>Generate Access Token</b>, and when Meta asks, <b>tick every Page and Instagram account</b> you want in Research Desk:
            <div className="mt-1 flex items-start gap-2">
              <code className="block flex-1 rounded bg-surface-2 px-2 py-1 text-[11.5px]">{SCOPES}</code>
              <button className="btn-ghost !px-1 !text-[12px] !text-accent" onClick={() => copy("s", SCOPES)}>{copied === "s" ? "Copied" : "Copy"}</button>
            </div>
            <div className="mt-1 text-muted">For messages later, also add:</div>
            <div className="mt-0.5 flex items-start gap-2">
              <code className="block flex-1 rounded bg-surface-2 px-2 py-1 text-[11.5px]">{MSG_SCOPES}</code>
              <button className="btn-ghost !px-1 !text-[12px] !text-accent" onClick={() => copy("m", MSG_SCOPES)}>{copied === "m" ? "Copied" : "Copy"}</button>
            </div>
            <div className="mt-1 text-muted">Don&apos;t add anything that says “publish” or “content_publish” — Research Desk doesn&apos;t need them.</div>
          </li>
          <li>
            <b>Make it last 60 days:</b> click the <b>ⓘ</b> beside the token → <b>Open in Access Token Tool</b> → scroll down → <b>Extend Access Token</b>. Meta then shows a line like <i>“This new long-lived access token will expire on …”</i> with a long code under it starting with <code className="rounded bg-surface-2 px-1">EAA</code>. <b>That code is the one to copy</b> — ignore the App ID, User ID and the table above it.
            <span className="text-muted"> Use this user token when you have more than one account: it sees all your Pages, and each channel picks its own here.</span>
          </li>
          <li>
            On your Mac, open the settings file:
            <code className="mx-1 rounded bg-surface-2 px-1">open -e ~/research-desk/.env.local</code>
            and replace the <code className="rounded bg-surface-2 px-1">META_ACCESS_TOKEN=</code> line with the new code (no spaces). Save it and tell Claude so the server restarts. Treat it like a password.
          </li>
          <li>For the live site, put the same <code className="rounded bg-surface-2 px-1">META_ACCESS_TOKEN</code> in Hostinger → your website → environment variables. Every ~2 months, repeat steps 3–6 (this card warns you two weeks before).</li>
        </ol>
      </details>
    </section>
  );
}
