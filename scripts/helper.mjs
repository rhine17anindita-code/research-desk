#!/usr/bin/env node
/**
 * Research Desk helper — runs on your Mac (free).
 *
 * YouTube blocks transcript downloads from hosting companies' servers, but not from home
 * internet. Every few minutes this asks the live site which transcripts it needs, downloads
 * them from here, and hands them over. Requests are signed with your YouTube API key, which
 * both your Mac and the live site already have — nothing else to set up.
 *
 * Run once:   node scripts/helper.mjs
 * Installed as a background job by: node scripts/helper.mjs --install
 */
import { createHmac } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const env = Object.fromEntries(
  (fs.existsSync(path.join(ROOT, ".env.local")) ? fs.readFileSync(path.join(ROOT, ".env.local"), "utf8") : "")
    .split("\n")
    .map((l) => l.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
);
// The live site, plus the copy running on this Mac when it's open.
const SITES = (process.env.HELPER_SITE || env.HELPER_SITE || "https://kndl.newthingmedia.org,http://127.0.0.1:3100")
  .split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);
let SITE = SITES[0];
const VENV = path.join(os.homedir(), ".research-desk-venv/bin");
const SECRET = process.env.HELPER_SECRET || env.HELPER_SECRET || env.YOUTUBE_API_KEY;
const log = (...a) => console.log(new Date().toISOString(), ...a);

function signed(p) {
  const ts = String(Date.now());
  return { "x-helper-ts": ts, "x-helper-sig": createHmac("sha256", SECRET).update(`${ts}.${p}`).digest("hex") };
}

async function call(p, init = {}) {
  const res = await fetch(SITE + p, { ...init, headers: { "content-type": "application/json", ...signed(p), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(30000) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) throw new Error(j.message || `HTTP ${res.status}`);
  return j;
}

async function transcript(videoId, preferLang) {
  const r = await fetch("https://www.youtube.com/youtubei/v1/player", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ videoId, context: { client: { clientName: "ANDROID", clientVersion: "20.10.38", hl: "en" } } }),
    signal: AbortSignal.timeout(15000),
  });
  const j = await r.json();
  const tracks = j?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!tracks.length) {
    const st = j?.playabilityStatus;
    if (st?.status && st.status !== "OK") return { status: "error", error: st.reason || st.status };
    return { status: "none" };
  }
  const order = [preferLang, preferLang === "bn" ? "en" : "bn", "en", "hi", "ur"];
  const score = (t) => (order.indexOf(t.languageCode.slice(0, 2)) + 1 || 9) * 2 + (t.kind === "asr" ? 1 : 0);
  const pick = [...tracks].sort((a, b) => score(a) - score(b))[0];
  const x = await fetch(pick.baseUrl.replace(/&fmt=[^&]+/, "") + "&fmt=json3", { signal: AbortSignal.timeout(20000) });
  // YouTube rate-limits caption downloads from one address ("Sorry…" page): stop and come back later.
  if (x.status === 429 || !/json/.test(x.headers.get("content-type") ?? "json")) throw Object.assign(new Error(`YouTube is rate-limiting (HTTP ${x.status})`), { rateLimited: true });
  const data = await x.json();
  const segments = [];
  for (const e of data.events ?? []) {
    const text = (e.segs ?? []).map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (text) segments.push({ t: (e.tStartMs ?? 0) / 1000, d: (e.dDurationMs ?? 0) / 1000, text });
  }
  return segments.length ? { status: "ok", language: pick.languageCode, kind: pick.kind === "asr" ? "asr" : "manual", segments } : { status: "none" };
}

