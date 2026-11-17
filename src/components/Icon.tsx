/** Minimal stroke icon set (inline SVG, no dependency). */
const PATHS: Record<string, string> = {
  discover: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z",
  explore: "M4 5h16M4 12h10M4 19h7M17 15l4 4m-1.5-6.5a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z",
  research: "M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z",
  library: "M5 4h3v16H5zM10 4h3v16h-3zM15.5 4.5l2.9-.8 4 15.4-2.9.8z",
  search: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2",
  settings: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4",
  calendar: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4",
  bookmark: "M6 4h12v17l-6-4-6 4V4Z",
  x: "M6 6l12 12M18 6 6 18",
  up: "M7 14l5-5 5 5",
  down: "M7 10l5 5 5-5",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  plus: "M12 5v14M5 12h14",
  refresh: "M20 11a8 8 0 0 0-14.9-3M4 5v4h4M4 13a8 8 0 0 0 14.9 3M20 19v-4h-4",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3Z",
  right: "M9 6l6 6-6 6",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  check: "M5 12l5 5 9-10",
  question: "M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.5",
  pin: "M12 17v4M8 3h8l-1 5 3 4H6l3-4-1-5Z",
  trash: "M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  edit: "M4 20h4L19 9l-4-4L4 16v4Z",
  chat: "M4 5h16v11H9l-5 4V5Z",
  panel: "M4 6h16M4 12h16M4 18h16",
  source: "M6 3h9l4 4v14H6V3Zm9 0v4h4",
  arrowLeft: "M15 6l-6 6 6 6",
  merge: "M7 4v6a5 5 0 0 0 5 5h5M17 11l3 4-3 4M7 20v-4",
  thumbUp: "M7 11v9H4v-9h3Zm0 0 4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7",
  thumbDown: "M7 13V4H4v9h3Zm0 0 4 7a2 2 0 0 0 2-2v-4h5a2 2 0 0 0 2-2.3l-1.2-6A2 2 0 0 0 16.8 4H7",
};

export function Icon({ name, size = 16, className = "" }: { name: string; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d={PATHS[name] ?? PATHS.question} />
    </svg>
  );
}
