import type { DB } from "../db";
import { getSetting } from "../repo/settings";
import { truncate } from "../text";

/**
 * The researcher's own profile plus what their behaviour has taught the system.
 * Included in every AI prompt so suggestions keep getting more personal.
 */
export function personalContext(db: DB): string {
  const about = getSetting(db, "profile.about").trim();
  const taste = getSetting(db, "taste.summary").trim();
  return [
    about ? `ABOUT THE RESEARCHER / CREATOR (tailor relevance, angles and next steps to this):\n${truncate(about, 1500)}` : "",
    taste ? `WHAT THEIR CHOICES SHOW THEY LIKE (learned from saves, skips and inspirations):\n${truncate(taste, 1200)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
