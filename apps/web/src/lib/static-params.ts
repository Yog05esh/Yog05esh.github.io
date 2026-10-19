import { readFileSync } from "node:fs";
import path from "node:path";

type Snapshot = Record<string, { items?: Array<{ ref?: string; id?: string | number }> }>;

function snapshot(): Snapshot {
  const candidates = [
    path.resolve(process.cwd(), "../../data/snapshots/replay.json"),
    path.resolve(process.cwd(), "data/snapshots/replay.json"),
  ];
  for (const candidate of candidates) {
    try { return JSON.parse(readFileSync(candidate, "utf8")) as Snapshot; } catch { /* try next */ }
  }
  return {};
}

/** Build-time route list only; dynamic pages themselves remain fully client-side. */
export function recordedIncidentParams(): Array<{ id: string }> {
  const items = snapshot()["GET /incidents"]?.items ?? [];
  return items.map((item) => String(item.ref ?? item.id)).filter(Boolean).map((id) => ({ id }));
}

export function recordedAccountParams(): Array<{ id: string }> {
  const items = snapshot()["GET /accounts"]?.items ?? [];
  return items.map((item) => String(item.id ?? "")).filter(Boolean).map((id) => ({ id }));
}