async function media(job) {
  const vid = (job.url.match(/[?&]v=([\w-]{11})/) || job.url.match(/youtu\.be\/([\w-]{11})/) || job.url.match(/shorts\/([\w-]{11})/) || [])[1];
  if (vid) {
    const t = await transcript(vid, "en").catch(() => null);
    if (t?.status === "ok") return t.segments.map((s) => s.text).join(" ");
  }
  if (!fs.existsSync(path.join(VENV, "yt-dlp"))) throw new Error("yt-dlp isn't installed on this Mac");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rd-media-"));
  try {
    execFileSync(path.join(VENV, "yt-dlp"), ["-q", "--no-warnings", "--no-playlist", "-f", "bestaudio/best", "--max-filesize", "300M", "-o", path.join(dir, "audio.%(ext)s"), job.url], { stdio: "ignore", timeout: 300000 });
    const file = fs.readdirSync(dir).find((f) => f.startsWith("audio."));
    if (!file) throw new Error("Couldn't download the video (it may be private or need a login)");
    const out = execFileSync(path.join(VENV, "python"), ["-I", path.join(ROOT, "scripts/transcribe.py"), path.join(dir, file), "auto"], { timeout: 1800000, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
    const j = JSON.parse(out.toString());
    return j.segments.map((s) => s.text).join(" ");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// After YouTube rate-limits us, wait before asking for captions again (shared across sites and runs).
const COOLDOWN = path.join(os.homedir(), ".research-desk-yt-cooldown");
const coolingDown = () => { try { return Date.now() < Number(fs.readFileSync(COOLDOWN, "utf8")); } catch { return false; } };
const PER_RUN = 12; // a few at a time, every 10 minutes, newest first — steady and under YouTube's radar

async function runSite() {
  // Nudge the site's own feed schedule awake (hosting can pause an idle server).
  await call("/api/helper/wake").catch(() => null);
  const { jobs, media: mediaJobs = [], pages = [], translate = [] } = await call("/api/helper/jobs");
  let done = 0;
  for (const job of coolingDown() ? [] : jobs.slice(0, PER_RUN)) {
    try {
      const t = await transcript(job.videoId, job.lang || "en");
      await call("/api/helper/transcript", { method: "POST", body: JSON.stringify({ videoId: job.videoId, articleId: job.articleId ?? null, ...t }) });
      done++;
    } catch (e) {
      log("skip", job.videoId, e.message);
      if (e.rateLimited) {
        fs.writeFileSync(COOLDOWN, String(Date.now() + 45 * 60_000));
        log("YouTube rate limit: pausing transcripts for 45 minutes");
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2500 + Math.random() * 2000)); // be gentle with YouTube
  }
  let vids = 0;
  for (const job of mediaJobs) {
    try {
      const text = await media(job);
      await call("/api/helper/media", { method: "POST", body: JSON.stringify({ type: job.type, id: job.id, status: text ? "ok" : "failed", text, error: text ? undefined : "No speech found" }) });
      vids++;
    } catch (e) {
      await call("/api/helper/media", { method: "POST", body: JSON.stringify({ type: job.type, id: job.id, status: "failed", error: String(e.message).slice(0, 200) }) }).catch(() => {});
      log("video failed", job.url, e.message);
    }
  }
  let read = 0;
  for (const p of pages) {
    try {
      const r = await fetch(p.url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36", Accept: "text/html" }, signal: AbortSignal.timeout(20000), redirect: "follow" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const html = (await r.text()).slice(0, 3_000_000);
      await call("/api/helper/page", { method: "POST", body: JSON.stringify({ id: p.id, html }) });
      read++;
    } catch (e) {
      // Refused from home too: it's a paywall or a hard block, so keep the summary.
      await call("/api/helper/page", { method: "POST", body: JSON.stringify({ id: p.id, status: "summary" }) }).catch(() => {});
    }
  }
  let translated = 0;
  const modelDir = path.join(os.homedir(), ".research-desk-models/nllb-600m-int8");
  if (translate.length && fs.existsSync(modelDir)) {
    // One model load for the whole batch: every job's parts in one go, then split back.
    try {
      const all = translate.flatMap((j) => j.parts);
      const out = execFileSync(path.join(VENV, "python"), ["-I", path.join(ROOT, "scripts/translate.py")], { input: JSON.stringify({ parts: all }), timeout: 3600000, maxBuffer: 64 * 1024 * 1024, stdio: ["pipe", "pipe", "ignore"] });
      const parts = JSON.parse(out.toString()).parts;
      let k = 0;
      for (const j of translate) {
        const mine = parts.slice(k, k + j.parts.length);
        k += j.parts.length;
        await call("/api/helper/translation", { method: "POST", body: JSON.stringify({ kind: j.kind, id: j.id, parts: mine }) });
        translated++;
      }
    } catch (e) {
      log("translation failed", e.message);
    }
  }
  log(`${SITE}: ${done}/${jobs.length} transcripts, ${vids}/${mediaJobs.length} videos, ${read}/${pages.length} news pages, ${translated}/${translate.length} translations`);
}

async function run() {
  if (!SECRET) return log("No YOUTUBE_API_KEY in .env.local — nothing to sign with.");
  for (const site of SITES) {
    SITE = site;
    try {
      await runSite();
    } catch (e) {
      if (!/fetch failed|ECONNREFUSED/.test(String(e.message) + String(e.cause?.code))) log(site, "error:", e.message);
    }
  }
}

function install() {
  const label = "com.researchdesk.helper";
  const plist = path.join(os.homedir(), "Library/LaunchAgents", `${label}.plist`);
  const logFile = path.join(os.homedir(), "Library/Logs/research-desk-helper.log");
  fs.mkdirSync(path.dirname(plist), { recursive: true });
  fs.writeFileSync(
    plist,
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${process.execPath}</string><string>${path.join(ROOT, "scripts/helper.mjs")}</string></array>
  <key>StartInterval</key><integer>600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${logFile}</string>
  <key>StandardErrorPath</key><string>${logFile}</string>
</dict></plist>
`,
  );
  try { execFileSync("launchctl", ["unload", plist], { stdio: "ignore" }); } catch {}
  execFileSync("launchctl", ["load", plist]);
  log(`Installed: runs every 10 minutes while you're logged in. Log: ${logFile}`);
}

async function pushLocal() {
  // One-time move of your work from this Mac's database to the live site.
  const { default: Database } = await import(path.join(ROOT, "node_modules/better-sqlite3/lib/index.js"));
  const db = new Database(path.join(ROOT, "data/research-desk.db"), { readonly: true });
  const all = (sql) => db.prepare(sql).all();
  const projects = all("SELECT * FROM projects WHERE title NOT LIKE 'TEST%'");
  const ids = projects.map((p) => p.id);
  const items = ids.length ? all(`SELECT * FROM project_items WHERE project_id IN (${ids.map((i) => `'${i}'`).join(",")})`) : [];
  const sourceIds = items.filter((i) => i.item_type === "source").map((i) => i.item_id);
  const payload = {
    ideas: all("SELECT * FROM ideas WHERE status IN ('saved','developing','made') OR origin = 'user'"),
    inspirations: all("SELECT * FROM inspirations"),
    voice_sources: all("SELECT * FROM voice_sources WHERE status = 'ready'"),
    voice_profiles: all("SELECT * FROM voice_profiles"),
    projects,
    project_items: items,
    sources: sourceIds.length ? all(`SELECT * FROM sources WHERE id IN (${sourceIds.map((i) => `'${i}'`).join(",")})`) : [],
  };
  SITE = SITES[0];
  const r = await call("/api/helper/import", { method: "POST", body: JSON.stringify(payload) });
  log("Moved to", SITE, JSON.stringify(r.counts));
}

if (process.argv.includes("--install")) install();
else if (process.argv.includes("--push-local")) pushLocal().catch((e) => log("Push failed:", e.message));
else {
  // One helper at a time (a long video can take a while to transcribe).
  const lock = path.join(os.tmpdir(), "research-desk-helper.lock");
  try {
    const age = Date.now() - fs.statSync(lock).mtimeMs;
    if (age < 45 * 60_000) process.exit(0);
  } catch {}
  fs.writeFileSync(lock, String(process.pid));
  run().catch((e) => log("Helper error:", e.message)).finally(() => fs.rmSync(lock, { force: true }));
}
