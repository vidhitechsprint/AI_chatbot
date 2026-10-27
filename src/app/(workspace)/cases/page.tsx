"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { api, formatDate, initials, label, statusColor } from "@/lib/api";

type Case = {
  id: string; subject: string; status: string; priority: string; createdAt: string; updatedAt: string;
  customer: { id: string; name: string }; assignee: { id: string; name: string } | null; team: { id: string; name: string } | null;
};
type Details = Case & {
  description: string | null;
  notes: Array<{ id: string; body: string; createdAt: string; author: { name: string } }>;
  history: Array<{ id: string; createdAt: string; actor: { name: string } | null; toAssigneeId: string | null; toTeamId: string | null }>;
};
type Agent = { id: string; name: string; role: string; teamMemberships: Array<{ team: { id: string; name: string } }> };
type Team = { id: string; name: string };
const statuses = ["OPEN", "QUEUED_FOR_AGENT", "ASSIGNED", "WAITING_FOR_CUSTOMER", "WAITING_FOR_APPROVAL", "RESOLVED", "CLOSED"];

export default function CasesPage() {
  const [items, setItems] = useState<Case[]>([]);
  const [selected, setSelected] = useState<Details | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [sort, setSort] = useState("updatedAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [assigneeId, setAssigneeId] = useState("");
  const [teamId, setTeamId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const loadCases = useCallback(async () => {
    const query = new URLSearchParams({ page: String(page), limit: "15" });
    if (search) query.set("search", search);
    if (status) query.set("status", status);
    if (priority) query.set("priority", priority);
    if (agentFilter) query.set("agentId", agentFilter);
    if (teamFilter) query.set("teamId", teamFilter);
    query.set("sort", sort);
    query.set("order", order);
    try {
      const result = await api<{ data: Case[]; totalPages: number }>(`/support-cases?${query}`);
      setItems(result.data); setTotalPages(Math.max(1, result.totalPages)); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load cases."); }
  }, [agentFilter, order, page, priority, search, sort, status, teamFilter]);

  useEffect(() => { void loadCases(); }, [loadCases]);
  useEffect(() => {
    api<{ user: { role: string } }>("/auth/me").then(({ user }) => { setRole(user.role); if (user.role === "ADMIN") api<Agent[]>("/agents").then(setAgents).catch((reason) => setError(reason.message)); }).catch((reason) => setError(reason.message));
    api<Team[]>("/teams").then(setTeams).catch((reason) => setError(reason.message));
  }, []);

  const openCase = useCallback(async (id: string) => {
    try {
      const details = await api<Details>(`/support-cases/${id}`);
      setSelected(details); setAssigneeId(details.assignee?.id ?? ""); setTeamId(details.team?.id ?? "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load case details."); }
  }, []);
  useEffect(() => {
    const caseId = new URLSearchParams(window.location.search).get("case");
    if (caseId) void openCase(caseId);
  }, [openCase]);
  async function updateStatus(value: string) {
    if (!selected) return;
    try {
      await api(`/support-cases/${selected.id}/status`, { method: "PATCH", body: JSON.stringify({ status: value }) });
      await openCase(selected.id); await loadCases();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Status update failed."); }
  }
  async function saveAssignment() {
    if (!selected) return;
    try {
      await api(`/support-cases/${selected.id}/assignment`, { method: "PATCH", body: JSON.stringify({ assigneeId: assigneeId || null, teamId: teamId || null }) });
      await openCase(selected.id); await loadCases();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Assignment failed."); }
  }
  async function saveNote() {
    if (!selected || !note.trim()) return;
    try {
      await api(`/support-cases/${selected.id}/notes`, { method: "POST", body: JSON.stringify({ body: note.trim() }) });
      setNote(""); await openCase(selected.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save note."); }
  }
  function toggleSort(nextSort: string) {
    if (sort === nextSort) setOrder(order === "asc" ? "desc" : "asc");
    else { setSort(nextSort); setOrder("asc"); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs text-slate-400">Manage and resolve customer issues</div><h1 className="page-title mt-1">Support cases</h1></div><span className="rounded-full bg-white px-3 py-2 text-[10px] text-slate-500 ring-1 ring-slate-200">{items.length} shown on this page</span></div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      <section className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4"><div className="relative min-w-[200px] flex-1"><Search size={15} className="absolute top-2.5 left-3 text-slate-400" /><input className="field pl-9 text-xs" placeholder="Search case or customer..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div><select className="field w-auto text-xs" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select className="field w-auto text-xs" value={priority} onChange={(event) => { setPriority(event.target.value); setPage(1); }}><option value="">All priorities</option>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((item) => <option key={item} value={item}>{label(item)}</option>)}</select><select className="field w-auto text-xs" value={agentFilter} onChange={(event) => { setAgentFilter(event.target.value); setPage(1); }}><option value="">All agents</option>{agents.filter((agent) => agent.role === "SUPPORT_AGENT").map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><select className="field w-auto text-xs" value={teamFilter} onChange={(event) => { setTeamFilter(event.target.value); setPage(1); }}><option value="">All teams</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><SlidersHorizontal size={16} className="mx-1 text-slate-400" /></div>
        <div className="overflow-x-auto"><table className="table w-full text-xs"><thead><tr><th><button onClick={() => toggleSort("subject")}>CASE {sort === "subject" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th>CUSTOMER</th><th><button onClick={() => toggleSort("priority")}>PRIORITY {sort === "priority" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th><button onClick={() => toggleSort("status")}>STATUS {sort === "status" ? (order === "asc" ? "↑" : "↓") : ""}</button></th><th>ASSIGNED TO</th><th>TEAM</th><th><button onClick={() => toggleSort("updatedAt")}>UPDATED {sort === "updatedAt" ? (order === "asc" ? "↑" : "↓") : ""}</button></th></tr></thead><tbody>
          {items.map((item) => <tr key={item.id} onClick={() => void openCase(item.id)} className="cursor-pointer"><td><div className="font-semibold">{item.subject}</div><div className="mt-1 text-[10px] text-slate-400">#{item.id.slice(0, 8)} · {formatDate(item.createdAt)}</div></td><td>{item.customer.name}</td><td><span className={["HIGH", "URGENT"].includes(item.priority) ? "font-semibold text-rose-600" : "text-slate-600"}>{label(item.priority)}</span></td><td><span className="badge" style={statusColor(item.status)}>{label(item.status)}</span></td><td>{item.assignee?.name ?? <span className="text-slate-400">Unassigned</span>}</td><td>{item.team?.name ?? "—"}</td><td className="whitespace-nowrap text-slate-500">{formatDate(item.updatedAt)}</td></tr>)}
          {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No support cases found.</td></tr>}
        </tbody></table></div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs"><span className="text-slate-400">Page {page} of {totalPages}</span><div className="flex gap-2"><button className="button px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="button px-3 py-1.5 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </section>
      {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <aside className="h-full w-full max-w-[500px] overflow-y-auto bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><div className="text-[10px] text-slate-400">CASE #{selected.id.slice(0, 8)}</div><h2 className="mt-1 text-base font-bold">{selected.subject}</h2></div><button onClick={() => setSelected(null)} aria-label="Close case details" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={17} /></button></div>
          <div className="space-y-5 p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#e7f4ef] text-xs font-bold text-[#176b5b]">{initials(selected.customer.name)}</div><div><div className="text-xs font-semibold">{selected.customer.name}</div><div className="text-[10px] text-slate-400">Customer</div></div></div><span className="badge" style={statusColor(selected.priority === "URGENT" ? "OPEN" : selected.status)}>{label(selected.priority)}</span></div>
            {selected.description && <p className="rounded-lg bg-slate-50 p-3 text-xs leading-5 text-slate-600">{selected.description}</p>}
            <div className="grid grid-cols-2 gap-3"><label className="text-[10px] font-bold uppercase text-slate-400">Status<select className="field mt-2 text-xs" value={selected.status} onChange={(event) => void updateStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{label(item)}</option>)}</select></label><div className="text-[10px] font-bold uppercase text-slate-400">Priority<div className="mt-3 text-xs font-semibold text-slate-700">{label(selected.priority)}</div></div></div>
            {role === "ADMIN" && <div className="rounded-xl border border-slate-100 p-4"><h3 className="text-xs font-bold">Assignment</h3><label className="mt-3 block text-[10px] font-semibold text-slate-500">Team<select className="field mt-1 text-xs" value={teamId} onChange={(event) => setTeamId(event.target.value)}><option value="">No team</option>{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label><label className="mt-3 block text-[10px] font-semibold text-slate-500">Agent<select className="field mt-1 text-xs" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">Unassigned</option>{agents.filter((agent) => !teamId || agent.teamMemberships.some((membership) => membership.team.id === teamId)).map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select></label><button className="button button-primary mt-3 w-full text-xs" onClick={() => void saveAssignment()}>Save assignment</button></div>}
            <div className="rounded-xl border border-slate-100 p-4"><h3 className="text-xs font-bold">Internal notes</h3><textarea className="field mt-3 min-h-[76px] text-xs" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a note for your team..." /><button className="button mt-2 text-xs" onClick={() => void saveNote()}>Add note</button><div className="mt-3 space-y-3">{selected.notes.map((item) => <div key={item.id} className="rounded-lg bg-amber-50 p-3"><p className="text-xs text-amber-950">{item.body}</p><div className="mt-2 text-[9px] text-amber-700">{item.author.name} · {formatDate(item.createdAt)}</div></div>)}</div></div>
            <div><h3 className="text-xs font-bold">Assignment history</h3><div className="mt-3 space-y-3">{selected.history.map((item) => <div key={item.id} className="border-l-2 border-[#a8d3c3] pl-3"><div className="text-[11px] text-slate-600">{item.actor?.name ?? "System"} updated assignment</div><div className="mt-1 text-[9px] text-slate-400">{formatDate(item.createdAt)}</div></div>)}{selected.history.length === 0 && <div className="text-[11px] text-slate-400">No assignment changes yet.</div>}</div></div>
          </div>
        </aside>
      </div>}
    </div>
  );
}
