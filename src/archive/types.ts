// 数据模块：本地存档的数据结构（偏差表、异常表、环境记录、维护单共用）

export type Material = "tin" | "lead" | "wood";
export type MaterialOrEmpty = Material | "";

export type ReedCondition = "none" | "good" | "worn" | "bent" | "replace";

export interface Hall {
  id: string;
  name: string;
  place: string;
}

export interface StopDef {
  id: string;
  hallId: string;
  name: string;
  kind: "flue" | "reed";
}

export interface Pipe {
  id: string;
  /** 音管编号 */
  code: string;
  hallId: string;
  stopId: string;
  /** 标称音高，如 C4 */
  noteName: string;
  /** 标称频率 Hz */
  nominalHz: number;
  /** 锡 / 铅 / 木 */
  material: MaterialOrEmpty;
  /** 实测音高 Hz */
  measuredHz: number | null;
  /** 实测气温 ℃ */
  temperature: number | null;
  /** 相对湿度 % */
  humidity: number | null;
  /** 簧片状况（flue 管为 none） */
  reed: ReedCondition;
  /** 检修备注 */
  repairNote: string;
}

export interface EnvReading {
  id: string;
  hallId: string;
  at: string;
  temperature: number;
  humidity: number;
  note: string;
}

export type Verdict = "pass" | "fail" | "review";

/** 结论档案条目：一经提交即不可变 */
export interface ConclusionRecord {
  id: string;
  pipeId: string;
  at: string;
  verdict: Verdict;
  reason: string;
  // 结论时刻的资料快照
  material: MaterialOrEmpty;
  temperature: number | null;
  humidity: number | null;
  measuredHz: number | null;
  measuredCents: number | null;
  devCents20: number | null;
  fingerprint: string;
}

export type MaintenanceStatus = "open" | "doing" | "done";

export interface MaintenanceState {
  status: MaintenanceStatus;
  note: string;
  updatedAt: string;
}

export interface ArchiveState {
  version: number;
  archivedAt: string;
  halls: Hall[];
  stops: StopDef[];
  pipes: Pipe[];
  envLog: EnvReading[];
  conclusions: ConclusionRecord[];
  maintenance: Record<string, MaintenanceState>;
}
