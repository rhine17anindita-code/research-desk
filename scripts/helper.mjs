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
const SITE = (process.env.HELPER_SITE || env.HELPER_SITE || "https://polite-midnightblue-newt-73.hostingersite.com").replace(/\/$/, "");
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
  const data = await x.json();
  const segments = [];
  for (const e of data.events ?? []) {
    const text = (e.segs ?? []).map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
    if (text) segments.push({ t: (e.tStartMs ?? 0) / 1000, d: (e.dDurationMs ?? 0) / 1000, text });
  }
  return segments.length ? { status: "ok", language: pick.languageCode, kind: pick.kind === "asr" ? "asr" : "manual", segments } : { status: "none" };
}

async function run() {
  if (!SECRET) return log("No YOUTUBE_API_KEY in .env.local — nothing to sign with.");
  const { jobs } = await call("/api/helper/jobs");
  if (!jobs.length) return log("No transcripts needed.");
  let done = 0;
  for (const job of jobs) {
    try {
      const t = await transcript(job.videoId, job.lang || "en");
      await call("/api/helper/transcript", { method: "POST", body: JSON.stringify({ videoId: job.videoId, articleId: job.articleId ?? null, ...t }) });
      done++;
    } catch (e) {
      log("skip", job.videoId, e.message);
    }
    await new Promise((r) => setTimeout(r, 800)); // be gentle with YouTube
  }
  log(`Sent ${done}/${jobs.length} transcripts to ${SITE}`);
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

if (process.argv.includes("--install")) install();
else run().catch((e) => log("Helper error:", e.message));
