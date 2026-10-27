"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity, BookOpen, Building2, ChartNoAxesCombined, ChevronDown, CircleHelp, Inbox, LayoutDashboard,
  LogOut, MessageSquareText, Users, Bot, Menu, X, Workflow,
} from "lucide-react";
import { api, setCompanyTimeZone } from "@/lib/api";

type User = { id: string; name: string; email: string; role: "ADMIN" | "SUPPORT_AGENT"; companyName: string };
const links = [
  { href: "/dashboard", name: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", name: "Inbox", icon: Inbox },
  { href: "/cases", name: "Support cases", icon: MessageSquareText },
  { href: "/customers", name: "Customers", icon: Users },
  { href: "/teams", name: "Teams & agents", icon: Activity, adminOnly: true },
  { href: "/knowledge", name: "Knowledge base", icon: BookOpen, adminOnly: true },
  { href: "/workflows", name: "Workflow monitor", icon: Workflow, adminOnly: true },
  { href: "/analytics", name: "Analytics", icon: ChartNoAxesCombined, adminOnly: true },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    api<{ user: User & { timeZone: string } }>("/auth/me")
      .then((result) => { setUser(result.user); setCompanyTimeZone(result.user.timeZone); })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Could not sign out.");
    }
  }

  if (loading || !user) {
    return <div className="grid min-h-screen place-items-center text-sm text-slate-500">Loading your workspace…</div>;
  }

  return (
    <div className="min-h-screen">
      <aside className={`fixed inset-y-0 left-0 z-30 flex w-[250px] flex-col border-r border-slate-200 bg-white transition-transform md:translate-x-0 ${menuOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-[72px] items-center gap-3 border-b border-slate-100 px-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#176b5b] text-white"><MessageSquareText size={18} /></div>
          <div><div className="font-bold tracking-tight">supportdesk</div><div className="text-[10px] uppercase tracking-[.15em] text-slate-400">Customer operations</div></div>
          <button onClick={() => setMenuOpen(false)} className="ml-auto hidden text-slate-500 max-md:block" aria-label="Close menu"><X size={18} /></button>
        </div>
        <div className="px-4 pt-6 pb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Workspace</div>
        <nav className="space-y-1 px-3">
          {links.filter((link) => !link.adminOnly || user.role === "ADMIN").map(({ href, name, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${pathname === href ? "bg-[#e7f4ef] text-[#176b5b]" : "text-slate-600 hover:bg-slate-50"}`}>
              <Icon size={17} strokeWidth={1.8} />{name}
              {name === "Inbox" && <span className="ml-auto rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Mock</span>}
            </Link>
          ))}
        </nav>
        <div className="px-4 pt-7 pb-2 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Settings</div>
        <nav className="space-y-1 px-3">
          {user.role === "ADMIN" && <Link href="/settings" onClick={() => setMenuOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium ${pathname === "/settings" ? "bg-[#e7f4ef] text-[#176b5b]" : "text-slate-600 hover:bg-slate-50"}`}><Building2 size={17} />Company settings</Link>}
          {/* <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium text-slate-400"><Bot size={17} />AI agent settings</div> */}
        </nav>
        <div className="mt-auto p-4">
          {/* <div className="mb-3 rounded-xl bg-[#f5f8f7] p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700"><CircleHelp size={15} className="text-[#176b5b]" />Need a hand?</div>
            <p className="mb-0 mt-1 text-[11px] leading-relaxed text-slate-500">Your workspace is running with local demo data.</p>
          </div> */}
          <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-[#e7f4ef] text-xs font-bold text-[#176b5b]">{user.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
            <div className="min-w-0 flex-1"><div className="truncate text-xs font-semibold">{user.name}</div><div className="text-[10px] text-slate-400">{user.role === "ADMIN" ? "Administrator" : "Support agent"}</div></div>
            <button onClick={logout} aria-label="Sign out" className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut size={16} /></button>
          </div>
        </div>
      </aside>
      <div className="md:pl-[250px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-slate-200 bg-white/95 px-7 backdrop-blur max-md:px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(!menuOpen)} className="hidden text-slate-600 max-md:block" aria-label="Toggle menu"><Menu size={20} /></button>
            <span className="text-xs font-medium text-slate-400">{user.companyName}</span><ChevronDown size={13} className="text-slate-400" />
          </div>
          <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">{user.name[0]}</div>
        </header>
        <main className="mx-auto max-w-[1480px] p-7 max-md:p-4">{children}</main>
      </div>
      {menuOpen && <button className="fixed inset-0 z-20 hidden bg-slate-950/20 max-md:block" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
