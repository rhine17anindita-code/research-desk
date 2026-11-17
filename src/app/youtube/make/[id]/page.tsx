import { Producer } from "@/components/youtube/Producer";

export const dynamic = "force-dynamic";

export default async function MakePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
      <Producer projectId={id} />
    </div>
  );
}
