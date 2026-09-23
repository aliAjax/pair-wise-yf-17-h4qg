// 判定业务模块：材质温漂折算、二十摄氏度偏差、通过/不通过/待复核规则
// 纯函数，不触碰存档与 DOM。

import type {
  AnomalyKind,
  JudgeResult,
  Material,
  Pipe,
  ReedStatus,
} from "../types";

/** 参照温度（℃）：所有结论均折算到该温度 */
export const REF_TEMP = 20;
/** 允许提交判定的气温区间（℃，闭区间） */
export const TEMP_MIN = 5;
export const TEMP_MAX = 35;
/** 二十摄氏度折算偏差允许范围（音分） */
export const TOLERANCE_CENTS = 5;

/**
 * 管体线膨胀系数（/℃，数量级 1e-5）。
 * 锡基合金约 2.3e-5，铅基合金约 2.9e-5，木质管体取约 0.5e-5
 * （木纹方向膨胀远小于金属，且木管音高对温度的响应以空气柱为主，
 *  维护台按保守经验值取定，折算仅作一阶修正）。
 */
export const MATERIAL_ALPHA: Record<Material, number> = {
  tin: 2.3e-5,
  lead: 2.9e-5,
  wood: 0.5e-5,
};

export const MATERIAL_LABEL: Record<Material, string> = {
  tin: "锡",
  lead: "铅",
  wood: "木",
};

export const REED_LABEL: Record<ReedStatus, string> = {
  none: "无簧片",
  normal: "簧片良好",
  warn: "簧片磨损",
  bad: "簧片变形",
};

/** 参与「结论锁定后修改即退出通过」的字段（材质 / 气温 / 测值） */
export const SIGNATURE_FIELDS = ["material", "tempC", "measuredHz"] as const;

/** 已锁定结论使用的字段签名：只由材质、气温、实测音高决定 */
export function signatureOf(p: Pick<Pipe, "material" | "tempC" | "measuredHz">) {
  return [p.material, p.tempC.trim(), p.measuredHz.trim()].join("|");
}

/** 折算到参照温度（20℃）的频率：f20 = f测 × (1 + α(20 - t)) */
export function correctToRefTemp(
  measuredHz: number,
  tempC: number,
  material: Material
): number {
  return measuredHz * (1 + MATERIAL_ALPHA[material] * (REF_TEMP - tempC));
}

/** 相对名义频率的音分偏差：1200 × log2(f / f0) */
export function centsDelta(f: number, nominalHz: number): number {
  return 1200 * Math.log2(f / nominalHz);
}

const FIELD_NAMES: Record<string, string> = {
  material: "材质",
  tempC: "气温",
  measuredHz: "实测音高",
  humidityPct: "湿度",
};

/**
 * 对单支音管执行一次判定。
 * 规则：
 * 1. 实测音高、气温、湿度任一缺失 → 只留待复核；
 * 2. 气温不在 5–35℃ → 只留待复核（不做温漂折算）；
 * 3. 其余按材质温漂折算 20℃ 偏差，|偏差| ≤ 5 音分为通过，否则不通过；
 * 4. 簧片磨损/变形单独记异常，不改变偏差判定。
 */
export function judgePipe(p: Pipe): JudgeResult {
  const anomalies: AnomalyKind[] = [];
  const reasons: string[] = [];

  const missing: string[] = [];
  if (p.measuredHz.trim() === "") missing.push(FIELD_NAMES.measuredHz);
  if (p.tempC.trim() === "") missing.push(FIELD_NAMES.tempC);
  if (p.humidityPct.trim() === "") missing.push(FIELD_NAMES.humidity);

  const measured = p.measuredHz.trim() === "" ? null : Number(p.measuredHz);
  const temp = p.tempC.trim() === "" ? null : Number(p.tempC);

  if (
    measured !== null &&
    (!Number.isFinite(measured) || measured <= 0)
  ) {
    missing.push(FIELD_NAMES.measuredHz);
  }

  const rawCents =
    measured !== null && Number.isFinite(measured) && measured > 0
      ? centsDelta(measured, p.nominalHz)
      : null;

  // 簧片状况独立记异常（任何判定下都登记）
  if (p.reed === "warn") {
    anomalies.push("reed");
    reasons.push("簧片磨损，建议修整");
  } else if (p.reed === "bad") {
    anomalies.push("reed");
    reasons.push("簧片变形，需更换");
  }

  // 资料不齐 → 只留待复核，不折算
  if (missing.length > 0) {
    anomalies.push("incomplete");
    return {
      pipeId: p.id,
      verdict: "review",
      rawCents,
      correctedHz: null,
      deviationCents: null,
      reasons: [`资料不齐（缺${missing.join("、")}），只留待复核`, ...reasons],
      anomalies,
    };
  }

  // 气温超出 5–35℃ → 只留待复核，不折算
  if (temp === null || !Number.isFinite(temp) || temp < TEMP_MIN || temp > TEMP_MAX) {
    anomalies.push("temperature");
    return {
      pipeId: p.id,
      verdict: "review",
      rawCents,
      correctedHz: null,
      deviationCents: null,
      reasons: [
        `气温 ${temp ?? "?"}℃ 不在 ${TEMP_MIN}–${TEMP_MAX}℃ 区间，只留待复核`,
        ...reasons,
      ],
      anomalies,
    };
  }

  const corrected = correctToRefTemp(measured as number, temp, p.material);
  const deviation = centsDelta(corrected, p.nominalHz);
  const pass = Math.abs(deviation) <= TOLERANCE_CENTS;

  if (!pass) {
    anomalies.push("overLimit");
    reasons.push(
      `20℃折算偏差 ${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)} 音分，超过 ±${TOLERANCE_CENTS} 音分`
    );
  } else {
    reasons.push(
      `20℃折算偏差 ${deviation >= 0 ? "+" : ""}${deviation.toFixed(1)} 音分，在 ±${TOLERANCE_CENTS} 音分内`
    );
  }

  return {
    pipeId: p.id,
    verdict: pass ? "pass" : "fail",
    rawCents,
    correctedHz: corrected,
    deviationCents: deviation,
    reasons,
    anomalies,
  };
}

export function judgeAll(pipes: Pipe[]): JudgeResult[] {
  return pipes.map(judgePipe);
}
