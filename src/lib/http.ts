import { NextResponse } from "next/server";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/** Wrap a route handler: uniform JSON errors, never leaks stack traces. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<unknown> | unknown) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (err) {
      const message = (err as Error).message || "Unexpected error";
      console.error("[api]", message);
      return NextResponse.json({ ok: false, message }, { status: message.includes("not found") ? 404 : 400 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}

export type Ctx<P extends Record<string, string>> = { params: Promise<P> };
