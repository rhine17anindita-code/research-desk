export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "undated";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "undated";
  const s = Math.round((Date.now() - d) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}) });
}

export function usd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}

export function hostOf(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** A cost expressed as a share of a budget, for people who think in proportions, not cents. */
export function pctOf(amount: number, limit: number): string {
  if (!limit || limit <= 0) return "—";
  if (amount === 0) return "0%";
  const p = (amount / limit) * 100;
  if (p < 1) return "under 1%";
  return `${Math.round(p)}%`;
}

export function modelName(id: string): string {
  return id.replace(/^claude-/, "").replace(/-(\d+)-(\d+)$/, " $1.$2").replace(/-(\d+)$/, " $1").replace(/^\w/, (c) => c.toUpperCase());
}
