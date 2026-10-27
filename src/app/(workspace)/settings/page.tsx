"use client";

import { FormEvent, useEffect, useState } from "react";
import { Bot, Building2, Save, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

type Company = { id: string; name: string; slug: string; supportEmail: string; timeZone: string; defaultPriority: string };
type AiSettings = {
  aiEnabled: boolean; aiAutoReplyEnabled: boolean; aiToolExecutionEnabled: boolean; aiEscalateOnFailure: boolean; aiMaxToolRounds: number;
  autoReplyEnvironmentEnabled: boolean; toolExecutionEnvironmentEnabled: boolean; providerConfigured: boolean; provider: string; model: string;
};
export default function SettingsPage() {
  const [company, setCompany] = useState<Company | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [aiSettings, setAiSettings] = useState<AiSettings | null>(null);
  const [aiMessage, setAiMessage] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  useEffect(() => { api<Company>("/company").then(setCompany).catch((reason) => setError(reason.message)); }, []);
  useEffect(() => { api<AiSettings>("/company/ai-settings").then(setAiSettings).catch((reason) => setError(reason.message)); }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!company) return;
    setSaving(true); setError(""); setMessage("");
    try { setCompany(await api<Company>("/company", { method: "PATCH", body: JSON.stringify(company) })); setMessage("Company settings saved."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save settings."); }
    finally { setSaving(false); }
  }
  function update(key: keyof Company, value: string) { setCompany((current) => current ? { ...current, [key]: value } : current); }
  async function saveAiSettings(event: FormEvent) {
    event.preventDefault();
    if (!aiSettings) return;
    setAiSaving(true); setError(""); setAiMessage("");
    try {
      const settings = {
        aiEnabled: aiSettings.aiEnabled,
        aiAutoReplyEnabled: aiSettings.aiAutoReplyEnabled,
        aiToolExecutionEnabled: aiSettings.aiToolExecutionEnabled,
        aiEscalateOnFailure: aiSettings.aiEscalateOnFailure,
        aiMaxToolRounds: aiSettings.aiMaxToolRounds,
      };
      const saved = await api<Pick<AiSettings, "aiEnabled" | "aiAutoReplyEnabled" | "aiToolExecutionEnabled" | "aiEscalateOnFailure" | "aiMaxToolRounds">>("/company/ai-settings", {
        method: "PATCH", body: JSON.stringify(settings),
      });
      setAiSettings({ ...aiSettings, ...saved });
      setAiMessage("AI policy settings saved.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save AI settings."); }
    finally { setAiSaving(false); }
  }
  function updateAi(key: keyof AiSettings, value: boolean | number) { setAiSettings((current) => current ? { ...current, [key]: value } : current); }
  if (!company) return <div>{error ? <div role="alert" className="text-sm text-red-700">{error}</div> : <div className="text-sm text-slate-500">Loading company settings…</div>}</div>;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><div className="text-xs text-slate-400">Customize your support workspace</div><h1 className="page-title mt-1">Company settings</h1><p className="mt-2 text-sm text-slate-500">Manage your public-facing support profile and defaults.</p></div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</div>}
      <form onSubmit={save} className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 p-5"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#e7f4ef] text-[#176b5b]"><Building2 size={17} /></div><div><h2 className="text-sm font-bold">Company profile</h2><p className="mt-1 text-[11px] text-slate-400">This information belongs to your company workspace.</p></div></div><div className="grid gap-5 p-5 sm:grid-cols-2">
        <label className="text-xs font-semibold text-slate-600">Company name<input className="field mt-2 text-xs" value={company.name} onChange={(event) => update("name", event.target.value)} required minLength={2} /></label>
        <label className="text-xs font-semibold text-slate-600">Company slug<input className="field mt-2 text-xs" value={company.slug} onChange={(event) => update("slug", event.target.value)} required minLength={2} pattern="[a-z0-9-]+" /></label>
        <label className="text-xs font-semibold text-slate-600">Support email<input className="field mt-2 text-xs" type="email" value={company.supportEmail} onChange={(event) => update("supportEmail", event.target.value)} required /></label>
        <label className="text-xs font-semibold text-slate-600">Time zone<select className="field mt-2 text-xs" value={company.timeZone} onChange={(event) => update("timeZone", event.target.value)}>{["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"].map((zone) => <option key={zone}>{zone}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-600">Default case priority<select className="field mt-2 text-xs" value={company.defaultPriority} onChange={(event) => update("defaultPriority", event.target.value)}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select></label>
      </div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4"><div className="text-[10px] text-slate-400">Company registration and billing are not part of Phase 1.</div><button disabled={saving} className="button button-primary flex items-center gap-2 text-xs"><Save size={14} />{saving ? "Saving…" : "Save changes"}</button></div></form>
      {aiSettings && <form onSubmit={saveAiSettings} className="panel overflow-hidden"><div className="flex items-center gap-3 border-b border-slate-100 p-5"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#edf1ff] text-[#5064b6]"><Bot size={17} /></div><div><h2 className="text-sm font-bold">AI agent controls</h2><p className="mt-1 text-[11px] text-slate-400">Company settings are combined with server-side safety gates.</p></div></div><div className="space-y-4 p-5">
        <label className="flex items-start justify-between gap-4"><span><span className="block text-xs font-semibold">Enable AI processing</span><span className="mt-1 block text-[10px] text-slate-400">Process simulated incoming messages using the configured model.</span></span><input aria-label="Enable AI processing" type="checkbox" checked={aiSettings.aiEnabled} onChange={(event) => updateAi("aiEnabled", event.target.checked)} className="mt-1 accent-[#176b5b]" /></label>
        <label className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4"><span><span className="block text-xs font-semibold">Allow automatic customer replies</span><span className="mt-1 block text-[10px] text-slate-400">When disabled, the AI response is saved as a draft for agent review.</span></span><input aria-label="Allow automatic customer replies" type="checkbox" checked={aiSettings.aiAutoReplyEnabled} onChange={(event) => updateAi("aiAutoReplyEnabled", event.target.checked)} className="mt-1 accent-[#176b5b]" /></label>
        <label className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4"><span><span className="block text-xs font-semibold">Enable approved AI tools</span><span className="mt-1 block text-[10px] text-slate-400">Allows company-scoped knowledge and read-only mock order tools. Server must also enable tools.</span></span><input aria-label="Enable approved AI tools" type="checkbox" checked={aiSettings.aiToolExecutionEnabled} onChange={(event) => updateAi("aiToolExecutionEnabled", event.target.checked)} className="mt-1 accent-[#176b5b]" /></label>
        <label className="flex items-start justify-between gap-4 border-t border-slate-100 pt-4"><span><span className="block text-xs font-semibold">Escalate provider failures</span><span className="mt-1 block text-[10px] text-slate-400">Create or reuse a support case if AI processing fails.</span></span><input aria-label="Escalate provider failures" type="checkbox" checked={aiSettings.aiEscalateOnFailure} onChange={(event) => updateAi("aiEscalateOnFailure", event.target.checked)} className="mt-1 accent-[#176b5b]" /></label>
        <label className="block border-t border-slate-100 pt-4 text-xs font-semibold text-slate-600">Maximum tool rounds<select className="field mt-2 max-w-[180px] text-xs" value={aiSettings.aiMaxToolRounds} onChange={(event) => updateAi("aiMaxToolRounds", Number(event.target.value))}>{[1, 2, 3, 4, 5].map((round) => <option key={round} value={round}>{round}</option>)}</select></label>
        <div className="rounded-lg bg-slate-50 p-3 text-[10px] leading-5 text-slate-600"><div className="flex items-center gap-1 font-semibold"><ShieldCheck size={12} />Server-side provider status</div><div>Provider: {aiSettings.provider} · Model: {aiSettings.model}</div><div>API key: {aiSettings.providerConfigured ? "Configured" : "Not configured"}</div><div>Automatic replies gate: {aiSettings.autoReplyEnvironmentEnabled ? "Enabled" : "Disabled by server"}</div><div>Tool execution gate: {aiSettings.toolExecutionEnvironmentEnabled ? "Enabled" : "Disabled by server"}</div><div className="mt-1">Set <code>OPENAI_API_KEY</code>, and deliberately enable <code>AI_ENABLE_AUTO_REPLY</code>/<code>AI_ENABLE_TOOL_EXECUTION</code> in the API environment to allow those capabilities.</div></div>
      </div><div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-4"><span className="text-[10px] text-amber-700">Refunds, cancellations, returns, payments, and carrier actions are never executed.</span><button disabled={aiSaving} className="button button-primary flex items-center gap-2 text-xs"><Save size={14} />{aiSaving ? "Saving…" : "Save AI controls"}</button></div></form>}
      {aiMessage && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{aiMessage}</div>}
    </div>
  );
}
