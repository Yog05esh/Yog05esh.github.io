#!/usr/bin/env node
/**
 * Export the compact static-demo fixture set. The primary source is a running
 * keyless engine; the committed replay snapshot is an intentional offline
 * fallback, so fixture generation never needs a secret or an LLM provider.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(root, "apps", "web", "public", "demo-data");
const snapshotPath = path.join(root, "data", "snapshots", "replay.json");
const engine = (process.env.DEMO_ENGINE_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const manifest = {};
await mkdir(output, { recursive: true });

const stable = (requestPath) => {
  const [pathname, query = ""] = requestPath.split("?");
  if (!query) return pathname;
  const pairs = [...new URLSearchParams(query).entries()].sort(([a], [b]) => a.localeCompare(b));
  return `${pathname}?${pairs.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join("&")}`;
};
const filename = (key) => Buffer.from(key).toString("base64url").replace(/[^A-Za-z0-9_-]/g, "_") + ".json";

async function engineValue(method, requestPath, fallback) {
  try {
    const response = await fetch(`${engine}${requestPath}`, { method, signal: AbortSignal.timeout(1800) });
    if (!response.ok) throw new Error(String(response.status));
    return await response.json();
  } catch {
    return fallback;
  }
}

/** Keep the deploy light while retaining every route the UI can navigate to. */
const accounts = snapshot["GET /accounts"]?.items ?? [];
const includedAccounts = accounts.slice(0, 60);
const accountIds = new Set(includedAccounts.map((item) => String(item.id)));
for (const incident of snapshot["GET /incidents"]?.items ?? []) {
  if (incident.account_id !== null && incident.account_id !== undefined) accountIds.add(String(incident.account_id));
}

function compact(key, value) {
  if (key === "GET /accounts" && value?.items) return { ...value, items: includedAccounts };
  if (key === "GET /audit" && value?.items) return { ...value, items: value.items.slice(0, 120) };
  if ((key === "GET /events" || key.startsWith("GET /events?")) && value?.items) return { ...value, items: value.items.slice(0, 80) };
  return value;
}

for (const [rawKey, fallback] of Object.entries(snapshot)) {
  const split = rawKey.indexOf(" ");
  const method = rawKey.slice(0, split);
  const requestPath = rawKey.slice(split + 1);
  if (requestPath.startsWith("/accounts/") && !accountIds.has(requestPath.slice("/accounts/".length))) continue;
  const key = `${method} ${stable(requestPath)}`;
  const value = compact(key, await engineValue(method, requestPath, fallback));
  const name = filename(key);
  await writeFile(path.join(output, name), JSON.stringify(value));
  manifest[key] = name;
}

const recordedDefaults = {
  "GET /health": { status: "ok", mode: "replay", store: "static fixtures", llm_provider: "none", retrieval: "recorded", sim_now: "2026-10-10T09:00:00Z", features: ["static-demo"] },
  "GET /sim/catalog": {
    industries: [{ key: "pharma", label: "Pharma", blurb: "Recorded illustrative scenario.", count: 1 }],
    categories: [{ key: "late_shipment", label: "Late shipment", count: 1 }],
    stages: ["observe", "detect", "investigate", "remember", "act", "learn"].map((key) => ({ key, label: key[0].toUpperCase() + key.slice(1) })),
    scenarios: [{ id: "recorded-supplier-delay", industry: "pharma", category: "late_shipment", title: "Recorded supplier delay", one_liner: "A saved illustrative scenario from the engine.", trigger: "Supplier delay pattern", horizon_weeks: 12, start_level: 2, peak_level: 4, primary_kpi: "revenue", regulatory: false }],
    policy: { default_level: 2, human_threshold: 2, deadlines_hours: { "2": 24 }, auto_decide_max_level: 1, provisional_max_level: 3, email_min_level: 4 },
    caption: "Recorded illustrative scenario; not a measured result.", provenance: "illustrative",
  },
};
for (const [key, value] of Object.entries(recordedDefaults)) {
  if (manifest[key]) continue;
  const name = filename(key);
  await writeFile(path.join(output, name), JSON.stringify(value));
  manifest[key] = name;
}

await writeFile(path.join(output, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Wrote ${Object.keys(manifest).length} fixtures to ${path.relative(root, output)} (engine attempted at ${engine}; snapshot used when unavailable).`);
