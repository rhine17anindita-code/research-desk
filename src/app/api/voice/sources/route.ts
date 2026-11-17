import { getDb } from "@/lib/db";
import { body, route } from "@/lib/http";
import { addVoiceSource, deleteVoiceSource } from "@/lib/voice";

export const maxDuration = 60;

/** Add a script (text or .txt file) or a video link to Voice Lab. Free. */
export const POST = route(async (req: Request) => {
  let input: { kind: "mine" | "inspiration"; text?: string; url?: string; title?: string; creator?: string };
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    const fd = await req.formData();
    const f = fd.get("file");
    if (!(f instanceof File) || !f.size) throw new Error("Choose a file");
    if (!/\.(txt|md|srt|vtt)$/i.test(f.name)) throw new Error("Add a .txt or .md file (or paste the text)");
    input = { kind: (fd.get("kind") as "mine" | "inspiration") || "mine", text: (await f.text()).replace(/^\d+\s*$|^\d\d:\d\d[:.,\d\s>-]+$/gm, ""), title: f.name.replace(/\.[a-z]+$/i, "") };
  } else input = await body(req);
  if (!["mine", "inspiration"].includes(input.kind)) throw new Error("Is it yours or an inspiration?");
  return { ok: true, source: await addVoiceSource(getDb(), input) };
});

export const DELETE = route(async (req: Request) => {
  const b = await body<{ id: string }>(req);
  deleteVoiceSource(getDb(), b.id);
  return { ok: true };
});
