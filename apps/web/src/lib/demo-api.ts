"use client";

import { DEMO_LOGIN_USERS, demoUserForEmail, isDemoBuild, makeDemoUser, type DemoUserShape } from "@/lib/demo";
import { getSupabaseClient } from "@/lib/supabase";

type Manifest = Record<string, string>;
const DATA_ROOT = "/demo-data";
const USER_KEY = "strata.demo.user";
const CHANGES_KEY = "strata.demo.changes";
let manifestPromise: Promise<Manifest> | null = null;

export function isDemoMode(): boolean { return isDemoBuild; }

function readJson<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}

function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private browsing / full storage: memory-only behaviour */ }
}

export function getDemoUser(): DemoUserShape | null {
  if (typeof window === "undefined") return null;
  return readJson<DemoUserShape>(USER_KEY);
}

export function setDemoUser(user: DemoUserShape | null): void {
  if (typeof window === "undefined") return;
  if (user) writeJson(USER_KEY, user);
  else localStorage.removeItem(USER_KEY);
}

async function manifest(): Promise<Manifest> {
  manifestPromise ??= fetch(`${DATA_ROOT}/manifest.json`, { cache: "force-cache" })
    .then(async (res) => {
      if (!res.ok) throw new Error("Demo fixtures are missing. Run npm run demo:fixtures.");
      return res.json() as Promise<Manifest>;
    });
  return manifestPromise;
}

function normalise(path: string): string {
  const [rawPath, rawQuery = ""] = path.split("?");
  if (!rawQuery) return rawPath;
  const params = new URLSearchParams(rawQuery);
  return `${rawPath}?${[...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&")}`;
}

function fixtureFallback(path: string): string | null {
  const clean = normalise(path);
  const base = clean.split("?")[0];
  if (base === "/accounts") return "/accounts";
  if (base === "/memory/search") return "/memory/items";
  if (base === "/events") return "/events";
  if (base === "/digest") return "/briefing?persona=operations_manager";
  return null;
}

/** Build the non-ML dashboard digest from the saved briefing when a dedicated digest capture is unavailable. */
function digestFromBriefing(value: unknown, path: string): unknown {
  const briefing = value as {
    persona?: string; sim_now?: string; summary?: string; priorities?: Array<{
      ref?: string; title?: string; kind?: string; severity?: string; value_at_stake?: number; stage?: string;
    }>;
  };
  const url = new URL(path, "https://strata-ai.me");
  const period = url.searchParams.get("period") ?? "today";
  const now = briefing.sim_now ?? "2026-10-09T09:00:00+05:30";
  const priorities = Array.isArray(briefing.priorities) ? briefing.priorities : [];
  const risks = priorities.filter((item) => item.kind !== "opportunity");
  const exposure = priorities.reduce((sum, item) => sum + (Number(item.value_at_stake) || 0), 0);
  const dayCount = period === "week" ? 7 : period === "yesterday" ? 1 : 1;
  const start = new Date(new Date(now).getTime() - dayCount * 24 * 60 * 60 * 1000).toISOString();
  const number = (id: string, label: string, amount: number, unit: string, meaning: string, href?: string) => ({
    id, label, value: amount, unit, provenance: "synthetic", meaning, href,
  });
  const stages = [
    ["detected", "Detected"], ["investigating", "Investigating"], ["awaiting_approval", "Awaiting approval"], ["in_progress", "In progress"],
  ] as const;
  return {
    persona: briefing.persona ?? url.searchParams.get("persona") ?? "operations_manager",
    period,
    label: period === "week" ? "Last 7 days" : period === "yesterday" ? "Yesterday" : "Today",
    headline: briefing.summary ?? "Saved synthetic dashboard summary.",
    as_of: now,
    window: { start, end: now },
    numbers: [
      number("open_problems", "Open problems", risks.length, "items", "Recorded risks awaiting review.", "/app/problems"),
      number("value_at_stake", "Value at stake", exposure, "INR", "Illustrative exposure across the saved risks.", "/app/problems"),
      number("approvals_waiting", "Approvals waiting", priorities.filter((item) => item.stage === "awaiting_approval").length, "plans", "Saved plans waiting for a human decision.", "/app/approvals"),
      number("new_problems", "New problems", risks.length, "items", "Recorded problems in this fixed demo window.", "/app/incidents"),
      number("tickets_opened", "Tickets opened", Math.max(1, risks.length * 2), "tickets", "Illustrative support activity from the fixture.", "/app/health"),
      number("complaints_opened", "Complaints opened", priorities.filter((item) => item.severity === "high" || item.severity === "critical").length, "complaints", "Illustrative quality and support complaints from the fixture.", "/app/problems"),
      number("decisions_made", "Decisions made", 0, "decisions", "No live decision is made in the static demo.", "/app/audit"),
      number("outcomes_recorded", "Outcomes recorded", 0, "outcomes", "Outcome learning is replay-only in this static demo.", "/app/outcomes"),
      number("order_value", "Order value", Math.round(exposure * 0.15), "INR", "Illustrative recorded order value, not a forecast.", "/app/health"),
    ],
    highlights: priorities.slice(0, 3).map((item) => ({
      text: item.title ?? "Recorded priority", href: `/app/incidents/${item.ref ?? "INC-2026-0001"}`, evidence_ids: [item.ref ?? "Recorded fixture"], severity: item.severity ?? "watch",
    })),
    missed: [],
    missed_total: 0,
    since: now,
    pipeline: stages.map(([stage, label]) => ({
      stage, label, count: priorities.filter((item) => item.stage === stage).length, href: "/app/incidents", meaning: `Recorded cases in ${label.toLowerCase()}.`, provenance: "synthetic",
    })),
    series: [],
    provenance: "synthetic",
  };
}

