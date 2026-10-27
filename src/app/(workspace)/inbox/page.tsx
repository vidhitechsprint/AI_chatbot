"use client";

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import { Search, Send, MessageSquareText, StickyNote, Bot, Sparkles, ChevronLeft, ChevronRight, Bell, Mail, Phone, Circle } from "lucide-react";
import { io } from "socket.io-client";
import { API_URL, api, formatDate, initials, label, statusColor } from "@/lib/api";

type Conversation = {
  id: string; status: string; mode: string; unreadCount: number; updatedAt: string;
  assigneeId: string | null; teamId: string | null; firstHumanResponseAt: string | null;
  resolvedAt: string | null; resolutionCategory: string | null;
  assignee: { id: string; name: string } | null; team: { id: string; name: string } | null;
  customer: { id: string; name: string; email: string | null; phone: string | null };
  channelAccount: { type: string; isMock: boolean };
  messages: Array<{
    id: string; body: string; sender: string; isInternal: boolean; createdAt: string;
    user?: { id: string; name: string } | null;
    messageType?: string; deliveryStatus?: string | null; providerMetadata?: { error?: string; retryable?: boolean } | null;
  }>;
  cases: Array<{ id: string; subject: string; status: string; assignee: { name: string } | null; team: { name: string } | null }>;
  assignmentHistory?: Array<{
    id: string; createdAt: string; actor: { name: string } | null;
    fromAssignee: { name: string } | null; toAssignee: { name: string } | null;
    fromTeam: { name: string } | null; toTeam: { name: string } | null;
  }>;
};
type Message = Conversation["messages"][number];
type WhatsAppTemplate = { name: string; language: string };
type Agent = { id: string; name: string };
type Team = { id: string; name: string; members: Array<{ userId: string }> };
type InboxPageResult = { data: Conversation[]; page: number; limit: number; total: number; totalPages: number };
type Workload = { unassigned: number; active: number; firstResponseSlaMinutes: number; waiting: Array<{ conversationId: string; waitingSince: string; overdue: boolean }> };
type InboxSettings = { routingStrategy: string; firstResponseSlaMinutes: number };
type AiRun = {
  id: string; status: string; intent: string | null; outcome: string | null; reasoningSummary: string | null;
  escalationReason: string | null; finalText: string | null; errorCategory: string | null;
  inputTokens: number | null; outputTokens: number | null; assistantMessageId: string | null;
  createdAt: string; toolExecutions: Array<{ toolName: string; status: string; resultSummary: string | null; errorCategory: string | null }>;
};

