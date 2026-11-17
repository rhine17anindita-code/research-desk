"use client";

import { Wordmark } from "@/components/Brand";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string };
    if (res.ok && data.ok) {
      const next = params.get("next");
      // Only allow same-site relative redirects.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/discover";
    } else {
      setError(data.message ?? "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm p-6">
      <div className="mb-5">
        <Wordmark size={24} />
        <div className="text-[13px] text-muted">Enter the site password to continue.</div>
      </div>
      <label className="label" htmlFor="pw">Password</label>
      <input id="pw" type="password" autoComplete="current-password" autoFocus className="input mb-3" value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <p className="mb-3 text-[12.5px] text-bad">{error}</p>}
      <button className="btn-primary w-full !py-2" disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
