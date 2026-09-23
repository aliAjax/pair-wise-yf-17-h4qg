import type { ArchiveState, Pipe } from "../archive/types";
import {
  ANOMALY_LABEL,
  evaluate,
  formatCents,
  latestLock,
  recommendedAction,
  type Evaluation,
  type LockState,
} from "../domain/evaluate";

export interface PipeRow {
  pipe: Pipe;
  hallName: string;
  hallId: string;
  stopName: string;
  ev: Evaluation;
  lock: LockState;
  /** 当前是否需要进入维护单 */
  needsWork: boolean;
  reasons: string[];
  action: string;
}

export function buildRows(a: ArchiveState): PipeRow[] {
  return a.pipes.map((pipe) => {
    const hall = a.halls.find((h) => h.id === pipe.hallId);
    const stop = a.stops.find((s) => s.id === pipe.stopId);
    const ev = evaluate(pipe);
    const lock = latestLock(pipe, a.conclusions);

    const reasons: string[] = [...ev.reviewReasons];
    if (ev.anomalies.includes("sharp"))
      reasons.push(`折算20℃偏高 ${formatCents(ev.devCents20)} 音分`);
    if (ev.anomalies.includes("flat"))
      reasons.push(`折算20℃偏低 ${formatCents(ev.devCents20)} 音分`);
    if (ev.anomalies.includes("reed"))
      reasons.push(ANOMALY_LABEL.reed);
    if (ev.anomalies.includes("woodHumidity"))
      reasons.push(ANOMALY_LABEL.woodHumidity);
    if (lock.kind === "revoked")
      reasons.push("锁定后材质/气温/测值变更，已退出通过");

    const hasServiceAnomaly = ev.anomalies.some(
      (x) => x === "reed" || x === "woodHumidity",
    );
    const needsWork =
      ev.status !== "pass" || hasServiceAnomaly || lock.kind === "revoked";

    return {
      pipe,
      hallName: hall?.name ?? pipe.hallId,
      hallId: pipe.hallId,
      stopName: stop?.name ?? pipe.stopId,
      ev,
      lock,
      needsWork,
      reasons,
      action: recommendedAction(pipe, ev),
    };
  });
}

export function formatDateTime(iso: string): string {
  return iso.replace("T", " ").slice(0, 16);
}

export type { Pipe };
