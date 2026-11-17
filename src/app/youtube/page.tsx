import { YoutubeStudio } from "@/components/youtube/YoutubeStudio";

export const dynamic = "force-dynamic";

export default async function YoutubePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const sp = await searchParams;
  const tabs = ["plan", "channels", "formats", "set", "workflow", "competitors", "optimise", "rules"];
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <YoutubeStudio initialTab={(tabs.includes(sp.tab ?? "") ? sp.tab : "plan") as "plan"} />
    </div>
  );
}
