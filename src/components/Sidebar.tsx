"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { openPalette } from "./CommandPalette";
import { ThemeToggle } from "./ThemeToggle";
import { onRecentChange, readRecent, type RecentItem } from "./recent";
import { Icon } from "./Icon";

const NAV = [
  { href: "/discover", label: "Discover", icon: "discover" },
  { href: "/ideas", label: "Ideas", icon: "bulb" },
  { href: "/explore", label: "Explore", icon: "explore" },
  { href: "/research", label: "Research", icon: "research" },
  { href: "/library", label: "Library", icon: "library" },
  { href: "/search", label: "Search", icon: "search" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export function Sidebar({ ai, canSignOut }: { ai: { available: boolean; reason: string | null; model: string; spentToday: number; dailyLimit: number }; canSignOut?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  useEffect(() => {
    setRecent(readRecent());
    return onRecentChange(() => setRecent(readRecent()));
  }, []);
  if (path === "/login") return null;

  const quick = (
    <button
      onClick={() => {
        setOpen(false);
        openPalette();
      }}
      className="mb-3 flex w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] text-muted hover:border-line-strong hover:text-ink"
    >
      <Icon name="search" size={14} />
      <span className="flex-1 text-left">Quick search</span>
      <kbd className="rounded border border-line px-1 text-[10.5px]">⌘K</kbd>
    </button>
  );

  const recentList =
    recent.length > 0 ? (
      <div className="mt-5">
        <div className="eyebrow mb-1 px-2.5">Recent</div>
        <ul>
          {recent.slice(0, 6).map((r) => (
            <li key={r.href}>
              <Link
                href={r.href}
                onClick={() => setOpen(false)}
                title={r.title}
                className={`block truncate rounded px-2.5 py-1 text-[12.5px] ${path === r.href.split("?")[0] ? "text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
              >
                <span className="mr-1 text-[10px] uppercase tracking-wide opacity-70">{r.kind === "story" ? "S" : r.kind === "question" ? "Q" : r.kind === "project" ? "P" : "R"}</span>
                {r.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  const active = (href: string) =>
    path === href || path.startsWith(href + "/") || (href === "/explore" && (path.startsWith("/story") || path.startsWith("/question")));

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          onClick={() => setOpen(false)}
          className={`group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] transition-colors ${
            active(n.href) ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <Icon name={n.icon} size={17} className={active(n.href) ? "text-accent" : "text-muted group-hover:text-ink-2"} />
          <span className="font-medium">{n.label}</span>
        </Link>
      ))}
    </nav>
  );

  const signOut = canSignOut ? (
    <button
      className="btn-ghost mt-2 w-full justify-start !text-[12px]"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        window.location.href = "/login";
      }}
    >
      Sign out
    </button>
  ) : null;

  const status = (
    <Link href="/settings?tab=ai" className="block rounded-md border border-line bg-surface px-3 py-2.5 text-[12px] hover:border-line-strong">
      <div className="flex items-center gap-1.5 font-medium text-ink-2">
        <span className={`h-1.5 w-1.5 rounded-full ${ai.available ? "bg-ok" : "bg-muted"}`} />
        {ai.available ? "AI available" : "AI unavailable"}
      </div>
      <div className="mt-0.5 leading-snug text-muted">
        {ai.available ? `${ai.model.replace("claude-", "")} · $${ai.spentToday.toFixed(2)} of $${ai.dailyLimit.toFixed(2)} today` : ai.reason}
      </div>
    </Link>
  );

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/95 px-4 py-2.5 backdrop-blur md:hidden print:hidden">
        <Link href="/discover" className="font-serif text-[17px] font-semibold tracking-tight">
          Research Desk
        </Link>
        <button className="btn-ghost" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          <Icon name={open ? "x" : "panel"} size={18} />
        </button>
      </div>
      {open && (
        <div className="fixed inset-x-0 top-[49px] z-30 border-b border-line bg-paper p-3 shadow-lg md:hidden">
          {quick}
          {nav}
          {recentList}
          <div className="mt-3">{status}<ThemeToggle />{signOut}</div>
        </div>
      )}
      <aside className="sticky top-0 hidden h-screen w-[208px] shrink-0 flex-col justify-between overflow-y-auto border-r border-line px-3 py-4 md:flex">
        <div>
          <Link href="/discover" className="mb-5 block px-2.5">
            <div className="font-serif text-[18px] font-semibold leading-tight tracking-tight">Research Desk</div>
            <div className="text-[11.5px] text-muted">News → questions → evidence</div>
          </Link>
          {quick}
          {nav}
          {recentList}
        </div>
        <div className="mt-4">
          {status}
          <ThemeToggle />
          {signOut}
        </div>
      </aside>
    </>
  );
}
