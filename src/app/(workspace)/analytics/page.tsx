"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type Breakdown = { status?: string; mode?: string; count: number };
type AnalyticsSummary = {
  period: { from: string; to: string };
  totalConversations: number;
  unassignedConversations: number;
  failedOutboundMessages: number;
  statusCounts: Breakdown[];
  currentHandlingModeCounts: Breakdown[];
  dailyVolume: Array<{ day: string; count: number }>;
  firstHumanResponse: { averageMinutes: number | null; measuredConversations: number };
  resolutionTime: { averageMinutes: number | null; measuredConversations: number };
  workflowOutcomes: Array<{ status: string; count: number; isSuccess: boolean; isFailure: boolean }>;
  metricNotes: Record<string, string>;
};
type Agent = { id: string; name: string };
type Team = { id: string; name: string };

function dayString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function metric(value: number | null, unit = "") {
  return value === null ? "Unavailable" : `${value.toFixed(1)}${unit}`;
}

export default function AnalyticsPage() {
  const [from, setFrom] = useState(() => dayString(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [to, setTo] = useState(() => dayString(new Date()));
  const [teamId, setTeamId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [channel, setChannel] = useState("");
  const [mode, setMode] = useState("");
  const [status, setStatus] = useState("");
  const [teams, setTeams] = useState<Team[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const query = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (teamId) params.set("teamId", teamId);
    if (agentId) params.set("agentId", agentId);
    if (channel) params.set("channel", channel);
    if (mode) params.set("mode", mode);
    if (status) params.set("status", status);
    return params.toString();
  }, [agentId, channel, from, mode, status, teamId, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api<AnalyticsSummary>(`/analytics/summary?${query}`));
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void Promise.all([
      api<Team[]>("/conversations/teams"),
      api<Agent[]>("/conversations/agents"),
    ]).then(([teamList, agentList]) => {
      setTeams(teamList);
      setAgents(agentList);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load analytics filters."));
  }, []);

  useEffect(() => { void load(); }, [load]);

  const maxVolume = Math.max(1, ...(data?.dailyVolume.map((item) => item.count) ?? [1]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="page-title">Operational analytics</h1>
        <p className="mt-2 text-sm text-slate-500">Company-scoped metrics calculated from persisted conversation and workflow records.</p>
      </header>

      <section className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs text-slate-500">From<input aria-label="From date" className="field mt-1 py-2" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="text-xs text-slate-500">Through<input aria-label="Through date" className="field mt-1 py-2" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
        <label className="text-xs text-slate-500">Team<select className="field mt-1 py-2" value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">All teams</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
        <label className="text-xs text-slate-500">Agent<select className="field mt-1 py-2" value={agentId} onChange={(event) => setAgentId(event.target.value)}><option value="">All agents</option>{agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label>
        <label className="text-xs text-slate-500">Channel<select className="field mt-1 py-2" value={channel} onChange={(event) => setChannel(event.target.value)}><option value="">All channels</option><option value="WEB_CHAT_MOCK">Web chat (mock)</option><option value="WHATSAPP">WhatsApp</option><option value="WHATSAPP_MOCK">WhatsApp (mock)</option></select></label>
        <label className="text-xs text-slate-500">Current mode<select className="field mt-1 py-2" value={mode} onChange={(event) => setMode(event.target.value)}><option value="">All modes</option><option value="AI_ACTIVE">AI active</option><option value="HUMAN_ACTIVE">Human active</option><option value="PAUSED">Paused</option></select></label>
        <label className="text-xs text-slate-500">Current status<select className="field mt-1 py-2" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="OPEN">Open</option><option value="PENDING">Pending</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></label>
        <button type="button" className="button button-primary self-end py-2" disabled={loading} onClick={() => void load()}>{loading ? "Refreshing…" : "Refresh metrics"}</button>
      </section>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {data && <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Conversations", String(data.totalConversations)],
            ["Unassigned conversations", String(data.unassignedConversations)],
            ["Avg. first human response", metric(data.firstHumanResponse.averageMinutes, " min")],
            ["Avg. resolution time", metric(data.resolutionTime.averageMinutes, " min")],
            ["Failed outbound replies", String(data.failedOutboundMessages)],
            ["Workflows", String(data.workflowOutcomes.reduce((sum, item) => sum + item.count, 0))],
          ].map(([title, value]) => <div className="panel p-4" key={title}><div className="text-xs text-slate-500">{title}</div><div className="mt-3 text-2xl font-bold">{value}</div></div>)}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="panel p-5">
            <h2 className="text-sm font-bold">New conversations per day</h2>
            <p className="mt-1 text-[11px] text-slate-400">Grouped by creation date (UTC)</p>
            <div className="mt-5 flex h-40 items-end gap-1 border-b border-slate-200">
              {data.dailyVolume.map((item) => <div key={item.day} title={`${item.day}: ${item.count}`} className="min-w-1 flex-1 rounded-t bg-[#4a9c81]" style={{ height: `${Math.max(3, item.count / maxVolume * 100)}%` }} />)}
              {data.dailyVolume.length === 0 && <p className="pb-4 text-xs text-slate-400">No conversations in this range.</p>}
            </div>
          </div>
          <div className="panel p-5">
            <h2 className="text-sm font-bold">Status and current handling mode</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div><h3 className="text-xs font-semibold text-slate-500">Status</h3>{data.statusCounts.map((item) => <div className="mt-2 flex justify-between text-xs" key={item.status}><span>{item.status}</span><span>{item.count}</span></div>)}</div>
              <div><h3 className="text-xs font-semibold text-slate-500">Current mode</h3>{data.currentHandlingModeCounts.map((item) => <div className="mt-2 flex justify-between text-xs" key={item.mode}><span>{item.mode}</span><span>{item.count}</span></div>)}</div>
            </div>
          </div>
          <div className="panel p-5 xl:col-span-2">
            <h2 className="text-sm font-bold">Workflow outcomes</h2>
            <div className="mt-3 flex flex-wrap gap-3">{data.workflowOutcomes.map((item) => <div key={item.status} className="rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="font-semibold">{item.status}</span><span className="ml-2 text-slate-500">{item.count}</span></div>)}</div>
          </div>
        </section>
        <details className="panel p-4">
          <summary className="cursor-pointer text-xs font-semibold">Metric definitions and limitations</summary>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-xs text-slate-500">
            <li>Conversation counts, status, mode, and daily volume are scoped by company, creation date, and selected filters. Status and mode represent current values, not historical state.</li>
            <li>First human response is measured from conversation creation to the first recorded human response. AI replies and records without timestamps are excluded; unavailable means no eligible records.</li>
            <li>Resolution time is measured from creation to recorded resolution and excludes records without a resolution timestamp.</li>
            <li>Workflow outcomes are company-scoped and date-filtered by workflow creation time; the conversation filters do not apply to this count.</li>
            <li>Failed outbound counts include failed, non-internal agent messages only. Internal notes are excluded.</li>
            {Object.entries(data.metricNotes).map(([key, note]) => <li key={key}>{key}: {note}</li>)}
          </ul>
          <p className="mt-3 text-[10px] text-slate-400">Measured first-response records: {data.firstHumanResponse.measuredConversations}; measured resolution records: {data.resolutionTime.measuredConversations}.</p>
        </details>
      </>}
    </div>
  );
}
