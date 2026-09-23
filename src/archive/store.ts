import { useSyncExternalStore } from "react";
import type {
  ArchiveState,
  ConclusionRecord,
  EnvReading,
  MaintenanceStatus,
  Pipe,
} from "./types";
import { ARCHIVE_VERSION, buildSeed } from "./seed";
import { evaluate, fingerprint, formatCents, MATERIALS } from "../domain/evaluate";

const STORAGE_KEY = `organ-maintenance-archive-v${ARCHIVE_VERSION}`;

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function nowLocal(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours(),
  )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function load(): ArchiveState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ArchiveState;
      if (parsed.version === ARCHIVE_VERSION) return parsed;
    }
  } catch {
    /* 存档损坏时回落到种子资料 */
  }
  return buildSeed();
}

let state: ArchiveState = load();
const listeners = new Set<() => void>();

function persist(next: ArchiveState): void {
  state = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useArchive(): ArchiveState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** 修改音管资料（偏差表/异常表/维护单共用同一份记录） */
export function updatePipe(id: string, patch: Partial<Pipe>): void {
  persist({
    ...state,
    pipes: state.pipes.map((p) => (p.id === id ? { ...p, ...patch } : p)),
  });
}

/** 提交并锁定结论：按当前判定写入不可变档案 */
export function submitConclusion(pipeId: string): ConclusionRecord {
  const pipe = state.pipes.find((p) => p.id === pipeId);
  if (!pipe) throw new Error("未知音管");
  const ev = evaluate(pipe);
  let reason: string;
  if (ev.status === "review") {
    reason = `留待复核：${ev.reviewReasons.join("、")}`;
  } else {
    const matName = ev.material === "" ? "未标注" : MATERIALS[ev.material].label;
    const measured = formatCents(ev.measuredCents);
    const drift = formatCents(ev.driftCents);
    const dev = formatCents(ev.devCents20);
    reason =
      ev.status === "pass"
        ? `实测偏差 ${measured} 音分，${pipe.temperature}℃下按${matName}温漂修正 ${drift} 音分，折算20℃偏差 ${dev} 音分，门限±15内`
        : `实测偏差 ${measured} 音分，${pipe.temperature}℃下按${matName}温漂修正 ${drift} 音分，折算20℃偏差 ${dev} 音分，超出±15门限`;
  }
  const record: ConclusionRecord = {
    id: uid("c"),
    pipeId,
    at: nowLocal(),
    verdict: ev.status,
    reason,
    material: pipe.material,
    temperature: pipe.temperature,
    humidity: pipe.humidity,
    measuredHz: pipe.measuredHz,
    measuredCents:
      ev.measuredCents === null ? null : Math.round(ev.measuredCents * 10) / 10,
    devCents20:
      ev.devCents20 === null ? null : Math.round(ev.devCents20 * 10) / 10,
    fingerprint: fingerprint(pipe),
  };
  persist({ ...state, conclusions: [...state.conclusions, record] });
  return record;
}

export function submitConclusions(pipeIds: string[]): number {
  let count = 0;
  for (const id of pipeIds) {
    submitConclusion(id);
    count += 1;
  }
  return count;
}

export function addEnvReading(input: {
  hallId: string;
  temperature: number;
  humidity: number;
  note: string;
}): void {
  const reading: EnvReading = { id: uid("e"), at: nowLocal(), ...input };
  persist({ ...state, envLog: [reading, ...state.envLog] });
}

export function setMaintenance(
  pipeId: string,
  patch: { status?: MaintenanceStatus; note?: string },
): void {
  const prev = state.maintenance[pipeId];
  persist({
    ...state,
    maintenance: {
      ...state.maintenance,
      [pipeId]: {
        status: patch.status ?? prev?.status ?? "open",
        note: patch.note ?? prev?.note ?? "",
        updatedAt: nowLocal(),
      },
    },
  });
}

export function resetArchive(): void {
  persist(buildSeed());
}
