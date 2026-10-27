"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { BookOpen, FilePlus2, Pencil, Search, X } from "lucide-react";
import { api, formatDate } from "@/lib/api";

type Document = { id: string; title: string; content: string; category: string; isActive: boolean; updatedAt: string };
type Editor = { id?: string; title: string; content: string; category: string; isActive: boolean };
const emptyEditor: Editor = { title: "", content: "", category: "faq", isActive: true };

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (query: string) => {
    try {
      const params = new URLSearchParams();
      if (query) params.set("search", query);
      setDocuments(await api<Document[]>(`/knowledge?${params}`));
      setError("");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load knowledge documents."); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(search), 200);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = { title: editor.title, content: editor.content, category: editor.category, isActive: editor.isActive };
      if (editor.id) await api(`/knowledge/${editor.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      else await api("/knowledge", { method: "POST", body: JSON.stringify(payload) });
      setEditor(null); setNotice("Knowledge document saved."); await load(search);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save knowledge document."); }
    finally { setSaving(false); }
  }

  async function deactivate(document: Document) {
    if (!window.confirm(`Deactivate “${document.title}”? The AI will stop retrieving it.`)) return;
    try { await api(`/knowledge/${document.id}`, { method: "DELETE" }); setNotice("Document deactivated."); await load(search); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not deactivate document."); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-xs text-slate-400">Company facts the assistant can cite</div><h1 className="page-title mt-1">Knowledge base</h1><p className="mt-2 text-sm text-slate-500">Maintain policy and FAQ documents used by the company-scoped AI search tool.</p></div><button className="button button-primary flex items-center gap-2 text-xs" onClick={() => setEditor({ ...emptyEditor })}><FilePlus2 size={15} />New document</button></div>
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}
      <div className="panel overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-100 p-4"><div className="relative max-w-md flex-1"><Search size={14} className="absolute top-2.5 left-3 text-slate-400" /><input className="field pl-9 text-xs" placeholder="Search title, category, or content..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><span className="text-[10px] text-slate-400">{documents.filter((document) => document.isActive).length} active</span></div>
        <div className="divide-y divide-slate-100">{documents.map((document) => <article key={document.id} className="flex flex-wrap items-start gap-3 p-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e7f4ef] text-[#176b5b]"><BookOpen size={16} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xs font-bold">{document.title}</h2><span className="badge bg-slate-100 text-slate-500">{document.category}</span><span className={`badge ${document.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}>{document.isActive ? "Active" : "Inactive"}</span></div><p className="mt-2 line-clamp-2 whitespace-pre-wrap text-[11px] leading-5 text-slate-500">{document.content}</p><div className="mt-2 text-[9px] text-slate-400">Updated {formatDate(document.updatedAt)}</div></div><div className="flex gap-1"><button className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit document" onClick={() => setEditor({ id: document.id, title: document.title, content: document.content, category: document.category, isActive: document.isActive })}><Pencil size={14} /></button>{document.isActive && <button className="rounded-md px-2 py-1.5 text-[10px] font-medium text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => void deactivate(document)}>Deactivate</button>}</div></article>)}
          {documents.length === 0 && <div className="p-10 text-center text-xs text-slate-400">No knowledge documents found. Create an FAQ or policy document to help the AI answer safely.</div>}</div>
      </div>
      <div className="text-[10px] leading-5 text-slate-400">AI retrieval uses PostgreSQL full-text search and only active documents from this company. Retrieved content is treated as untrusted data; no vector database is required.</div>
      {editor && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/30 p-4"><form onSubmit={save} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-100 p-5"><div><h2 className="text-sm font-bold">{editor.id ? "Edit document" : "Create knowledge document"}</h2><p className="mt-1 text-[10px] text-slate-400">Do not add passwords, API keys, or unrelated customer data.</p></div><button type="button" onClick={() => setEditor(null)} aria-label="Close editor" className="rounded-md p-2 text-slate-400 hover:bg-slate-100"><X size={16} /></button></div><div className="space-y-4 p-5"><label className="block text-xs font-semibold text-slate-600">Title<input className="field mt-2 text-xs" value={editor.title} onChange={(event) => setEditor({ ...editor, title: event.target.value })} required minLength={2} maxLength={200} /></label><label className="block text-xs font-semibold text-slate-600">Category<input className="field mt-2 text-xs" value={editor.category} onChange={(event) => setEditor({ ...editor, category: event.target.value })} required minLength={2} maxLength={80} placeholder="shipping, returns, products..." /></label><label className="block text-xs font-semibold text-slate-600">Content<textarea className="field mt-2 min-h-[220px] resize-y text-xs leading-5" value={editor.content} onChange={(event) => setEditor({ ...editor, content: event.target.value })} required minLength={5} maxLength={20000} /></label>{editor.id && <label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={editor.isActive} onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })} className="accent-[#176b5b]" />Active and available to AI retrieval</label>}</div><div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 p-4"><button type="button" className="button text-xs" onClick={() => setEditor(null)}>Cancel</button><button disabled={saving} className="button button-primary text-xs">{saving ? "Saving…" : "Save document"}</button></div></form></div>}
    </div>
  );
}
