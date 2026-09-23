// 判定模块：纯业务规则。不读 localStorage、不依赖 React。
import type {
  Material,
  MaterialOrEmpty,
  Pipe,
  ReedCondition,
  Verdict,
  ConclusionRecord,
} from "../archive/types";

/** 允许折算/判定的气温窗口（℃） */
export const TEMP_MIN = 5;
export const TEMP_MAX = 35;
/** 折算基准温度（℃） */
export const TEMP_REF = 20;
/** 通过门限（音分）：折算到 20℃ 后 |偏差| <= 15 视为通过 */
export const PASS_LIMIT = 15;
/** 木质管湿度警戒上下限（%），仅作异常提示，不阻断判定 */
export const WOOD_HUMIDITY_MIN = 40;
export const WOOD_HUMIDITY_MAX = 65;

export interface MaterialSpec {
  key: Material;
  label: string;
  /** 每 1℃ 的实测音高漂移（音分/℃），用于折算回 20℃ */
  driftPerC: number;
  note: string;
}

export const MATERIALS: Record<Material, MaterialSpec> = {
  tin: {
    key: "tin",
    label: "锡管",
    driftPerC: 2.6,
    note: "锡铅合金中锡占比高，温升音偏高约 2.6 音分/℃",
  },
  lead: {
    key: "lead",
    label: "铅管",
    driftPerC: 1.8,
    note: "铅含量高的管壁温敏略低，约 1.8 音分/℃",
  },
  wood: {
    key: "wood",
    label: "木管",
    driftPerC: 1.2,
    note: "木质管温漂约 1.2 音分/℃，另受湿度影响明显",
  },
};

export const MATERIAL_LABEL: Record<MaterialOrEmpty, string> = {
  tin: MATERIALS.tin.label,
  lead: MATERIALS.lead.label,
  wood: MATERIALS.wood.label,
  "": "未标注",
};

export const REED_LABEL: Record<ReedCondition, string> = {
  none: "无簧片（哨管）",
  good: "簧片良好",
  worn: "簧片磨损",
  bent: "簧片变形",
  replace: "需换簧片",
};

const REED_ABNORMAL: ReedCondition[] = ["worn", "bent", "replace"];

export type AnomalyKind =
  | "missing"
  | "tempRange"
  | "sharp"
  | "flat"
  | "reed"
  | "woodHumidity";

export interface Evaluation {
  status: Verdict;
  /** 资料缺失等原因，留待复核时填写 */
  reviewReasons: string[];
  /** 不阻断判定但需要维护关注的异常 */
  anomalies: AnomalyKind[];
  measuredCents: number | null;
  /** 折算到 20℃ 的偏差（音分） */
  devCents20: number | null;
  driftCents: number | null;
  material: MaterialOrEmpty;
  temperature: number | null;
}

export function centsToHz(nominal: number, cents: number): number {
  return nominal * Math.pow(2, cents / 1200);
}

