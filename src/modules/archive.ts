// 数据业务模块：本地存档（偏差表 / 异常表 / 环境记录 / 维护单共用一份存档）
// 结论锁定后历史快照不可变；锁定后改材质、气温或测值，只让相关音管退出通过。

import type {
  AnomalyRecord,
  Archive,
  BatchSummary,
  DeviationRow,
  EnvironmentRecord,
  Hall,
  MaintenanceItem,
  MaintenanceOrder,
  Pipe,
  Stop,
  WithdrawalRecord,
} from "../types";
import {
  judgeAll,
  signatureOf,
  TEMP_MAX,
  TEMP_MIN,
  TOLERANCE_CENTS,
} from "./judge";

const STORAGE_KEY = "organ-maintenance-archive-v1";

export function emptyArchive(): Archive {
  return {
    version: 1,
    batchSeq: 0,
    deviationTables: [],
    anomalies: [],
    environmentLogs: [],
    maintenanceOrders: [],
    batches: [],
    withdrawals: [],
  };
}

/** 偏差表、异常表、环境记录和维护单共用同一份本地存档 */
export function loadArchive(): Archive {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyArchive();
    const parsed = JSON.parse(raw) as Archive;
    if (parsed.version !== 1) return emptyArchive();
    return { ...emptyArchive(), ...parsed };
  } catch {
    return emptyArchive();
  }
}

export function saveArchive(a: Archive) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

export function resetArchive(): Archive {
  const empty = emptyArchive();
  saveArchive(empty);
  return empty;
}

export function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

export function buildDeviationRows(
  pipes: Pipe[],
  stops: Stop[],
  halls: Hall[]
): DeviationRow[] {
  const stopById = new Map(stops.map((s) => [s.id, s]));
  const results = judgeAll(pipes);
  return pipes.map((p, i) => {
    const r = results[i];
    const stop = stopById.get(p.stopId);
    const hallId = stop?.hallId ?? "";
    const measured = p.measuredHz.trim() === "" ? null : Number(p.measuredHz);
    const temp = p.tempC.trim() === "" ? null : Number(p.tempC);
    return {
      pipeId: p.id,
      pipeCode: p.code,
      hallId,
      stopId: p.stopId,
      material: p.material,
      tempC: temp !== null && Number.isFinite(temp) ? temp : null,
      measuredHz:
        measured !== null && Number.isFinite(measured) ? measured : null,
      nominalHz: p.nominalHz,
      rawCents: r.rawCents,
      correctedHz: r.correctedHz,
      deviationCents: r.deviationCents,
      verdict: r.verdict,
      reasons: r.reasons,
    };
  });
}

/**
 * 提交结论：生成一个批次号，把当前偏差表、异常、环境记录、维护单固化进存档。
 * 已固化的历史批次之后不再被任何数据修改改动。
 */
export function commitBatch(
  prev: Archive,
  pipes: Pipe[],
  stops: Stop[],
  halls: Hall[]
): { archive: Archive; batchId: string } {
  const seq = prev.batchSeq + 1;
  const batchId = `B${String(seq).padStart(3, "0")}`;
  const stamp = nowStamp();

  const rows = buildDeviationRows(pipes, stops, halls);
  const results = judgeAll(pipes);
  const stopById = new Map(stops.map((s) => [s.id, s]));

  // 异常表：只固化偏差超限、气温越界、资料不齐、簧片异常
  const anomalies: AnomalyRecord[] = [];
  pipes.forEach((p, i) => {
    const r = results[i];
    const hallId = stopById.get(p.stopId)?.hallId ?? "";
    r.anomalies.forEach((kind) => {
      let level: AnomalyRecord["level"];
      let detail = "";
      if (kind === "overLimit") {
        level = "fail";
        detail =
          r.deviationCents === null
            ? "偏差超限"
            : `20℃折算偏差 ${r.deviationCents.toFixed(1)} 音分（±${TOLERANCE_CENTS}）`;
      } else if (kind === "temperature") {
        level = "review";
        detail = `气温 ${p.tempC || "?"}℃，超出 ${TEMP_MIN}–${TEMP_MAX}℃ 可判定区间`;
      } else if (kind === "incomplete") {
        level = "review";
        detail = "实测音高 / 气温 / 湿度资料不齐";
      } else {
        level = "warn";
        detail = p.reed === "bad" ? "簧片变形，需更换" : "簧片磨损，建议修整";
      }
      anomalies.push({
        id: uid("an"),
        pipeId: p.id,
        pipeCode: p.code,
        hallId,
        stopId: p.stopId,
        kind,
        level,
        detail,
        batchId,
        createdAt: stamp,
      });
    });
  });

  // 环境记录：每个厅堂一条（取该厅堂音管的气温/湿度，缺失即 missing）
  const envLogs: EnvironmentRecord[] = halls.map((h) => {
    const hallStopIds = new Set(
      stops.filter((s) => s.hallId === h.id).map((s) => s.id)
    );
    const hallPipes = pipes.filter((p) => hallStopIds.has(p.stopId));
    const temps = hallPipes
      .map((p) => Number(p.tempC))
      .filter((n) => Number.isFinite(n));
    const hums = hallPipes
      .map((p) => Number(p.humidityPct))
      .filter((n) => Number.isFinite(n));
    if (hallPipes.length === 0 || temps.length === 0 || hums.length === 0) {
      return {
        id: uid("env"),
        batchId,
        hallId: h.id,
        tempC: temps.length ? temps[0] : null,
        humidityPct: hums.length ? hums[0] : null,
        status: "missing",
        measuredAt: stamp,
      };
    }
    const t = temps[0];
    const status =
      t < TEMP_MIN || t > TEMP_MAX ? "outOfRange" : "ok";
    return {
      id: uid("env"),
      batchId,
      hallId: h.id,
      tempC: t,
      humidityPct: hums[0],
      status,
      measuredAt: stamp,
    };
  });

  // 维护单：不通过 + 待复核 + 簧片异常的音管逐条列处置建议
  const items: MaintenanceItem[] = [];
  pipes.forEach((p, i) => {
    const r = results[i];
    const hallId = stopById.get(p.stopId)?.hallId ?? "";
    let action = "";
    if (r.verdict === "fail") action = "调音检修，复测后重新提交";
    else if (r.verdict === "review") action = "补齐资料 / 待环境恢复后复核";
    else if (r.anomalies.includes("reed"))
      action =
        p.reed === "bad" ? "更换簧片" : "修整簧片并复查音高";
    if (action) {
      items.push({
        pipeId: p.id,
        pipeCode: p.code,
        hallId,
        stopId: p.stopId,
        action,
        reasons: r.reasons,
      });
    }
  });
  const order: MaintenanceOrder = {
    id: uid("mo"),
    batchId,
    title: `单次维护单 ${batchId}（${stamp}）`,
    items,
    createdAt: stamp,
  };

  const summary: BatchSummary = {
    id: batchId,
    createdAt: stamp,
    pipeCount: pipes.length,
    passCount: results.filter((r) => r.verdict === "pass").length,
    failCount: results.filter((r) => r.verdict === "fail").length,
    reviewCount: results.filter((r) => r.verdict === "review").length,
    anomalyCount: anomalies.length,
    withdrawnCount: 0,
  };

  const archive: Archive = {
    ...prev,
    batchSeq: seq,
    deviationTables: [...prev.deviationTables, { batchId, createdAt: stamp, rows }],
    anomalies: [...prev.anomalies, ...anomalies],
    environmentLogs: [...prev.environmentLogs, ...envLogs],
    maintenanceOrders: [...prev.maintenanceOrders, order],
    batches: [...prev.batches, summary],
  };
  saveArchive(archive);
  return { archive, batchId };
}

