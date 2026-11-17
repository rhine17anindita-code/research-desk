import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { LiveWatcher } from "@/components/LiveWatcher";
import { getDb } from "@/lib/db";
import { getAiStatus } from "@/lib/ai/service";
import { authMode } from "@/lib/auth";
import { activeChannel, activeChannelId, listChannels } from "@/lib/channels";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap", axes: ["opsz", "SOFT", "WONK"] });

export const metadata: Metadata = {
  title: "KNDL",
  description: "A research environment that turns news into questions, evidence and original work.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ai = getAiStatus(getDb());
  return (
    <html lang="en" className={`${inter.variable} ${display.variable}`} data-accent={activeChannel(getDb()).color} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("rd.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="font-sans text-[14px]">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar ai={{ available: ai.available, reason: ai.unavailableReason, model: ai.model, spentToday: ai.spentToday, dailyLimit: ai.dailyLimit }} canSignOut={authMode() === "password"} channels={{ list: listChannels(getDb()).map((c) => ({ id: c.id, name: c.name, color: c.color })), active: activeChannelId(getDb()) }} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <CommandPalette />
        <LiveWatcher />
      </body>
    </html>
  );
}
