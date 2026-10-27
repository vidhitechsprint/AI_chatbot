"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search, X, Mail, Phone, MessagesSquare, Plus, MessageCircle } from "lucide-react";
import { api, formatDate, initials, label, statusColor } from "@/lib/api";

type Customer = {
  id: string; name: string; email: string | null; phone: string | null; customerCompany: string | null;
  _count: { conversations: number; cases: number }; conversations: Array<{ updatedAt: string }>;
};
type CustomerDetails = Omit<Customer, "conversations"> & {
  conversations: Array<{ id: string; updatedAt: string; channelAccount: { type: string }; messages: Array<{ body: string }> }>;
  cases: Array<{ id: string; subject: string; status: string; priority: string; updatedAt: string; assignee: { name: string } | null; team: { name: string } | null }>;
};

export default function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<CustomerDetails | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState("");
  const [role, setRole] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");
  const [notice, setNotice] = useState("");
  const [startingWhatsApp, setStartingWhatsApp] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams({ page: String(page), limit: "20" });
    if (search) query.set("search", search);
    api<{ data: Customer[]; totalPages: number }>(`/customers?${query}`).then((result) => { setItems(result.data); setTotalPages(Math.max(result.totalPages, 1)); setError(""); }).catch((reason) => setError(reason.message));
  }, [page, search]);
  useEffect(() => {
    api<{ user: { role: string } }>("/auth/me")
      .then(({ user }) => setRole(user.role))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load account permissions."));
  }, []);

  async function open(id: string) {
    try { setSelected(await api<CustomerDetails>(`/customers/${id}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load customer."); }
  }
  async function createCustomer(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      await api<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name,
          ...(email.trim() ? { email: email.trim() } : {}),
          ...(phone.trim() ? { phone: phone.trim() } : {}),
          ...(customerCompany.trim() ? { customerCompany: customerCompany.trim() } : {}),
        }),
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create customer.");
      setCreating(false);
      return;
    }
    setCreating(false);
    setName("");
    setEmail("");
    setPhone("");
    setCustomerCompany("");
    setShowCreate(false);
    setPage(1);
    setSearch("");
    setNotice("Customer created.");
    setError("");
    try {
      const result = await api<{ data: Customer[]; totalPages: number }>("/customers?page=1&limit=20");
      setItems(result.data);
      setTotalPages(Math.max(result.totalPages, 1));
    } catch (reason) {
      setError(reason instanceof Error ? `Customer was created, but the list could not be refreshed: ${reason.message}` : "Customer was created, but the list could not be refreshed.");
    }
  }
  async function startWhatsAppConversation() {
    if (!selected) return;
    setStartingWhatsApp(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{ conversationId: string; created: boolean }>(
        `/whatsapp/customers/${selected.id}/conversation`,
        { method: "POST" },
      );
      setNotice(result.created
        ? "WhatsApp conversation is ready. Open Inbox and choose the jaspers_market_order_confirmation template to send."
        : "An existing WhatsApp conversation is ready. Open Inbox to continue.");
      setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start a WhatsApp conversation.");
    } finally {
      setStartingWhatsApp(false);
    }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs text-slate-400">People who count on your support team</div><h1 className="page-title mt-1">Customers</h1><p className="mt-2 text-sm text-slate-500">Customer profiles with their conversation and case history.</p></div>{role === "ADMIN" && <button onClick={() => { setShowCreate(true); setNotice(""); }} className="button button-primary flex items-center gap-1.5 text-xs"><Plus size={14} />Add customer</button>}</div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
      <section className="panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4"><div className="relative max-w-md flex-1"><Search size={15} className="absolute top-2.5 left-3 text-slate-400" /><input className="field pl-9 text-xs" placeholder="Search name, email, or phone..." value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></div><span className="text-[10px] text-slate-400">{items.length} customers</span></div>
        <div className="overflow-x-auto"><table className="table w-full text-xs"><thead><tr><th>CUSTOMER</th><th>EMAIL</th><th>PHONE</th><th>COMPANY</th><th>CONVERSATIONS</th><th>SUPPORT CASES</th><th>LAST INTERACTION</th></tr></thead><tbody>
          {items.map((item) => <tr key={item.id} onClick={() => void open(item.id)} className="cursor-pointer"><td><div className="flex items-center gap-2.5"><div className="grid h-8 w-8 place-items-center rounded-full bg-[#e7f4ef] text-[10px] font-bold text-[#176b5b]">{initials(item.name)}</div><span className="font-semibold">{item.name}</span></div></td><td>{item.email ?? "—"}</td><td>{item.phone ?? "—"}</td><td>{item.customerCompany ?? "—"}</td><td>{item._count.conversations}</td><td>{item._count.cases}</td><td className="whitespace-nowrap text-slate-500">{formatDate(item.conversations[0]?.updatedAt)}</td></tr>)}
          {items.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-400">No customers found.</td></tr>}
        </tbody></table></div>
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs"><span className="text-slate-400">Page {page} of {totalPages}</span><div className="flex gap-2"><button className="button px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><button className="button px-3 py-1.5 text-xs" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button></div></div>
      </section>
      {showCreate && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !creating) setShowCreate(false); }}><form onSubmit={createCustomer} className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="text-sm font-bold">Add customer</h2><p className="mt-1 text-[11px] text-slate-400">Create a customer profile in this workspace.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close add customer form" disabled={creating}><X size={17} /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-[11px] font-medium text-slate-600 sm:col-span-2">Name<input className="field mt-1 text-xs" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} maxLength={200} autoFocus /></label><label className="text-[11px] font-medium text-slate-600">Phone<input className="field mt-1 text-xs" value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" maxLength={32} placeholder="+91 7383617795" /></label><label className="text-[11px] font-medium text-slate-600">Email<input className="field mt-1 text-xs" value={email} onChange={(event) => setEmail(event.target.value)} type="email" maxLength={320} /></label><label className="text-[11px] font-medium text-slate-600 sm:col-span-2">Company<input className="field mt-1 text-xs" value={customerCompany} onChange={(event) => setCustomerCompany(event.target.value)} maxLength={200} /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" className="button px-3 py-2 text-xs" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</button><button className="button button-primary px-3 py-2 text-xs" disabled={creating}>{creating ? "Creating..." : "Create customer"}</button></div></form></div>}
      {selected && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/30" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><aside className="h-full w-full max-w-[540px] overflow-y-auto bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><h2 className="text-base font-bold">Customer profile</h2><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="Close customer"><X size={17} /></button></div><div className="p-5"><div className="flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-full bg-[#e7f4ef] font-bold text-[#176b5b]">{initials(selected.name)}</div><div><div className="text-sm font-bold">{selected.name}</div><div className="text-[11px] text-slate-400">{selected.customerCompany ?? "Customer"}</div></div></div><div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">{selected.email && <span className="flex items-center gap-1.5"><Mail size={13} />{selected.email}</span>}{selected.phone && <span className="flex items-center gap-1.5"><Phone size={13} />{selected.phone}</span>}</div>
          {role === "ADMIN" && selected.phone && <button onClick={() => void startWhatsAppConversation()} disabled={startingWhatsApp} className="button button-primary mt-4 flex items-center gap-2 text-xs"><MessageCircle size={14} />{startingWhatsApp ? "Preparing..." : "Start WhatsApp conversation"}</button>}
          <div className="mt-7 border-t border-slate-100 pt-5"><h3 className="text-xs font-bold">Support cases ({selected.cases.length})</h3><div className="mt-3 space-y-2">{selected.cases.map((item) => <a key={item.id} href={`/cases?case=${item.id}`} className="block rounded-lg border border-slate-100 p-3 hover:border-[#b7d9cd]"><div className="flex items-start justify-between gap-2"><span className="text-xs font-semibold">{item.subject}</span><span className="badge" style={statusColor(item.status)}>{label(item.status)}</span></div><div className="mt-2 text-[10px] text-slate-400">{item.assignee?.name ?? item.team?.name ?? "Unassigned"} · Updated {formatDate(item.updatedAt)}</div></a>)}{selected.cases.length === 0 && <div className="text-[11px] text-slate-400">No support cases yet.</div>}</div></div>
          <div className="mt-7 border-t border-slate-100 pt-5"><h3 className="flex items-center gap-2 text-xs font-bold"><MessagesSquare size={14} />Conversations ({selected.conversations.length})</h3><div className="mt-3 space-y-2">{selected.conversations.map((item) => <a key={item.id} href="/inbox" className="block rounded-lg border border-slate-100 p-3 hover:border-[#b7d9cd]"><div className="flex justify-between text-[10px]"><span className="font-semibold">{label(item.channelAccount.type)}</span><span className="text-slate-400">{formatDate(item.updatedAt)}</span></div><p className="mt-2 truncate text-[11px] text-slate-500">{item.messages[0]?.body ?? "No messages"}</p></a>)}{selected.conversations.length === 0 && <div className="text-[11px] text-slate-400">No conversations yet.</div>}</div></div>
        </div></aside></div>}
    </div>
  );
}
