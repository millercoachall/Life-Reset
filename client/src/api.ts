// RPC client: POST ./actions {action, args} with the session token from localStorage.
const TOKEN_KEY = "life-reset-session";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export async function callAction<T = any>(action: string, args: Record<string, unknown> = {}): Promise<T> {
  const token = getToken();
  const res = await fetch("/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, args: { ...args, sessionToken: token ?? undefined } }),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean; data?: T; error?: string } | null;
  if (!json || json.ok !== true) {
    const message = json?.error || `Request failed (${res.status}).`;
    if (res.status === 401) setToken(null);
    throw new Error(message);
  }
  return json.data as T;
}

export type PlanTier = "free" | "essentials" | "complete" | "vip";

export interface Settings {
  id: number;
  householdName: string;
  planTier: PlanTier;
  joinCode: string | null;
  squareEssentialsUrl: string | null;
  squareCompleteUrl: string | null;
  squareVipUrl: string | null;
  isSeller: boolean;
}

export interface Member {
  id: number;
  name: string;
  username: string | null;
  hasLogin: boolean;
  role: string;
}

export interface Task {
  id: number;
  title: string;
  category: string;
  priority: string;
  estMinutes: number | null;
  waitingOn: string | null;
  notes: string | null;
  dueDate: string | null;
  assigneeMemberId: number | null;
  pinned: boolean;
  status: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Bill {
  id: number;
  name: string;
  amountCents: number | null;
  dueDate: string | null;
  paid: boolean;
  createdAt: string;
}

export interface Dump {
  id: number;
  rawText: string;
  status: string;
  createdAt: string;
}

export interface Stats {
  openCount: number;
  doneToday: number;
  doneThisWeek: number;
  overdueCount: number;
}

export interface Viewer {
  id: number;
  name: string;
  username: string | null;
  role: string;
  householdId: number;
}

export interface AppState {
  settings: Settings;
  members: Member[];
  tasks: Task[];
  bills: Bill[];
  dumps: Dump[];
  stats: Stats;
  viewer: Viewer;
}

export interface AuthState {
  currentMember: {
    id: number;
    name: string;
    username: string | null;
    role: string;
    householdId: number;
    householdName: string;
  } | null;
  householdName: string;
  loginOptions: string[];
  loginsEnabled: boolean;
}

export interface SortSuggestion {
  title: string;
  category: string;
  priority: string;
  estMinutes: number | null;
  waitingOn: string | null;
}

export interface RescuePlan {
  firstStep: { title: string; minutes: number };
  steps: { title: string; minutes: number }[];
  canWait: { title: string }[];
  closingLine: string;
}

export interface DayResetPlan {
  keep: { id: number; reason: string }[];
  move: { id: number; reason: string }[];
  note: string;
}

export interface UnlockCode {
  id: number;
  code: string;
  tier: string;
  note: string | null;
  redeemed: boolean;
  redeemedByHouseholdName: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

export const CATEGORIES = [
  { value: "home", label: "Home" },
  { value: "money", label: "Money" },
  { value: "family", label: "Family" },
  { value: "myself", label: "Myself" },
  { value: "pending", label: "Pending" },
  { value: "general", label: "General" },
];

export const PRIORITIES = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

export function money(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

export function todayStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function fmtDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}
