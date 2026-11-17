/** Client-safe production constants and helpers (no database imports). */

export const CONTENT_TYPES = [
  { id: "video", label: "YouTube video", color: "coral" },
  { id: "short", label: "Short / Reel / TikTok", color: "teal" },
  { id: "series", label: "Series episode", color: "violet" },
  { id: "podcast", label: "Podcast", color: "amber" },
  { id: "interview", label: "Interview", color: "blue" },
  { id: "sponsored", label: "Sponsored", color: "rose" },
  { id: "carousel", label: "Carousel", color: "green" },
  { id: "article", label: "Article / thread", color: "green" },
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number]["id"];
export const TYPE_BY_ID = Object.fromEntries(CONTENT_TYPES.map((t) => [t.id, t])) as Record<string, (typeof CONTENT_TYPES)[number]>;

export const PROD_STAGES = [
  { id: "idea", label: "Idea" },
  { id: "research", label: "Research" },
  { id: "script", label: "Script" },
  { id: "record", label: "Record" },
  { id: "edit", label: "Edit" },
  { id: "publish", label: "Ready to post" },
  { id: "live", label: "Live" },
] as const;
export type ProdStage = (typeof PROD_STAGES)[number]["id"];

export const PLATFORMS = ["youtube", "instagram", "facebook", "tiktok"] as const;

export interface ProductionDocs {
  script?: string; shots?: string; thumbnail?: string; cutdowns?: string; captions?: string;
  /** Script-writing steps: hook options, the chosen hook, the approved beat outline, and the last AI draft (to learn from your edits). */
  hooks?: string; hook?: string; outline?: string; script_ai?: string;
}
export const DOC_KEYS = ["script", "shots", "thumbnail", "cutdowns", "captions"] as const;

export interface Production {
  projectId: string;
  title: string;
  contentType: ContentType;
  stage: ProdStage;
  publishDate: string | null;
  platforms: string[];
  seriesName: string | null;
  guest: string | null;
  sponsor: string | null;
  publishedUrl: string | null;
  docs: ProductionDocs;
  progress: number;
  updatedAt: string;
}

/** 0–100: mostly where it is in the stages, plus credit for each working document done. */
export function progressOf(stage: string, docs: ProductionDocs): number {
  if (stage === "live") return 100;
  const idx = Math.max(0, PROD_STAGES.findIndex((s) => s.id === stage));
  const done = DOC_KEYS.filter((k) => (docs[k] ?? "").trim().length > 20).length;
  return Math.round((idx / (PROD_STAGES.length - 1)) * 80 + (done / DOC_KEYS.length) * 20);
}

