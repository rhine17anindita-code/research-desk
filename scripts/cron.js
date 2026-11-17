// Run by Hostinger's Cron Jobs every few minutes: wakes KNDL so feeds, transcripts and
// translations keep updating even when nobody has the site open. No secrets needed.
const site = process.env.SITE_URL || "https://kndl.newthingmedia.org";
fetch(`${site}/api/helper/wake`, { signal: AbortSignal.timeout(60000) })
  .then((r) => console.log(new Date().toISOString(), "wake", r.status))
  .catch((e) => console.error(new Date().toISOString(), "wake failed", e.message));
