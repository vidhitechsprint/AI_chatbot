"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, RefreshCw, ShieldCheck, Workflow as WorkflowIcon } from "lucide-react";
import { api, formatDate, label } from "@/lib/api";

type WorkflowRow = {
  id: string;
  type: string;
  status: string;
  currentStep: string | null;
  createdAt: string;
  updatedAt: string;
  errorSummary: string | null;
  customer: { id: string; name: string };
  steps: Array<{ id: string; status: string }>;
  approvals: Array<{ id: string; action: string; status: string }>;
};
type Approval = {
  id: string;
  action: string;
  reason: string;
  parameters: { amount?: string; currency?: string; orderNumber?: string };
  status: string;
  workflow: { id: string; type: string; customer: { name: string } };
};
type Policy = {
  returnWindowDays: number;
  refundApprovalThreshold: string;
  requireRefundApproval: boolean;
  allowSimulatedRefunds: boolean;
  requireCustomerConfirmation: boolean;
};

export default function WorkflowMonitorPage() {
  const [workflows, setWorkflows] = useState<WorkflowRow[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const query = new URLSearchParams();
      if (status) query.set("status", status);
      if (type) query.set("type", type);
      const [workflowRows, approvalRows, currentPolicy] = await Promise.all([
        api<WorkflowRow[]>(`/workflows?${query}`),
        api<Approval[]>("/workflows/approvals"),
        api<Policy>("/workflows/policy"),
      ]);
      setWorkflows(workflowRows);
      setApprovals(approvalRows);
      setPolicy(currentPolicy);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load workflow monitor.");
    }
  }, [status, type]);

  useEffect(() => { void load(); }, [load]);

  async function reviewApproval(id: string, decision: "APPROVED" | "REJECTED") {
    setBusyId(id); setError(""); setNotice("");
    try {
      await api(`/workflows/approvals/${id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, notes: decision === "APPROVED" ? "Approved for mock processing after policy review." : "Rejected after policy review." }),
      });
      setNotice(`Approval ${decision.toLowerCase()}.`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update approval.");
    } finally { setBusyId(""); }
  }

  async function savePolicy(event: FormEvent) {
    event.preventDefault();
    if (!policy) return;
    setSavingPolicy(true); setError(""); setNotice("");
    try {
      setPolicy(await api<Policy>("/workflows/policy", {
        method: "PATCH",
        body: JSON.stringify(policy),
      }));
      setNotice("Business policy saved.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save business policy.");
    } finally { setSavingPolicy(false); }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div><div className="text-xs text-slate-400">Deterministic mock business operations</div><h1 className="page-title mt-1">Workflow monitor</h1><p className="mt-2 text-sm text-slate-500">Review execution state, verified steps, policy, and human approvals.</p></div>
        <button type="button" className="button flex items-center gap-2 text-xs" onClick={() => void load()}><RefreshCw size={14} />Refresh</button>
      </header>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}

      <section className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4"><ClipboardCheck size={16} className="text-[#176b5b]" /><h2 className="text-sm font-bold">Pending human approvals</h2></div>
        <div className="divide-y divide-slate-100">
          {approvals.filter((approval) => approval.status === "PENDING").map((approval) => (
            <article key={approval.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1"><div className="text-xs font-semibold">{label(approval.action)} · {approval.workflow.customer.name}</div><p className="mt-1 text-[10px] text-slate-500">{approval.reason} {approval.parameters.amount && `Amount: ${approval.parameters.currency} ${approval.parameters.amount}`}</p><Link className="mt-1 inline-block text-[10px] font-semibold text-[#176b5b]" href={`/workflows/${approval.workflow.id}`}>Review workflow</Link></div>
              <button disabled={busyId === approval.id} className="button button-primary text-xs" onClick={() => void reviewApproval(approval.id, "APPROVED")}>Approve</button>
              <button disabled={busyId === approval.id} className="button text-xs text-rose-700" onClick={() => void reviewApproval(approval.id, "REJECTED")}>Reject</button>
            </article>
          ))}
          {approvals.every((approval) => approval.status !== "PENDING") && <p className="p-6 text-center text-xs text-slate-400">No pending approvals.</p>}
        </div>
      </section>

      {policy && <form onSubmit={savePolicy} className="panel overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 p-4"><ShieldCheck size={16} className="text-[#176b5b]" /><div><h2 className="text-sm font-bold">Business policy</h2><p className="mt-1 text-[10px] text-slate-400">Backend-enforced limits; simulated refunds never transfer real money.</p></div></div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-600">Return window (days)<input className="field mt-2 text-xs" type="number" min={1} max={90} value={policy.returnWindowDays} onChange={(event) => setPolicy({ ...policy, returnWindowDays: Number(event.target.value) })} /></label>
          <label className="text-xs font-semibold text-slate-600">Human approval threshold (currency units)<input className="field mt-2 text-xs" type="number" min={0} step="0.01" value={policy.refundApprovalThreshold} onChange={(event) => setPolicy({ ...policy, refundApprovalThreshold: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={policy.requireRefundApproval} onChange={(event) => setPolicy({ ...policy, requireRefundApproval: event.target.checked })} />Require human approval for refunds</label>
          <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={policy.requireCustomerConfirmation} onChange={(event) => setPolicy({ ...policy, requireCustomerConfirmation: event.target.checked })} />Require customer confirmation</label>
          <label className="flex items-center gap-2 text-xs text-amber-800 sm:col-span-2"><input type="checkbox" checked={policy.allowSimulatedRefunds} onChange={(event) => setPolicy({ ...policy, allowSimulatedRefunds: event.target.checked })} />Allow simulated refunds after all required approval checks (mock only)</label>
        </div>
        <div className="flex justify-end border-t border-slate-100 bg-slate-50 p-4"><button disabled={savingPolicy} className="button button-primary text-xs">{savingPolicy ? "Saving…" : "Save business policy"}</button></div>
      </form>}

      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4"><div className="flex items-center gap-2"><WorkflowIcon size={16} className="text-[#176b5b]" /><h2 className="text-sm font-bold">Workflow executions</h2></div><div className="flex gap-2"><select aria-label="Filter workflows by status" className="field text-xs" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{["PENDING", "RUNNING", "WAITING_FOR_CUSTOMER", "WAITING_FOR_APPROVAL", "COMPLETED", "ESCALATED", "FAILED", "CANCELLED"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select aria-label="Filter workflows by type" className="field text-xs" value={type} onChange={(event) => setType(event.target.value)}><option value="">All workflows</option>{["ORDER_TRACKING", "WRONG_ITEM_REPLACEMENT", "RETURN_REFUND"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></div></div>
        <div className="divide-y divide-slate-100">
          {workflows.map((workflow) => {
            const successfulSteps = workflow.steps.filter((step) => step.status === "SUCCEEDED").length;
            return <Link key={workflow.id} href={`/workflows/${workflow.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-slate-50">
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold">{label(workflow.type)}</span><span className="badge bg-slate-100 text-slate-600">{label(workflow.status)}</span></div><p className="mt-1 text-[10px] text-slate-500">{workflow.customer.name} · Current step: {workflow.currentStep ? label(workflow.currentStep) : "—"}</p>{workflow.errorSummary && <p className="mt-1 text-[10px] text-rose-700">{workflow.errorSummary}</p>}</div>
              <span className="text-[10px] text-slate-500">{successfulSteps}/{workflow.steps.length} steps · {formatDate(workflow.createdAt)}</span>
            </Link>;
          })}
          {!workflows.length && <p className="p-8 text-center text-xs text-slate-400">No workflow executions match these filters.</p>}
        </div>
      </section>
    </div>
  );
}