export function formatCents(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

/**
 * 判定单支音管：
 * - 资料不齐（材质 / 实测音高 / 气温 / 湿度缺失）→ 只留待复核；
 * - 气温不在 5–35℃ → 只留待复核；
 * - 其余按材质温漂折算到 20℃，|偏差| <= 15 音分通过。
 */
export function evaluate(pipe: Pipe): Evaluation {
  const { material, measuredHz, temperature, humidity, nominalHz } = pipe;
  const reviewReasons: string[] = [];
  const anomalies: AnomalyKind[] = [];

  if (material === "") reviewReasons.push("未标注材质");
  if (measuredHz === null || Number.isNaN(measuredHz))
    reviewReasons.push("缺实测音高");
  if (temperature === null || Number.isNaN(temperature))
    reviewReasons.push("缺实测气温");
  if (humidity === null || Number.isNaN(humidity))
    reviewReasons.push("缺湿度记录");

  let status: Verdict = "pass";
  if (reviewReasons.length > 0) {
    status = "review";
  } else if (
    (temperature as number) < TEMP_MIN ||
    (temperature as number) > TEMP_MAX
  ) {
    status = "review";
    reviewReasons.push(
      `气温 ${temperature}℃ 超出 ${TEMP_MIN}–${TEMP_MAX}℃ 可判定窗口`,
    );
  }

  // 实测音分偏差
  let measuredCents: number | null = null;
  if (measuredHz !== null && !Number.isNaN(measuredHz) && nominalHz > 0) {
    measuredCents = 1200 * Math.log2(measuredHz / nominalHz);
  }

  // 按材质温漂折算到 20℃：测于 T℃，温度每高 1℃ 音高高 driftPerC，
  // 折算回 20℃ 需减去 (T - 20) * drift。
  let driftCents: number | null = null;
  let devCents20: number | null = null;
  if (
    status !== "review" &&
    material !== "" &&
    measuredCents !== null &&
    temperature !== null
  ) {
    const spec = MATERIALS[material as Material];
    driftCents = (temperature - TEMP_REF) * spec.driftPerC;
    devCents20 = measuredCents - driftCents;
    if (devCents20 > PASS_LIMIT) {
      status = "fail";
      anomalies.push("sharp");
    } else if (devCents20 < -PASS_LIMIT) {
      status = "fail";
      anomalies.push("flat");
    }
  }

  // 簧片异常：不阻断音高判定，单列维护项
  if (REED_ABNORMAL.includes(pipe.reed)) anomalies.push("reed");

  // 木质管湿度警戒
  if (
    material === "wood" &&
    humidity !== null &&
    !Number.isNaN(humidity) &&
    (humidity < WOOD_HUMIDITY_MIN || humidity > WOOD_HUMIDITY_MAX)
  ) {
    anomalies.push("woodHumidity");
  }

  return {
    status,
    reviewReasons,
    anomalies,
    measuredCents,
    devCents20,
    driftCents,
    material,
    temperature,
  };
}

/**
 * 结论锁定依据：仅材质、气温、实测音高参与。
 * 结论锁定后调整材质、气温或测值 → 指纹改变 → 相关音管退出通过（历史不动）。
 */
export function fingerprint(pipe: Pipe): string {
  const m = pipe.material === "" ? "∅" : pipe.material;
  const t = pipe.temperature === null || Number.isNaN(pipe.temperature) ? "∅" : pipe.temperature;
  const hz =
    pipe.measuredHz === null || Number.isNaN(pipe.measuredHz)
      ? "∅"
      : Math.round(pipe.measuredHz * 100) / 100;
  return `${m}|${t}|${hz}`;
}

export type LockState =
  | { kind: "none" }
  | { kind: "active"; record: ConclusionRecord }
  | { kind: "revoked"; record: ConclusionRecord };

/** 取该管最近一次锁定结论；指纹不一致则原“通过”退出通过 */
export function latestLock(
  pipe: Pipe,
  conclusions: ConclusionRecord[],
): LockState {
  const mine = conclusions
    .filter((c) => c.pipeId === pipe.id)
    .sort((a, b) => (a.at < b.at ? 1 : -1));
  if (mine.length === 0) return { kind: "none" };
  const record = mine[0];
  const fp = fingerprint(pipe);
  if (record.verdict === "pass" && record.fingerprint !== fp) {
    return { kind: "revoked", record };
  }
  return { kind: "active", record };
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  pass: "通过",
  fail: "不通过",
  review: "留待复核",
};

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  missing: "资料不齐",
  tempRange: "气温越窗",
  sharp: "折算偏高",
  flat: "折算偏低",
  reed: "簧片异常",
  woodHumidity: "木管湿度警戒",
};

export const REED_ABNORMAL_ADVICE: Record<
  Exclude<ReedCondition, "none" | "good">,
  string
> = {
  worn: "簧片舌尖磨损：修整舌面或更换簧片后复测",
  bent: "簧片变形：校正簧舌弧度与压档，复测音准",
  replace: "簧片已到寿命：更换同规格簧片并重新调音",
};

/** 维护建议（仅依据当前判定） */
export function recommendedAction(pipe: Pipe, ev: Evaluation): string {
  if (ev.status === "review") {
    return `补齐资料后再判定：${ev.reviewReasons.join("、")}`;
  }
  const parts: string[] = [];
  const dev = ev.devCents20 as number;
  if (dev > PASS_LIMIT) {
    parts.push(
      `20℃折算偏高 ${formatCents(dev)} 音分：抬高调音塞片或卷收调音边，降低音高`,
    );
  } else if (dev < -PASS_LIMIT) {
    parts.push(
      `20℃折算偏低 ${formatCents(dev)} 音分：放长调音片或降低塞片，升高音高`,
    );
  }
  if (pipe.reed !== "none" && pipe.reed !== "good") {
    parts.push(REED_ABNORMAL_ADVICE[pipe.reed]);
  }
  if (ev.anomalies.includes("woodHumidity")) {
    parts.push(
      `木管湿度 ${pipe.humidity}% 偏离 ${WOOD_HUMIDITY_MIN}–${WOOD_HUMIDITY_MAX}%：先恒湿养护 24h 再调音`,
    );
  }
  if (parts.length === 0) return "无需检修，按周期巡检即可";
  return parts.join("；");
}
