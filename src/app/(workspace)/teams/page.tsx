"use client";

import { FormEvent, useEffect, useState } from "react";
import { UserPlus, Users, Plus, Pencil } from "lucide-react";
import { api, initials } from "@/lib/api";

type Agent = { id: string; name: string; email: string; role: string; isActive: boolean; teamMemberships: Array<{ team: { id: string; name: string } }> };
type Team = { id: string; name: string; members: Array<{ user: Agent }>; _count: { cases: number } };

export default function TeamsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [agentName, setAgentName] = useState("");
  const [agentEmail, setAgentEmail] = useState("");
  const [agentPassword, setAgentPassword] = useState("");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const [teamList, agentList] = await Promise.all([api<Team[]>("/teams"), api<Agent[]>("/agents")]);
      setTeams(teamList); setAgents(agentList); setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load teams."); }
  }
  useEffect(() => { void load(); }, []);

  async function createTeam(event: FormEvent) {
    event.preventDefault();
    try { await api("/teams", { method: "POST", body: JSON.stringify({ name }) }); setName(""); setMessage("Team created."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Team could not be created."); }
  }
  async function rename(team: Team) {
    const next = window.prompt("Enter a new team name", team.name);
    if (!next || next.trim() === team.name) return;
    try { await api(`/teams/${team.id}`, { method: "PATCH", body: JSON.stringify({ name: next.trim() }) }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Team could not be updated."); }
  }
  async function add(teamId: string) {
    const userId = selected[teamId];
    if (!userId) return;
    try { await api(`/teams/${teamId}/members`, { method: "POST", body: JSON.stringify({ userId }) }); setSelected({ ...selected, [teamId]: "" }); setMessage("Agent added to team."); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not add agent."); }
  }
  async function createAgent(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/agents", { method: "POST", body: JSON.stringify({ name: agentName, email: agentEmail, password: agentPassword }) });
      setAgentName(""); setAgentEmail(""); setAgentPassword(""); setMessage("Support agent created."); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Support agent could not be created."); }
  }
  async function toggleAgent(agent: Agent) {
    try {
      await api(`/agents/${agent.id}/status`, { method: "PATCH", body: JSON.stringify({ isActive: !agent.isActive }) });
      setMessage(`${agent.name} ${agent.isActive ? "deactivated" : "activated"}.`); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Agent status could not be updated."); }
  }
  async function remove(teamId: string, userId: string) {
    try { await api(`/teams/${teamId}/members/${userId}`, { method: "DELETE" }); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not remove agent."); }
  }

  return (
    <div className="space-y-6">
      <div><div className="text-xs text-slate-400">Your people, working better together</div><h1 className="page-title mt-1">Teams & agents</h1><p className="mt-2 text-sm text-slate-500">Manage agent membership and the teams that handle support queues.</p></div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{message}</div>}
      <section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-sm font-bold">Support agents</h2><p className="mt-1 text-[11px] text-slate-400">Workspace members and their team assignments</p></div><span className="badge bg-slate-100 text-slate-500">{agents.length} members</span></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{agents.map((agent) => <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3" key={agent.id}><div className="grid h-10 w-10 place-items-center rounded-full bg-[#e7f4ef] text-xs font-bold text-[#176b5b]">{initials(agent.name)}</div><div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{agent.name}</div><div className="truncate text-[10px] text-slate-400">{agent.email}</div><div className="mt-1 text-[9px] text-slate-500">{agent.role === "ADMIN" ? "Administrator" : "Support agent"}</div></div>{agent.role === "SUPPORT_AGENT" ? <button onClick={() => void toggleAgent(agent)} className={`badge ${agent.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{agent.isActive ? "Active" : "Inactive"}</button> : <span className="badge bg-emerald-50 text-emerald-700">Active</span>}</div>)}</div>
      </section>
      <form onSubmit={createAgent} className="panel grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto]">
        <div className="sm:col-span-2 xl:col-span-4"><h2 className="text-xs font-bold">Add a support agent</h2><p className="mt-1 text-[10px] text-slate-400">New agents are created with support-agent access only.</p></div>
        <input className="field text-xs" value={agentName} onChange={(event) => setAgentName(event.target.value)} placeholder="Full name" required minLength={2} />
        <input className="field text-xs" value={agentEmail} onChange={(event) => setAgentEmail(event.target.value)} placeholder="Work email" type="email" required />
        <input className="field text-xs" value={agentPassword} onChange={(event) => setAgentPassword(event.target.value)} placeholder="Temporary password (12+ chars)" type="password" required minLength={12} />
        <button className="button button-primary flex items-center justify-center gap-1 text-xs"><UserPlus size={14} />Create agent</button>
      </form>
      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-sm font-bold">Support teams</h2><p className="mt-1 text-[11px] text-slate-400">Create a team and add available agents.</p></div><form onSubmit={createTeam} className="flex gap-2"><input className="field max-w-[220px] text-xs" placeholder="New team name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /><button className="button button-primary flex items-center gap-1.5 text-xs"><Plus size={14} />Create team</button></form></div>
        <div className="grid gap-4 xl:grid-cols-2">{teams.map((team) => {
          const memberIds = team.members.map((member) => member.user.id);
          return <div key={team.id} className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-lg bg-[#eef2ff] text-[#5969ad]"><Users size={17} /></div><div><h3 className="text-xs font-bold">{team.name}</h3><p className="mt-1 text-[10px] text-slate-400">{team.members.length} agents · {team._count.cases} cases</p></div></div><button className="rounded-md p-2 text-slate-400 hover:bg-slate-100" title="Rename team" onClick={() => void rename(team)}><Pencil size={14} /></button></div><div className="divide-y divide-slate-100">{team.members.map(({ user }) => <div key={user.id} className="flex items-center gap-2.5 px-4 py-3"><div className="grid h-7 w-7 place-items-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">{initials(user.name)}</div><div className="flex-1"><div className="text-[11px] font-semibold">{user.name}</div><div className="text-[9px] text-slate-400">{user.email}</div></div><button onClick={() => void remove(team.id, user.id)} className="text-[10px] font-medium text-slate-400 hover:text-rose-600">Remove</button></div>)}
            <div className="flex gap-2 p-3"><select className="field py-2 text-xs" value={selected[team.id] ?? ""} onChange={(event) => setSelected({ ...selected, [team.id]: event.target.value })}><option value="">Choose an agent to add</option>{agents.filter((agent) => !memberIds.includes(agent.id) && agent.role === "SUPPORT_AGENT").map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}</select><button className="button flex shrink-0 items-center gap-1 text-xs" disabled={!selected[team.id]} onClick={() => void add(team.id)}><UserPlus size={14} />Add</button></div>
          </div></div>;
        })}{teams.length === 0 && <div className="panel p-8 text-center text-xs text-slate-400">No teams yet. Create one above.</div>}</div>
      </section>
      <div className="text-[10px] text-slate-400">Passwords and authentication data are never exposed here.</div>
    </div>
  );
}
