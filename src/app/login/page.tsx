"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LockKeyhole, MessageSquareText } from "lucide-react";
import { API_URL } from "@/lib/api";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = await response.json() as { message?: string };
        throw new Error(body.message ?? "Sign in failed.");
      }
      router.replace("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not connect to the support API.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-white md:grid-cols-[1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#123e37] p-12 text-white md:flex md:flex-col md:justify-between">
        <div className="absolute -right-36 -bottom-32 h-[600px] w-[600px] rounded-full border border-white/10" />
        <div className="absolute -right-16 -bottom-12 h-[400px] w-[400px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#5da990]"><MessageSquareText size={20} /></div><span className="text-lg font-bold">supportdesk</span></div>
        <div className="relative max-w-lg pb-14">
          <div className="mb-5 text-xs font-bold uppercase tracking-[.18em] text-[#9bd0bc]">Support, made human</div>
          <h1 className="mb-5 text-5xl font-semibold leading-[1.12] tracking-[-.04em]">Every customer deserves a great answer.</h1>
          <p className="max-w-md text-base leading-7 text-white/70">Bring conversations, cases, and your support team together in one thoughtful workspace.</p>
          <div className="mt-12 flex items-center gap-3 text-xs text-white/60"><span className="h-2 w-2 rounded-full bg-[#78c9a7]" /> Local demo workspace · No external services connected</div>
        </div>
        <div className="relative text-xs text-white/45">© 2026 SupportDesk · Phase 1 demo</div>
      </section>
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[390px]">
          <div className="mb-9 grid h-11 w-11 place-items-center rounded-xl bg-[#e7f4ef] text-[#176b5b] md:hidden"><MessageSquareText /></div>
          <h2 className="text-3xl font-semibold tracking-[-.04em]">Welcome back</h2>
          <p className="mt-2 text-sm text-slate-500">Sign in to continue to your support workspace.</p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            <label className="block text-xs font-semibold text-slate-700">Work email<input className="field mt-2" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@company.com" /></label>
            <label className="block text-xs font-semibold text-slate-700">Password<input className="field mt-2" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Enter your password" /></label>
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
            <button disabled={busy} className="button button-primary flex w-full items-center justify-center gap-2 py-3">{busy ? "Signing in…" : "Sign in"}{!busy && <ArrowRight size={15} />}</button>
          </form>
          <div className="mt-7 flex items-center gap-2 text-[11px] text-slate-400"><LockKeyhole size={13} /> Protected by secure server-side sessions</div>
          <div className="mt-10 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold text-slate-700">Local demo access</div>
            <div className="mt-2 space-y-1 text-[11px] leading-5 text-slate-500"><div>Admin: admin@demo.local / DemoAdmin123!</div><div>Agent: agent1@demo.local / DemoAgent123!</div><div className="pt-1 text-slate-400">Development only. See README for setup.</div></div>
          </div>
        </div>
      </section>
    </main>
  );
}
