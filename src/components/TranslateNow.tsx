"use client";

import { useRouter } from "next/navigation";
import { AiButton } from "./AiButton";
import type { TKind } from "@/lib/translate";

/** Translate a long Bangla item into English now (cheapest model; cost shown first). */
export function TranslateNow({ kind, id }: { kind: TKind; id: string }) {
  const router = useRouter();
  return <AiButton label="Translate to English" endpoint="/api/translation" payload={{ kind, id }} size="sm" confirm="always" runningLabel="Translating…" onResult={() => router.refresh()} />;
}