/**
 * 结论锁定后调整材质、气温或测值：
 * 比对签名，凡在历史批次中「通过」且签名已变的音管退出通过——
 * 仅向异常表 / 退出记录追加条目，历史偏差表与批次统计一律不动。
 */
export function detectWithdrawals(
  archive: Archive,
  pipes: Pipe[],
  lockSignatures: Record<string, string>
): { archive: Archive; withdrawals: WithdrawalRecord[] } {
  const stamp = nowStamp();
  const newWithdrawals: WithdrawalRecord[] = [];
  const existingKey = new Set(
    archive.withdrawals.map((w) => `${w.fromBatchId}|${w.pipeId}`)
  );

  for (const p of pipes) {
    const locked = lockSignatures[p.id];
    if (locked === undefined) continue;
    if (signatureOf(p) === locked) continue;

    // 找出该管曾通过的批次（取最近一个），历史本身不动
    let fromBatchId: string | null = null;
    for (const table of archive.deviationTables) {
      const row = table.rows.find((r) => r.pipeId === p.id);
      if (row && row.verdict === "pass") fromBatchId = table.batchId;
    }
    if (!fromBatchId) continue;

    const key = `${fromBatchId}|${p.id}`;
    // 同一批次同一管只记一次退出（继续改测值不会反复刷历史）
    if (existingKey.has(key)) continue;

    const lockedParts = locked.split("|");
    const changedFields: string[] = [];
    if (p.material !== lockedParts[0]) changedFields.push("材质");
    if (p.tempC.trim() !== lockedParts[1]) changedFields.push("气温");
    if (p.measuredHz.trim() !== lockedParts[2]) changedFields.push("实测音高");

    const w: WithdrawalRecord = {
      pipeId: p.id,
      pipeCode: p.code,
      fromBatchId,
      reason: `锁定后改动${changedFields.join("、")}，退出 ${fromBatchId} 通过结论，历史记录保持不动`,
      changedFields,
      createdAt: stamp,
    };
    newWithdrawals.push(w);
  }

  if (newWithdrawals.length === 0) return { archive, withdrawals: [] };

  const anomalyAdds: AnomalyRecord[] = newWithdrawals.map((w) => {
    const pipe = pipes.find((p) => p.id === w.pipeId);
    return {
      id: uid("an"),
      pipeId: w.pipeId,
      pipeCode: w.pipeCode,
      hallId: "",
      stopId: pipe?.stopId ?? "",
      kind: "overLimit",
      level: "fail",
      detail: w.reason,
      batchId: null,
      createdAt: stamp,
    };
  });

  const next: Archive = {
    ...archive,
    withdrawals: [...archive.withdrawals, ...newWithdrawals],
    anomalies: [...archive.anomalies, ...anomalyAdds],
  };
  saveArchive(next);
  return { archive: next, withdrawals: newWithdrawals };
}
