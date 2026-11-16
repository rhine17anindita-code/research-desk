"use client";

/** Small fetch wrapper for client components. Throws Error(message) on failure. */
export async function api<T = Record<string, unknown>>(path: string, method: "GET" | "POST" | "PATCH" | "DELETE" = "GET", body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    /* empty body */
  }
  if (!res.ok || data.ok === false) throw new Error((data.message as string) || `Request failed (${res.status})`);
  return data as T;
}
