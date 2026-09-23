// 判定、数据、展示三模块共用的领域类型

export type Material = "tin" | "lead" | "wood";

export type ReedStatus =
  | "none" // 无簧片（哨管）
  | "normal" // 簧片良好
  | "warn" // 簧片磨损
  | "bad"; // 簧片变形

/** 提交结论时的判定 */
export type Verdict = "pass" | "fail" | "review";

export type AnomalyKind = "overLimit" | "temperature" | "incomplete" | "reed";

export interface Hall {
  id: string;
  name: string;
  location: string;
}

export interface Stop {
  id: string;
  hallId: string;
  name: string;
  kind: string;
}

export interface Pipe {
  id: string;
  stopId: string;
  code: string; // 音管编号
  note: string; // 名义音高（如 C4）
  nominalHz: number; // 名义频率
  material: Material;
  /** 实测频率（Hz），空串表示未测 */
  measuredHz: string;
  /** 气温（℃），空串表示未记 */
  tempC: string;
  /** 相对湿度（%），空串表示未记 */
  humidityPct: string;
  reed: ReedStatus;
  noteText: string; // 检修备注
  updatedAt: string;
}

export interface JudgeResult {
  pipeId: string;
  verdict: Verdict;
  rawCents: number | null; // 实测对名义的原始音分偏差
  correctedHz: number | null; // 折算到 20℃ 的频率
  deviationCents: number | null; // 20℃ 折算偏差（音分）
  reasons: string[];
  anomalies: AnomalyKind[];
}

export type AnomalyLevel = "fail" | "review" | "warn";

export interface AnomalyRecord {
  id: string;
  pipeId: string;
  pipeCode: string;
  hallId: string;
  stopId: string;
  kind: AnomalyKind;
  level: AnomalyLevel;
  detail: string;
  /** 锁定后生成的记录带批次号；实时异常为空 */
  batchId: string | null;
  createdAt: string;
}

export interface EnvironmentRecord {
  id: string;
  batchId: string | null;
  hallId: string;
  tempC: number | null;
  humidityPct: number | null;
  status: "ok" | "outOfRange" | "missing";
  measuredAt: string;
}

export interface DeviationRow {
  pipeId: string;
  pipeCode: string;
  hallId: string;
  stopId: string;
  material: Material;
  tempC: number | null;
  measuredHz: number | null;
  nominalHz: number;
  rawCents: number | null;
  correctedHz: number | null;
  deviationCents: number | null;
  verdict: Verdict;
  reasons: string[];
}

export interface MaintenanceItem {
  pipeId: string;
  pipeCode: string;
  hallId: string;
  stopId: string;
  action: string;
  reasons: string[];
}

export interface MaintenanceOrder {
  id: string;
  batchId: string;
  title: string;
  items: MaintenanceItem[];
  createdAt: string;
}

export interface BatchSummary {
  id: string;
  createdAt: string;
  passCount: number;
  failCount: number;
  reviewCount: number;
  anomalyCount: number;
  pipeCount: number;
  withdrawnCount: number;
}

export interface WithdrawalRecord {
  pipeId: string;
  pipeCode: string;
  fromBatchId: string;
  reason: string;
  changedFields: string[];
  createdAt: string;
}

export interface Archive {
  version: 1;
  batchSeq: number;
  // 偏差表（每次提交追加一份快照）
  deviationTables: { batchId: string; createdAt: string; rows: DeviationRow[] }[];
  // 异常表（锁定时固化 + 退出通过记录追加）
  anomalies: AnomalyRecord[];
  // 环境记录
  environmentLogs: EnvironmentRecord[];
  // 维护单
  maintenanceOrders: MaintenanceOrder[];
  // 提交批次（结论锁定后历史不动）
  batches: BatchSummary[];
  withdrawals: WithdrawalRecord[];
}
