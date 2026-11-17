"use client";

import { useEffect, useState } from "react";

/** How to send things here from the phone or any browser tab. */
export function ShareHelp() {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => setOrigin(location.origin), []);
  if (!origin) return null;
  const bookmarklet = `javascript:location.href='${origin}/inbox?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)`;
  const copy = async (k: string, v: string) => {
    await navigator.clipboard.writeText(v);
    setCopied(k);
    setTimeout(() => setCopied(null), 1500);
  };
  return (
    <details className="card px-4 py-2.5 text-[12.5px]">
      <summary className="cursor-pointer font-medium text-ink-2">Send things here straight from your phone or browser</summary>
      <ul className="mt-2 space-y-2 text-muted">
        <li>
          <b className="text-ink-2">Android:</b> open this site in Chrome → ⋮ → <i>Add to Home screen</i>. Then &quot;KNDL&quot; appears in the Share menu of any app.
        </li>
        <li>
          <b className="text-ink-2">iPhone:</b> in the Shortcuts app make a shortcut with “Receive URLs and text from Share Sheet” → “Open URLs”: <code className="rounded bg-surface-2 px-1">{origin}/inbox?url=</code> followed by Shortcut Input (URL encoded). Turn on “Show in Share Sheet”.{" "}
          <button className="text-accent hover:underline" onClick={() => copy("ios", `${origin}/inbox?url=`)}>{copied === "ios" ? "Copied" : "Copy the address"}</button>
        </li>
        <li>
          <b className="text-ink-2">Computer:</b> make a bookmark, and paste this as its address. Clicking it on any article sends that page here.{" "}
          <button className="text-accent hover:underline" onClick={() => copy("bm", bookmarklet)}>{copied === "bm" ? "Copied" : "Copy the bookmark code"}</button>
        </li>
      </ul>
    </details>
  );
}
