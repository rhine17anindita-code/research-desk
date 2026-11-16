import type { DB } from "../db";
import { activeChannel } from "../channels";
import { truncate } from "../text";

/**
 * The active channel's identity, profile and learned taste. Included in every AI
 * prompt so suggestions fit the channel and keep getting more personal.
 */
export function personalContext(db: DB): string {
  const ch = activeChannel(db);
  return [
    `CHANNEL: ${ch.name}${ch.description ? ` — ${ch.description}` : ""}`,
    ch.profile.trim() ? `ABOUT THIS CREATOR / CHANNEL (tailor relevance, angles and next steps to this):\n${truncate(ch.profile.trim(), 1500)}` : "",
    ch.tasteSummary.trim() ? `WHAT THEIR CHOICES SHOW THEY LIKE (learned from saves, skips and inspirations):\n${truncate(ch.tasteSummary.trim(), 1200)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
