import Link from "next/link";
import { Icon } from "@/components/Icon";

export const dynamic = "force-dynamic";

/** Full-page lists behind the Studio's sections (saved board, untold, inspiration, learning, idea pages). */
export default function IdeasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/studio" className="mb-4 inline-flex items-center gap-1 text-[12.5px] text-muted hover:text-ink">
        <Icon name="arrowLeft" size={13} /> Studio
      </Link>
      {children}
    </div>
  );
}