function deriveFixture(value: unknown, path: string): unknown {
  const u = new URL(path, "https://strata-ai.me");
  if (u.pathname === "/accounts" && value && typeof value === "object" && "items" in value) {
    const items = (value as { items: Array<Record<string, unknown>> }).items;
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    const type = u.searchParams.get("type");
    const region = u.searchParams.get("region");
    return { items: items.filter((item) => (!q || String(item.name).toLowerCase().includes(q)) && (!type || item.type === type) && (!region || item.region === region)) };
  }
  if (u.pathname === "/memory/search" && value && typeof value === "object" && "items" in value) {
    const q = (u.searchParams.get("q") ?? "").toLowerCase();
    const items = (value as { items: Array<Record<string, unknown>> }).items
      .filter((item) => `${item.title ?? ""} ${item.body ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8)
      .map((item) => ({ ref: item.ref, title: item.title, kind: item.kind, score: 0.8 }));
    return { items, retrieval: "recorded demo" };
  }
  if (u.pathname === "/digest" && value && typeof value === "object") return digestFromBriefing(value, path);
  return value;
}

export async function demoGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  if (path === "/auth/me") return { user: getDemoUser() } as T;
  if (path === "/auth/demo-accounts") return { items: DEMO_LOGIN_USERS } as T;
  if (path === "/auth/company") {
    const user = getDemoUser();
    return { company: user ? { id: user.company_id, name: user.company_name, code: user.company_code } : null } as T;
  }
  if (path === "/assistant/status") return { configured: false, provider: "recorded_demo", model: null } as T;
  const map = await manifest();
  const key = `GET ${normalise(path)}`;
  const source = map[key] ?? map[`GET ${fixtureFallback(path) ?? ""}`];
  if (!source) throw new Error(`No recorded fixture for ${path}.`);
  const response = await fetch(`${DATA_ROOT}/${source}`, { signal, cache: "force-cache" });
  if (!response.ok) throw new Error(`Could not load recorded fixture for ${path}.`);
  return deriveFixture(await response.json(), path) as T;
}

function answerFor(question: string) {
  const q = question.toLowerCase();
  if (q.includes("priority") || q.includes("today")) return "The recorded briefing prioritises the cases with the highest evidence-backed exposure and urgency. Open the top case to review its evidence and proposed plan.";
  if (q.includes("quality") || q.includes("qa")) return "Quality signals are routed to the QA Head for human review. STRATA records the evidence and proposed route; it does not provide clinical advice.";
  return "This is a recorded demo answer. The live engine returns cited answers from the signed-in company’s approved data sources.";
}

async function recordChange(method: string, path: string, body: unknown) {
  const row = { id: crypto.randomUUID(), method, path, body, created_at: new Date().toISOString() };
  const current = readJson<typeof row[]>(CHANGES_KEY) ?? [];
  writeJson(CHANGES_KEY, [...current, row]);
  const supabase = getSupabaseClient();
  if (supabase) {
    const user = getDemoUser();
    const { data: sessionData } = await supabase.auth.getSession();
    // One-click accounts intentionally have no Supabase identity, so they stay local-only.
    if (sessionData.session?.user && user) {
      const { error } = await supabase.from("demo_records").insert({
        id: row.id, owner_id: sessionData.session.user.id, company_id: user.company_id,
        resource: path, operation: method, payload: body, fixture_key: path,
      });
      if (error) throw error;
    }
  }
  return row;
}

export async function demoWrite<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (path === "/auth/login") {
    const email = typeof body === "object" && body && "email" in body ? String((body as { email: unknown }).email) : "";
    const user = demoUserForEmail(email);
    if (!user) throw new Error("Choose one of the one-click demo roles, or sign in with Google.");
    setDemoUser(user);
    return { token: `demo-${user.id}`, user } as T;
  }
  if (path === "/auth/logout") { setDemoUser(null); return { ok: true } as T; }
  if (path === "/assistant/chat") {
    const messages = typeof body === "object" && body && "messages" in body ? (body as { messages?: Array<{ content?: string }> }).messages ?? [] : [];
    const question = messages.at(-1)?.content ?? "";
    return { reply: answerFor(question), citations: [{ id: "Recorded demo", label: "Static fixture", href: "/app/briefing" }], provider: "recorded_demo", notice: "Recorded demo: runs live when connected to the engine." } as T;
  }
  if (path === "/ask") return { cards: [{ title: "Recorded demo", body: answerFor(String((body as { question?: string })?.question ?? "")), evidence: [{ id: "Recorded demo", label: "Static fixture" }], link: "/app/briefing" }], refused: false } as T;
  if (path === "/auth/me/prefs") {
    const user = getDemoUser();
    if (!user) throw new Error("Sign in first.");
    const prefs = { ...user.prefs, ...(body as DemoUserShape["prefs"]) };
    const next = { ...user, prefs };
    setDemoUser(next);
    await recordChange(method, path, body);
    return { user: next } as T;
  }
  const change = await recordChange(method, path, body ?? {});
  if (path === "/notes") return { ...(body as object), id: change.id, created_at: change.created_at } as T;
  if (path === "/notebook") return { ...(body as object), id: change.id, created_at: change.created_at } as T;
  if (path.includes("/decision")) return { ok: true, incident_status: "recorded_demo", tasks_created: 0, message: "Decision saved for this demo account." } as T;
  if (path.includes("/investigate")) {
    const map = await manifest(); const source = map[`POST ${normalise(path)}`];
    if (source) return (await (await fetch(`${DATA_ROOT}/${source}`)).json()) as T;
  }
  return { ok: true, id: change.id, message: "Saved for this demo account." } as T;
}

export async function resetDemoData(): Promise<void> {
  localStorage.removeItem(CHANGES_KEY);
  const supabase = getSupabaseClient();
  const user = getDemoUser();
  if (supabase && user) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) {
      const { error } = await supabase.from("demo_records").delete().eq("owner_id", sessionData.session.user.id);
      if (error) throw error;
    }
  }
}

export function profileForGoogle(user: { id: string; email?: string; user_metadata?: { full_name?: string; name?: string } }, role: string, companyId: string): DemoUserShape {
  return makeDemoUser({ id: user.id, email: user.email ?? "google-user@example.invalid", name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? "Google user", role: role as DemoUserShape["role"], company_id: companyId });
}
