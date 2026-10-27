"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCheck, Clock3, Inbox, MessageSquareText, Users } from "lucide-react";
import { api, formatDate, label, statusColor } from "@/lib/api";

type Summary = {
  totalConversations: number; openCases: number; queuedCases: number; assignedCases: number; resolvedCases: number;
  recentCases: Array<{ id: string; subject: string; status: string; priority: string; updatedAt: string; customer: { name: string }; assignee: { name: string } | null }>;
  activity: Array<{ id: string; body: string; sender: string; createdAt: string; conversation: { customer: { name: string } } }>;
  statusCounts: Array<{ status: string; _count: { _all: number } }>;
};

const metrics = [
  { key: "totalConversations", label: "Total conversations", icon: Inbox, tint: "#edf1ff", color: "#5064b6" },
  { key: "openCases", label: "Open support cases", icon: MessageSquareText, tint: "#e7f4ef", color: "#176b5b" },
  { key: "queuedCases", label: "Waiting for assignment", icon: Clock3, tint: "#fff3df", color: "#a56513" },
  { key: "assignedCases", label: "Assigned cases", icon: Users, tint: "#edf1ff", color: "#5869ae" },
  { key: "resolvedCases", label: "Resolved cases", icon: CheckCheck, tint: "#e7f4ef", color: "#176b5b" },
] as const;

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api<Summary>("/dashboard/summary").then(setData).catch((reason) => setError(reason.message)); }, []);
  const max = Math.max(1, ...(data?.statusCounts.map((item) => item._count._all) ?? [1]));
  const today = new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date());

  if (error) return <div className="panel p-6 text-sm text-red-700">{error}</div>;
  if (!data) return <div className="text-sm text-slate-500">Loading dashboard…</div>;
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs font-medium text-slate-400">{today}</div><h1 className="page-title mt-1">Good afternoon 👋</h1><p className="mt-2 text-sm text-slate-500">Here’s what’s happening with your support team today.</p></div><span className="rounded-full bg-white px-3 py-2 text-xs text-slate-500 ring-1 ring-slate-200">All time · Live data</span></div>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map(({ key, label: title, icon: Icon, tint, color }) => (
          <div key={key} className="panel p-4">
            <div className="flex items-center justify-between"><span className="text-[11px] font-medium text-slate-500">{title}</span><span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: tint, color }}><Icon size={16} /></span></div>
            <div className="mt-4 text-[28px] font-bold tracking-tight">{data[key]}</div>
            <div className="mt-1 text-[10px] text-slate-400">Updated just now</div>
          </div>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold">Recent support cases</h2><p className="mt-1 text-[11px] text-slate-400">Latest updates across your workspace</p></div><Link href="/cases" className="flex items-center gap-1 text-xs font-semibold text-[#176b5b]">View all <ArrowUpRight size={14} /></Link></div>
          <div className="overflow-x-auto"><table className="table w-full text-xs"><thead><tr><th>CASE</th><th>CUSTOMER</th><th>STATUS</th><th>PRIORITY</th><th>UPDATED</th></tr></thead><tbody>
            {data.recentCases.map((item) => <tr key={item.id}><td><Link className="font-semibold hover:text-[#176b5b]" href={`/cases?selected=${item.id}`}>{item.subject}</Link><div className="mt-1 text-[10px] text-slate-400">#{item.id.slice(0, 8)}</div></td><td>{item.customer.name}</td><td><span className="badge" style={statusColor(item.status)}>{label(item.status)}</span></td><td><span className={item.priority === "URGENT" || item.priority === "HIGH" ? "font-semibold text-rose-600" : "text-slate-600"}>{label(item.priority)}</span></td><td className="whitespace-nowrap text-slate-500">{formatDate(item.updatedAt)}</td></tr>)}
            {data.recentCases.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-slate-400">No recent cases.</td></tr>}
          </tbody></table></div>
        </div>
        <div className="panel p-5">
          <h2 className="text-sm font-bold">Case status</h2><p className="mt-1 text-[11px] text-slate-400">Current support case distribution</p>
          <div className="mt-6 space-y-4">{data.statusCounts.map(({ status, _count }) => <div key={status}><div className="mb-1.5 flex justify-between text-[11px]"><span className="font-medium text-slate-600">{label(status)}</span><span className="text-slate-400">{_count._all}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#4a9c81]" style={{ width: `${Math.max(5, _count._all / max * 100)}%` }} /></div></div>)}</div>
        </div>
      </section>
      <section className="panel">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-bold">Recent conversation activity</h2><p className="mt-1 text-[11px] text-slate-400">Messages stored in your local demo database</p></div><Link href="/inbox" className="text-xs font-semibold text-[#176b5b]">Open inbox →</Link></div>
        <div className="divide-y divide-slate-100">{data.activity.slice(0, 5).map((item) => <div className="flex items-center gap-3 px-5 py-3" key={item.id}><div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">{item.conversation.customer.name[0]}</div><div className="min-w-0 flex-1"><div className="text-xs font-semibold">{item.conversation.customer.name}<span className="ml-2 font-normal text-slate-400">{item.sender === "AGENT" ? "received an agent reply" : item.sender === "SYSTEM" ? "has a system note" : "sent a message"}</span></div><div className="truncate text-[11px] text-slate-500">{item.body}</div></div><time className="whitespace-nowrap text-[10px] text-slate-400">{formatDate(item.createdAt)}</time></div>)}{data.activity.length === 0 && <div className="p-6 text-center text-xs text-slate-400">No conversation activity yet.</div>}</div>
      </section>
    </div>
  );
}
