"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle2, CircleAlert, Play } from "lucide-react";
import { api, formatDate, label } from "@/lib/api";

type Detail = {
  id: string;
  type: string;
  status: string;
  currentStep: string | null;
  input: unknown;
  verifiedOutcome: unknown;
  errorSummary: string | null;
  createdAt: string;
  updatedAt: string;
  customer: { name: string; email: string | null };
  supportCase: { id: string; subject: string; status: string } | null;
  steps: Array<{
    id: string; stepName: string; stepType: string; sequence: number; status: string;
    attemptCount: number; inputSummary: unknown; outputSummary: unknown;
    errorCategory: string | null; startedAt: string | null; completedAt: string | null;
  }>;
  approvals: Array<{ id: string; action: string; status: string; reviewNotes: string | null }>;
  auditEvents: Array<{ id: string; action: string; summary: string; createdAt: string }>;
  reservations: Array<{ id: string; quantity: number; status: string; expiresAt: string | null }>;
};

function JsonSummary({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-slate-400">—</span>;
  return <pre className="mt-1 whitespace-pre-wrap break-words rounded bg-slate-50 p-2 text-[10px] leading-4 text-slate-600">{JSON.stringify(value, null, 2)}</pre>;
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [workflow, setWorkflow] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      setWorkflow(await api<Detail>(`/workflows/${id}`));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load workflow.");
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  async function action(path: string, confirmation: string) {
    if (!window.confirm(confirmation)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await api(path, { method: "POST", body: JSON.stringify({}) });
      setNotice("Workflow action completed.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Workflow action failed.");
    } finally { setBusy(false); }
  }

  if (!workflow) return <div>{error ? <div role="alert" className="text-sm text-red-700">{error}</div> : <div className="text-sm text-slate-500">Loading workflow…</div>}</div>;
  const canCancel = ["PENDING", "WAITING_FOR_CUSTOMER", "WAITING_FOR_APPROVAL"].includes(workflow.status);
  const canProcessRefund = workflow.status === "WAITING_FOR_APPROVAL" && workflow.approvals.some((approval) => approval.status === "APPROVED");

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link href="/workflows" className="inline-flex items-center gap-2 text-xs font-semibold text-[#176b5b]"><ArrowLeft size={14} />Workflow monitor</Link>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
      <section className="panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs text-slate-400">Workflow {workflow.id}</div><h1 className="page-title mt-1">{label(workflow.type)}</h1><div className="mt-2 flex flex-wrap gap-2"><span className="badge bg-slate-100 text-slate-600">{label(workflow.status)}</span>{workflow.currentStep && <span className="badge bg-[#edf1ff] text-[#5064b6]">{label(workflow.currentStep)}</span>}</div></div><div className="flex gap-2">{canProcessRefund && <button disabled={busy} className="button button-primary flex items-center gap-2 text-xs" onClick={() => void action(`/workflows/${id}/refund/process`, "Process this approved simulated refund? This records a mock outcome only; no real funds will be transferred.")}><Play size={13} />Process mock refund</button>}{workflow.status === "FAILED" && workflow.type === "ORDER_TRACKING" && <button disabled={busy} className="button button-primary flex items-center gap-2 text-xs" onClick={() => void action(`/workflows/${id}/retry`, "Retry this read-only order-tracking workflow?") }><Play size={13} />Retry safe lookup</button>}{canCancel && <button disabled={busy} className="button flex items-center gap-2 text-xs text-rose-700" onClick={() => void action(`/workflows/${id}/cancel`, "Cancel this workflow? Active mock inventory reservations will be released.")}><Ban size={13} />Cancel</button>}</div></div>
        <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 text-xs sm:grid-cols-2"><div><div className="text-[10px] text-slate-400">Customer</div><div className="mt-1 font-semibold">{workflow.customer.name}</div></div><div><div className="text-[10px] text-slate-400">Started</div><div className="mt-1">{formatDate(workflow.createdAt)}</div></div><div><div className="text-[10px] text-slate-400">Last updated</div><div className="mt-1">{formatDate(workflow.updatedAt)}</div></div><div><div className="text-[10px] text-slate-400">Related support case</div>{workflow.supportCase ? <Link className="mt-1 block font-semibold text-[#176b5b]" href={`/cases?case=${workflow.supportCase.id}`}>{workflow.supportCase.subject} · {label(workflow.supportCase.status)}</Link> : <div className="mt-1 text-slate-500">None</div>}</div></div>
        {workflow.errorSummary && <div className="mt-4 flex gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-800"><CircleAlert size={15} className="shrink-0" />{workflow.errorSummary}</div>}
      </section>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 p-4"><h2 className="text-sm font-bold">Step execution history</h2></div>
        <div className="divide-y divide-slate-100">{workflow.steps.map((step) => <article key={step.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2">{step.status === "SUCCEEDED" ? <CheckCircle2 size={15} className="text-emerald-600" /> : <CircleAlert size={15} className="text-amber-600" />}<span className="text-xs font-semibold">{step.sequence}. {label(step.stepName)}</span><span className="badge bg-slate-100 text-slate-500">{label(step.status)}</span></div><span className="text-[10px] text-slate-400">Attempts: {step.attemptCount} · {formatDate(step.startedAt)}</span></div>{step.errorCategory && <p className="mt-2 text-[10px] text-rose-700">{label(step.errorCategory)}</p>}<div className="mt-3 grid gap-3 sm:grid-cols-2"><div><div className="text-[10px] font-semibold text-slate-500">Safe input summary</div><JsonSummary value={step.inputSummary} /></div><div><div className="text-[10px] font-semibold text-slate-500">Verified output summary</div><JsonSummary value={step.outputSummary} /></div></div></article>)}{!workflow.steps.length && <p className="p-6 text-xs text-slate-400">No steps recorded.</p>}</div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-4"><h2 className="text-sm font-bold">Verified outcome</h2><JsonSummary value={workflow.verifiedOutcome} /></section>
        <section className="panel p-4"><h2 className="text-sm font-bold">Approvals</h2>{workflow.approvals.map((approval) => <div key={approval.id} className="mt-3 rounded-lg border border-slate-100 p-3"><div className="flex justify-between gap-2 text-xs"><span className="font-semibold">{label(approval.action)}</span><span className="badge bg-slate-100 text-slate-600">{label(approval.status)}</span></div>{approval.reviewNotes && <p className="mt-2 text-[10px] text-slate-500">{approval.reviewNotes}</p>}</div>)}{!workflow.approvals.length && <p className="mt-2 text-xs text-slate-400">No approval required.</p>}</section>
      </div>

      <section className="panel p-4"><h2 className="text-sm font-bold">Audit history</h2><div className="mt-3 space-y-3">{workflow.auditEvents.map((event) => <div key={event.id} className="flex gap-3 border-l-2 border-slate-200 pl-3"><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{label(event.action)}</div><p className="mt-1 text-[10px] text-slate-500">{event.summary}</p></div><time className="whitespace-nowrap text-[9px] text-slate-400">{formatDate(event.createdAt)}</time></div>)}{!workflow.auditEvents.length && <p className="text-xs text-slate-400">No audit events recorded.</p>}</div></section>
    </div>
  );
}
