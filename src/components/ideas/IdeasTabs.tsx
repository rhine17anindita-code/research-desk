"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function IdeasTabs({ counts }: { counts: { browse: number; saved: number; inspiration: number } }) {
  const path = usePathname();
  const tabs = [
    { href: "/ideas", label: "Browse", n: counts.browse },
    { href: "/ideas/saved", label: "Saved", n: counts.saved },
    { href: "/ideas/untold", label: "Untold stories" },
    { href: "/ideas/inspiration", label: "Inspiration", n: counts.inspiration },
    { href: "/ideas/taste", label: "What it's learned" },
  ];
  return (
    <nav className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const active = t.href === "/ideas" ? path === "/ideas" : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-[13.5px] font-medium ${active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}>
            {t.label} {t.n ? <span className="text-[12px] text-muted">{t.n}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
