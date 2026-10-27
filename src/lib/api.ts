export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
let companyTimeZone: string | undefined;

export function setCompanyTimeZone(timeZone: string) {
  companyTimeZone = timeZone;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { message?: string | string[] } | null;
    const message = payload?.message;
    throw new Error(Array.isArray(message) ? message.join(", ") : message ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short", timeZone: companyTimeZone }).format(new Date(value));
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

export function statusColor(status: string) {
  if (["RESOLVED", "CLOSED"].includes(status)) return { background: "#e7f4ef", color: "#176b5b" };
  if (["WAITING_FOR_CUSTOMER", "WAITING_FOR_APPROVAL"].includes(status)) return { background: "#fff3df", color: "#a56513" };
  if (status === "QUEUED_FOR_AGENT") return { background: "#edf1ff", color: "#4e61b1" };
  return { background: "#eaf0f7", color: "#47617d" };
}

export function label(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}
