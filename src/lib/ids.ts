import { randomBytes } from "node:crypto";

/** Stable, sortable-enough, prefixed identifiers: e.g. `q_m3k9x2_a1b2c3d4e5`. */
export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(5).toString("hex")}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