export default function InboxPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [role, setRole] = useState("");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [routingStrategy, setRoutingStrategy] = useState("MANUAL");
  const [slaMinutes, setSlaMinutes] = useState(60);
  const [draft, setDraft] = useState("");
  const [sendKey, setSendKey] = useState<string | null>(null);
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [incomingDraft, setIncomingDraft] = useState("");
  const [aiRuns, setAiRuns] = useState<AiRun[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNotice, setAiNotice] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateParameters, setTemplateParameters] = useState("[]");
  const aiMessageIds = new Set(aiRuns.map((run) => run.assistantMessageId).filter((id): id is string => Boolean(id)));

  const load = useCallback(async (id?: string) => {
    try {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      if (filter !== "ALL") query.set("filter", filter);
      query.set("page", String(page));
      query.set("limit", "25");
      const result = await api<InboxPageResult>(`/conversations?${query.toString()}`);
      setItems(result.data);
      setTotalPages(result.totalPages);
      const target = id ?? selected?.id ?? result.data[0]?.id;
      if (target) {
        const details = await api<Conversation>(`/conversations/${target}`);
        if (details.unreadCount > 0) {
          await api(`/conversations/${target}/read`, { method: "PATCH" });
          details.unreadCount = 0;
          setItems((current) => current.map((item) => item.id === target ? { ...item, unreadCount: 0 } : item));
        }
        setSelected(details);
      } else {
        setSelected(null);
      }
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load inbox."); }
  }, [filter, page, search, selected?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void api<{ user: { role: string } }>("/auth/me")
      .then(({ user }) => {
        setRole(user.role);
        return Promise.all([
          api<Agent[]>("/conversations/agents"),
          api<Team[]>("/conversations/teams"),
          api<Workload>("/conversations/workload"),
          api<{ unread: number }>("/notifications?page=1&limit=1"),
          api<InboxSettings>("/conversations/settings"),
        ]);
      })
      .then(([agentList, teamList, workloadResult, notificationResult, settings]) => {
        setAgents(agentList);
        setTeams(teamList);
        setWorkload(workloadResult);
        setUnreadNotifications(notificationResult.unread);
        setRoutingStrategy(settings.routingStrategy);
        setSlaMinutes(settings.firstResponseSlaMinutes);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load agent workspace data."));
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    const socket = io(new URL(API_URL).origin, { withCredentials: true });
    const refresh = () => {
      void loadRef.current();
      void api<Workload>("/conversations/workload").then(setWorkload)
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh workload."));
      void api<{ unread: number }>("/notifications?page=1&limit=1")
        .then((result) => setUnreadNotifications(result.unread))
        .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not refresh notifications."));
    };
    socket.on("workspace:update", refresh);
    const fallback = window.setInterval(refresh, 15000);
    return () => {
      window.clearInterval(fallback);
      socket.off("workspace:update", refresh);
      socket.disconnect();
    };
  }, []);

  const loadAiRuns = useCallback(async (conversationId: string) => {
    try {
      setAiRuns(await api<AiRun[]>(`/ai/conversations/${conversationId}/runs`));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load AI activity.");
    }
  }, []);

  useEffect(() => {
    if (selected?.id) void loadAiRuns(selected.id);
    else setAiRuns([]);
  }, [loadAiRuns, selected?.id]);

  useEffect(() => {
    setTemplates([]);
    setTemplateName("");
    if (selected?.channelAccount.type !== "WHATSAPP") return;
    void api<WhatsAppTemplate[]>(`/conversations/${selected.id}/whatsapp-templates`)
      .then(setTemplates)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load approved WhatsApp templates."));
  }, [selected?.channelAccount.type, selected?.id]);

  async function simulateIncoming(event: FormEvent) {
    event.preventDefault();
    if (!selected || !incomingDraft.trim()) return;
    setAiBusy(true); setError(""); setAiNotice("");
    try {
      const result = await api<{ run: AiRun | null; processing?: string }>(`/conversations/${selected.id}/incoming-messages`, {
        method: "POST",
        body: JSON.stringify({ body: incomingDraft.trim(), idempotencyKey: crypto.randomUUID() }),
      });
      setIncomingDraft("");
      if (result.processing === "DISABLED") setAiNotice("Customer message saved. AI processing is disabled for this company.");
      else if (result.run?.status === "FAILED" || result.run?.status === "TIMED_OUT") setAiNotice("The message was saved, but AI processing did not complete. No AI reply was sent.");
      else setAiNotice("Customer message saved and processed. Review the AI activity below.");
      await load(selected.id);
      await loadAiRuns(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save or process the incoming message.");
    } finally { setAiBusy(false); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!selected || (!draft.trim() && !templateName)) return;
    setBusy(true);
    setError("");
    try {
      const idempotencyKey = sendKey ?? crypto.randomUUID();
      setSendKey(idempotencyKey);
      let parameters: string[] = [];
      if (templateName) {
        const parsed: unknown = JSON.parse(templateParameters);
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
          throw new Error("Template parameters must be a JSON array of strings.");
        }
        parameters = parsed;
      }
      const result = await api<Message | { message: Message; sent: boolean; error: string | null }>(`/conversations/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          body: draft.trim() || `[WhatsApp template: ${templateName}]`,
          isInternal: internal,
          idempotencyKey,
          ...(templateName ? {
            templateName,
            templateLanguage: templates.find((template) => template.name === templateName)?.language,
            templateParameters: parameters,
          } : {}),
        }),
      });
      setDraft("");
      setSendKey(null);
      const sendError = "message" in result ? result.error : null;
      if (sendError) setError(sendError);
      else setTemplateName("");
      await load(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message could not be saved.");
    } finally { setBusy(false); }
  }

  async function retryMessage(messageId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      let parameters: string[] = [];
      if (templateName) {
        const parsed: unknown = JSON.parse(templateParameters);
        if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
          throw new Error("Template parameters must be a JSON array of strings.");
        }
        parameters = parsed;
      }
      const result = await api<{ sent: boolean; error: string | null }>(
        `/conversations/${selected.id}/messages/${messageId}/retry`,
        {
          method: "POST",
          body: JSON.stringify(templateName ? {
            templateName,
            templateLanguage: templates.find((template) => template.name === templateName)?.language,
            templateParameters: parameters,
          } : {}),
        },
      );
      if (result.error) setError(result.error);
      else {
        setError("");
        setTemplateName("");
      }
      await load(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Message retry failed.");
    } finally { setBusy(false); }
  }

  async function changeMode(mode: string) {
    if (!selected) return;
    try {
      await api(`/conversations/${selected.id}/mode`, {
        method: "PATCH",
        body: JSON.stringify({ mode }),
      });
      await load(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not change conversation mode.");
    }
  }

  async function changeAssignment(assigneeId: string | null, teamId: string | null) {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/conversations/${selected.id}/assignment`, {
        method: "POST",
        body: JSON.stringify({ assigneeId, teamId }),
      });
      await load(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update assignment.");
    } finally { setBusy(false); }
  }

  async function acceptConversation() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/conversations/${selected.id}/accept`, { method: "POST" });
      await load(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not accept this conversation.");
    } finally { setBusy(false); }
  }

  async function routeConversation() {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/conversations/${selected.id}/route`, {
        method: "POST",
        body: JSON.stringify({ teamId: selected.teamId }),
      });
      await load(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not route this conversation.");
    } finally { setBusy(false); }
  }

  async function changeStatus(status: string) {
    if (!selected) return;
    setBusy(true);
    try {
      await api(`/conversations/${selected.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "RESOLVED" ? { resolutionCategory: selected.resolutionCategory || "Other" } : {}),
        }),
      });
      await load(selected.id);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update conversation status.");
    } finally { setBusy(false); }
  }

  async function saveInboxSettings() {
    try {
      const settings = await api<InboxSettings>("/conversations/settings", {
        method: "PATCH",
        body: JSON.stringify({ routingStrategy, firstResponseSlaMinutes: slaMinutes }),
      });
      setRoutingStrategy(settings.routingStrategy);
      setSlaMinutes(settings.firstResponseSlaMinutes);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save inbox settings.");
    }
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.12em] text-[#176b5b]"><MessageSquareText size={14} /> Shared workspace</div><h1 className="page-title mt-2">Inbox</h1><p className="mt-2 text-sm text-slate-500">One inbox for web chat and connected WhatsApp conversations.</p></div><div className="text-right text-xs text-slate-500"><div className="flex items-center justify-end gap-1"><Bell size={14} /> {unreadNotifications} unread notifications</div>{workload && <div className="mt-1">{workload.active} active · {workload.unassigned} unassigned</div>}</div></div>
      {role === "ADMIN" && <div className="panel flex flex-wrap items-end gap-3 p-4"><div><label className="text-[10px] font-semibold text-slate-500">Routing strategy</label><select className="field mt-1 py-2 text-xs" value={routingStrategy} onChange={(event) => setRoutingStrategy(event.target.value)}><option value="MANUAL">Manual / unassigned queue</option><option value="ROUND_ROBIN">Round robin</option><option value="LEAST_ACTIVE">Least active agent</option></select></div><div><label className="text-[10px] font-semibold text-slate-500">First response target (minutes)</label><input className="field mt-1 w-36 py-2 text-xs" type="number" min={1} max={10080} value={slaMinutes} onChange={(event) => setSlaMinutes(Number(event.target.value))} /></div><button type="button" className="button button-primary px-3 py-2 text-xs" onClick={() => void saveInboxSettings()}>Save inbox settings</button></div>}
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      <div className="panel grid min-h-[650px] overflow-hidden lg:grid-cols-[330px_minmax(0,1fr)_250px]">
        <section className="flex min-h-[300px] flex-col border-r border-slate-100">
          <div className="border-b border-slate-100 p-4"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Conversations</h2><span className="badge bg-slate-100 text-slate-500">{items.length}</span></div><div className="relative mt-3"><Search size={15} className="absolute top-2.5 left-3 text-slate-400" /><input className="field pl-9 text-xs" placeholder="Search customers..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} onKeyDown={(event) => { if (event.key === "Enter") void load(); }} /></div><select className="field mt-2 py-2 text-xs" value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}><option value="ALL">All accessible</option><option value="MINE">My conversations</option><option value="UNASSIGNED">Unassigned queue</option><option value="TEAM">Team conversations</option><option value="AI_HANDLED">AI handled</option><option value="WAITING_FOR_CUSTOMER">Waiting for customer</option><option value="WAITING_FOR_AGENT">Waiting for agent</option><option value="ESCALATED">Escalated</option><option value="RESOLVED">Resolved</option></select></div>
          <div className="flex-1 overflow-y-auto">{items.map((item) => {
            const last = item.messages[0];
            return <button key={item.id} onClick={() => void load(item.id)} className={`w-full border-b border-slate-100 p-4 text-left hover:bg-slate-50 ${selected?.id === item.id ? "bg-[#f4faf7]" : ""}`}>
              <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#edf2f6] text-xs font-semibold text-slate-600">{initials(item.customer.name)}</div><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><div className="truncate text-xs font-semibold">{item.customer.name}</div><time className="whitespace-nowrap text-[9px] text-slate-400">{formatDate(item.updatedAt)}</time></div><p className="mt-1 truncate text-[11px] text-slate-500">{last?.body ?? "No messages yet"}</p><div className="mt-2 flex items-center gap-2"><span className="badge bg-slate-100 px-2 py-0.5 text-[9px] text-slate-500">{label(item.channelAccount.type)}</span><span className="badge px-2 py-0.5 text-[9px]" style={statusColor(item.status)}>{label(item.status)}</span></div></div>{item.unreadCount > 0 && <span className="mt-1 h-2 w-2 rounded-full bg-[#389978]" />}</div>
            </button>;
          })}{items.length === 0 && <div className="p-8 text-center text-xs text-slate-400">No conversations match this filter.</div>}</div>
          <div className="flex items-center justify-between border-t border-slate-100 p-3 text-[10px]"><button className="button px-2 py-1" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft size={13} /></button><span>Page {page} of {totalPages}</span><button className="button px-2 py-1" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}><ChevronRight size={13} /></button></div>
        </section>
        <section className="flex min-h-[400px] flex-col">
          {selected ? <>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#edf2f6] text-xs font-semibold">{initials(selected.customer.name)}</div><div><div className="text-sm font-bold">{selected.customer.name}</div><div className="mt-0.5 text-[10px] text-slate-400">{label(selected.channelAccount.type)}{selected.channelAccount.type === "WHATSAPP" ? " · Connected account" : " · Mock channel"}</div></div></div><div className="flex items-center gap-2"><span className="badge" style={statusColor(selected.status)}>{label(selected.status)}</span><select aria-label="Conversation mode" className="field w-auto py-1.5 text-[10px]" value={selected.mode} onChange={(event) => void changeMode(event.target.value)}><option value="AI_ACTIVE">AI active</option><option value="HUMAN_ACTIVE">Human active</option><option value="PAUSED">Paused</option></select></div></div>
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-white px-4 py-3">
              {role === "ADMIN" ? <>
                <select aria-label="Assigned team" className="field w-auto py-1.5 text-[10px]" value={selected.teamId ?? ""} onChange={(event) => void changeAssignment(null, event.target.value || null)} disabled={busy}>
                  <option value="">No team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
                </select>
                <select aria-label="Assigned agent" className="field w-auto py-1.5 text-[10px]" value={selected.assigneeId ?? ""} onChange={(event) => void changeAssignment(event.target.value || null, selected.teamId)} disabled={busy}>
                  <option value="">Unassigned agent</option>{agents.filter((agent) => !selected.teamId || teams.find((team) => team.id === selected.teamId)?.members.some((member) => member.userId === agent.id)).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                </select>
                <button type="button" className="button px-2 py-1 text-[10px]" disabled={busy} onClick={() => void routeConversation()}>Auto-route</button>
              </> : !selected.assigneeId && <button type="button" className="button button-primary px-2 py-1 text-[10px]" disabled={busy} onClick={() => void acceptConversation()}>Accept conversation</button>}
              <span className="text-[10px] text-slate-500">Assigned to {selected.assignee?.name ?? selected.team?.name ?? "Unassigned"}</span>
              {selected.status === "RESOLVED" ? <button type="button" className="button px-2 py-1 text-[10px]" disabled={busy} onClick={() => void changeStatus("OPEN")}>Reopen</button> : <button type="button" className="button px-2 py-1 text-[10px]" disabled={busy} onClick={() => void changeStatus("RESOLVED")}>Resolve</button>}
              {workload?.waiting.find((entry) => entry.conversationId === selected.id) && <span className={`badge ${workload.waiting.find((entry) => entry.conversationId === selected.id)?.overdue ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-500"}`}>Waiting for agent · SLA {workload.waiting.find((entry) => entry.conversationId === selected.id)?.overdue ? "overdue" : "running"}</span>}
            </div>
            {aiNotice && <div role="status" className="border-b border-[#d9ece6] bg-[#f2faf7] px-5 py-2 text-[10px] text-[#176b5b]">{aiNotice}</div>}
            <div className="flex-1 space-y-4 overflow-y-auto bg-[#fafbfd] p-5">
              <div className="text-center text-[10px] text-slate-400">Conversation started {formatDate(selected.messages[0]?.createdAt)}</div>
              {selected.messages.map((message) => <div key={message.id} className={`flex ${message.sender === "AGENT" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-5 ${message.isInternal ? "border border-amber-200 bg-amber-50 text-amber-900" : message.sender === "AGENT" || message.sender === "SYSTEM" && aiMessageIds.has(message.id) ? "rounded-br-sm bg-[#176b5b] text-white" : "rounded-bl-sm border border-slate-200 bg-white text-slate-700"}`}>
                  <div className={`mb-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide ${message.sender === "AGENT" && !message.isInternal ? "text-white/65" : "text-slate-400"}`}>{message.isInternal ? <><StickyNote size={10} /> Internal note · {message.user?.name ?? "Agent"}</> : message.sender === "SYSTEM" ? aiMessageIds.has(message.id) ? "SupportDesk AI · model-generated" : "System message · simulated" : message.sender === "AGENT" ? `Support agent · ${message.user?.name ?? "Agent"}` : "Customer"}</div>
                  <div>{message.body}</div><div className={`mt-1 flex items-center justify-end gap-2 text-[9px] ${message.sender === "AGENT" && !message.isInternal ? "text-white/55" : "text-slate-400"}`}>{formatDate(message.createdAt)}{message.deliveryStatus && <span className={message.deliveryStatus === "FAILED" ? "font-semibold text-rose-600" : ""}>{label(message.deliveryStatus)}</span>}</div>
                  {message.deliveryStatus === "FAILED" && !message.isInternal && <div className="mt-2 text-[10px] text-rose-700">{message.providerMetadata?.error ?? "WhatsApp send failed."}{message.providerMetadata?.retryable !== false && <button disabled={busy} type="button" className="ml-2 underline" onClick={() => void retryMessage(message.id)}>Retry</button>}</div>}
                </div>
              </div>)}
            </div>
            {selected.channelAccount.type !== "WHATSAPP" && <form onSubmit={simulateIncoming} className="border-t border-slate-100 bg-[#f7f9fb] px-4 py-3">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-slate-500"><Sparkles size={12} className="text-[#176b5b]" />Simulate incoming customer message · triggers AI when enabled</div>
              <div className="flex gap-2"><input className="field py-2 text-xs" value={incomingDraft} onChange={(event) => setIncomingDraft(event.target.value)} placeholder="Type an incoming customer message..." /><button disabled={aiBusy || !incomingDraft.trim() || selected.mode !== "AI_ACTIVE"} className="button flex shrink-0 items-center gap-1.5 text-[10px]"><Bot size={14} />{aiBusy ? "Processing…" : "Send to AI"}</button></div>
            </form>}
            <form onSubmit={send} className="border-t border-slate-100 p-4">
              <div className="mb-3 flex gap-2"><button type="button" onClick={() => setInternal(false)} className={`rounded-md px-3 py-1.5 text-[10px] font-semibold ${!internal ? "bg-[#e7f4ef] text-[#176b5b]" : "text-slate-400"}`}>Reply</button><button type="button" onClick={() => setInternal(true)} className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-[10px] font-semibold ${internal ? "bg-amber-100 text-amber-800" : "text-slate-400"}`}><StickyNote size={12} />Internal note</button></div>
              {!internal && selected.channelAccount.type === "WHATSAPP" && templates.length > 0 && <div className="mb-2 grid gap-2 sm:grid-cols-[1fr_1fr]"><select className="field py-2 text-xs" value={templateName} onChange={(event) => setTemplateName(event.target.value)}><option value="">Free-form reply (24-hour window)</option>{templates.map((template) => <option key={`${template.name}-${template.language}`} value={template.name}>{template.name} · {template.language}</option>)}</select>{templateName && <input className="field py-2 text-xs" value={templateParameters} onChange={(event) => setTemplateParameters(event.target.value)} aria-label="Template parameters as JSON array" placeholder='Template parameters, e.g. ["Alex"]' />}</div>}
              <div className="flex items-end gap-2"><textarea className="field min-h-[68px] resize-y text-xs" value={draft} onKeyDown={handleComposerKeyDown} onChange={(event) => { setDraft(event.target.value); setSendKey(null); }} disabled={selected.status === "RESOLVED" || selected.status === "CLOSED"} placeholder={internal ? "Write an internal note…" : selected.channelAccount.type === "WHATSAPP" ? "Write a WhatsApp reply…" : "Write a mock reply…"} /><button disabled={busy || (!draft.trim() && !templateName) || selected.status === "RESOLVED" || selected.status === "CLOSED"} className="button button-primary h-10 px-3" aria-label={internal ? "Save internal note" : selected.channelAccount.type === "WHATSAPP" ? "Send WhatsApp reply" : "Send mock reply"}><Send size={15} /></button></div>
              <div className="mt-1 text-[9px] text-slate-400">Enter to send · Shift+Enter for a new line{selected.status === "RESOLVED" || selected.status === "CLOSED" ? " · Reopen the conversation to reply" : ""}</div>
              <div className="mt-2 text-[9px] text-slate-400">{selected.channelAccount.type === "WHATSAPP" ? "Replies are sent through Meta Cloud API. Free-form messages require an open 24-hour window." : "Mock-channel replies remain local and do not call an external service."}</div>
            </form>
            <div className="border-t border-slate-100 p-4 lg:hidden"><h3 className="flex items-center gap-1.5 text-xs font-bold"><Bot size={14} className="text-[#176b5b]" />AI activity</h3>{aiRuns.length === 0 ? <p className="mt-2 text-[10px] text-slate-400">No AI runs for this conversation yet.</p> : <div className="mt-2 space-y-2">{aiRuns.map((run) => <div key={run.id} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap gap-1.5"><span className="badge bg-slate-100 text-slate-600">{label(run.status)}</span>{run.intent && <span className="badge bg-[#edf1ff] text-[#5064b6]">{label(run.intent)}</span>}{run.outcome && <span className="badge bg-[#e7f4ef] text-[#176b5b]">{label(run.outcome)}</span>}</div>{run.reasoningSummary && <p className="mt-2 text-[10px] text-slate-600">{run.reasoningSummary}</p>}{run.escalationReason && <p className="mt-2 text-[10px] text-amber-900">Escalation: {run.escalationReason}</p>}{run.errorCategory && <p className="mt-2 text-[10px] text-rose-700">Issue: {label(run.errorCategory)}</p>}{run.finalText && !run.assistantMessageId && <p className="mt-2 rounded bg-indigo-50 p-2 text-[10px] text-indigo-900"><b>Draft (not sent):</b> {run.finalText}</p>}{run.toolExecutions.map((tool, index) => <p key={`${tool.toolName}-${index}`} className="mt-1 text-[9px] text-slate-500">{label(tool.toolName)} · {tool.status} · {tool.resultSummary}</p>)}<p className="mt-2 text-[9px] text-slate-400">{run.inputTokens ?? "—"} input · {run.outputTokens ?? "—"} output tokens · {formatDate(run.createdAt)}</p></div>)}</div>}</div>
          </> : <div className="grid flex-1 place-items-center text-xs text-slate-400">Select a conversation to view its history.</div>}
        </section>
        {selected && <aside className="hidden overflow-y-auto border-l border-slate-100 p-4 lg:block"><h3 className="text-xs font-bold">Customer details</h3><div className="mt-4 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#e7f4ef] text-xs font-bold text-[#176b5b]">{initials(selected.customer.name)}</div><div><div className="text-xs font-semibold">{selected.customer.name}</div><div className="text-[10px] text-slate-400">Customer</div></div></div><div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-[11px] text-slate-500">{selected.customer.email && <div className="flex items-center gap-2"><Mail size={13} />{selected.customer.email}</div>}{selected.customer.phone && <div className="flex items-center gap-2"><Phone size={13} />{selected.customer.phone}</div>}<div className="flex items-center gap-2"><Circle size={12} />{label(selected.channelAccount.type)}</div></div><div className="mt-6 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold">Assignment history</h3>{selected.assignmentHistory?.length ? selected.assignmentHistory.map((entry) => <div key={entry.id} className="mt-3 text-[10px] text-slate-500"><div>{entry.actor?.name ?? "System"} · {formatDate(entry.createdAt)}</div><div className="mt-1">{entry.fromAssignee?.name ?? entry.fromTeam?.name ?? "Unassigned"} → {entry.toAssignee?.name ?? entry.toTeam?.name ?? "Unassigned"}</div></div>) : <p className="mt-3 text-[10px] text-slate-400">No assignment changes recorded.</p>}</div><div className="mt-6 border-t border-slate-100 pt-4"><h3 className="text-xs font-bold">Related support case</h3>{selected.cases.length ? selected.cases.map((item) => <a className="mt-3 block rounded-lg border border-slate-100 p-3 hover:border-[#b7d9cd]" key={item.id} href={`/cases?case=${item.id}`}><div className="text-[11px] font-semibold">{item.subject}</div><div className="mt-2 flex flex-wrap gap-1"><span className="badge" style={statusColor(item.status)}>{label(item.status)}</span></div><div className="mt-2 text-[10px] text-slate-400">{item.assignee?.name ?? item.team?.name ?? "Unassigned"}</div></a>) : <p className="mt-3 text-[11px] text-slate-400">No linked support case.</p>}</div><div className="mt-6 border-t border-slate-100 pt-4"><h3 className="flex items-center gap-1.5 text-xs font-bold"><Bot size={14} className="text-[#176b5b]" />AI activity</h3>{aiRuns.length === 0 ? <p className="mt-3 text-[10px] text-slate-400">No AI runs for this conversation yet.</p> : <div className="mt-3 space-y-3">{aiRuns.map((run) => <div key={run.id} className="rounded-lg border border-slate-100 p-3"><div className="flex flex-wrap items-center gap-1.5"><span className="badge bg-slate-100 text-slate-600">{label(run.status)}</span>{run.intent && <span className="badge bg-[#edf1ff] text-[#5064b6]">{label(run.intent)}</span>}{run.outcome && <span className="badge bg-[#e7f4ef] text-[#176b5b]">{label(run.outcome)}</span>}</div>{run.reasoningSummary && <p className="mt-2 text-[10px] leading-4 text-slate-600">{run.reasoningSummary}</p>}{run.escalationReason && <p className="mt-2 rounded bg-amber-50 p-2 text-[10px] text-amber-900">Escalation: {run.escalationReason}</p>}{run.errorCategory && <p className="mt-2 text-[10px] text-rose-700">Processing issue: {label(run.errorCategory)}</p>}{run.finalText && !run.assistantMessageId && <div className="mt-2 rounded bg-indigo-50 p-2 text-[10px] text-indigo-900"><b>Draft (not sent):</b> {run.finalText}</div>}{run.toolExecutions.map((tool, index) => <div key={`${tool.toolName}-${index}`} className="mt-2 border-t border-slate-100 pt-2 text-[9px]"><div className="flex justify-between gap-1"><span className="font-semibold">{label(tool.toolName)}</span><span className={tool.status === "SUCCEEDED" ? "text-emerald-700" : "text-rose-700"}>{tool.status}</span></div>{tool.resultSummary && <p className="mt-1 text-slate-500">{tool.resultSummary}</p>}</div>)}<div className="mt-2 text-[9px] text-slate-400">{run.inputTokens ?? "—"} input · {run.outputTokens ?? "—"} output tokens · {formatDate(run.createdAt)}</div></div>)}</div>}</div></aside>}
      </div>
    </div>
  );
}
