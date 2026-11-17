"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../Icon";
import { timeAgo } from "@/lib/format";
import type { MetaStatus, MetaSyncResult } from "@/lib/performance/meta";

const SCOPES = "pages_show_list, pages_read_engagement, read_insights, instagram_basic, instagram_manage_insights, instagram_manage_comments, business_management";

/** Connect Instagram & Facebook directly: setup steps, connection health, token expiry, sync. */
export function MetaConnect() {
  const router = useRouter();
  const [st, setSt] = useState<MetaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [warn, setWarn] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    api<{ status: MetaStatus }>("/api/performance/meta").then((r) => setSt(r.status)).catch((e) => setMsg((e as Error).message));
  }, []);

  const days = st?.expiresAt ? Math.round((Date.parse(st.expiresAt) - Date.now()) / 86_400_000) : null;
  const connected = st?.ok;

  return (
    <section className="card px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-serif text-[18px] font-semibold">Instagram & Facebook — direct connection</h2>
          <p className="text-[12.5px] text-muted">Pulls your posts, views, reach, saves, shares and Instagram comments automatically every 6 hours. Read-only: it never posts or changes anything.</p>
        </div>
        {connected && (
          <button
            className="btn !py-1 !text-[12.5px]"
            disabled={busy}
            onClick={async () => {
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
            }}
          >
            <Icon name="refresh" size={13} className={busy ? "animate-spin" : ""} /> {busy ? "Syncing… (a minute or two)" : "Sync now"}
          </button>
        )}
      </div>

      {!st && !msg && <p className="mt-2 text-[12.5px] text-muted">Checking the connection…</p>}
      {st && connected && (
        <div className="mt-2 space-y-1 text-[12.5px]">
          <p className="text-ok"><Icon name="check" size={12} className="inline" /> Connected — Facebook Page <b>{st.page?.name}</b>{st.instagram ? <> · Instagram <b>@{st.instagram.username}</b></> : <span className="text-warn"> · no Instagram linked to this Page</span>}</p>
          <p className="text-muted">
            {st.tokenKind === "page" || !st.expiresAt ? "Token doesn't expire." : days != null && days <= 14 ? <span className="text-warn">Token expires in {days} days — make a fresh one soon (steps below).</span> : `Token expires in ${days} days.`}
            {st.syncedAt ? ` Last synced ${timeAgo(st.syncedAt)}.` : " Not synced yet — press Sync now."}
            {st.pages.length > 1 ? ` (${st.pages.length} Pages visible; using ${st.page?.name}. Set META_PAGE_ID to choose another.)` : ""}
          </p>
          {st.missingScopes.length > 0 && <p className="text-warn">Missing permissions: {st.missingScopes.join(", ")} — some numbers may be blank. Make a new token with them ticked.</p>}
        </div>
      )}
      {st?.configured && !connected && <p className="mt-2 text-[12.5px] text-bad">{st.error}</p>}
      {msg && <p className="mt-2 text-[12.5px] text-muted">{msg}</p>}
      {warn.map((w) => <p key={w} className="text-[12px] text-warn">{w}</p>)}

      <details className="mt-2" open={!!st && !st.configured}>
        <summary className="cursor-pointer text-[12.5px] font-medium text-accent">{st?.configured ? "How to make a new token" : "Set it up (about 15 minutes, once)"}</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-[12.5px] text-ink-2">
          <li><b>Instagram must be a Professional account linked to your Facebook Page.</b> In the Instagram app: Settings → Account type and tools → switch to Creator (or Business). Then in Accounts Center, connect it to your Facebook Page.</li>
          <li>On a computer, go to <a className="text-accent underline" href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer">developers.facebook.com/apps</a> → <b>Create app</b>. Name it “Research Desk”. If it asks for a use case, choose <b>Other</b>, then app type <b>Business</b>. It stays private to you — no review needed for your own accounts.</li>
          <li>Open the <a className="text-accent underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Graph API Explorer</a>. On the right, pick your new app under <b>Meta App</b>, and <b>User Token</b> under User or Page.</li>
          <li>
            Under <b>Permissions</b>, add these, then press <b>Generate Access Token</b>, log in, and tick your Page and your Instagram account:
            <div className="mt-1 flex items-start gap-2">
              <code className="block flex-1 rounded bg-surface-2 px-2 py-1 text-[11.5px]">{SCOPES}</code>
              <button className="btn-ghost !px-1 !text-[12px] !text-accent" onClick={async () => { await navigator.clipboard.writeText(SCOPES); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : "Copy"}</button>
            </div>
          </li>
          <li>Make it last: click the <b>ⓘ</b> next to the token → <b>Open in Access Token Tool</b> → <b>Extend Access Token</b> → copy the new, longer token (good for about 60 days).</li>
          <li><b>Optional, so it never expires:</b> back in the Explorer, paste that long token into the Access Token box, type <code className="rounded bg-surface-2 px-1">me/accounts</code> in the request bar and press Submit. Copy the <code className="rounded bg-surface-2 px-1">access_token</code> shown under your Page&apos;s name — that one doesn&apos;t expire.</li>
          <li>
            On your Mac, open the settings file:
            <code className="mx-1 rounded bg-surface-2 px-1">open -e ~/research-desk/.env.local</code>
            and add a new line <code className="rounded bg-surface-2 px-1">META_ACCESS_TOKEN=</code> followed by the token (no spaces). Save it, then tell Claude so the server can restart. Treat the token like a password — don&apos;t share it.
          </li>
          <li>For the live site, add the same <code className="rounded bg-surface-2 px-1">META_ACCESS_TOKEN</code> in Hostinger → your website → environment variables.</li>
        </ol>
      </details>
    </section>
  );
}
