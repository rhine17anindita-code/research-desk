import type { Metadata } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { CommandPalette } from "@/components/CommandPalette";
import { getDb } from "@/lib/db";
import { getAiStatus } from "@/lib/ai/service";
import { authMode } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap", axes: ["opsz"] });

export const metadata: Metadata = {
  title: "Research Desk",
  description: "A research environment that turns news into questions, evidence and original work.",
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ai = getAiStatus(getDb());
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint to avoid a flash. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("rd.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="font-sans text-[14px]">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Sidebar ai={{ available: ai.available, reason: ai.unavailableReason, model: ai.model, spentToday: ai.spentToday, dailyLimit: ai.dailyLimit }} canSignOut={authMode() === "password"} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}
