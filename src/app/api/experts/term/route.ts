import { route } from "@/lib/http";
import { defineTerm } from "@/lib/experts";

/** A plain definition of a key term (Wikipedia, free). */
export const GET = route(async (req: Request) => ({ ok: true, term: await defineTerm(new URL(req.url).searchParams.get("q") ?? "").catch(() => null) }));
