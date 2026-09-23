// 展示模块共用的小组件与文案

import type { AnomalyKind, AnomalyLevel, Verdict } from "../types";

export const VERDICT_LABEL: Record<Verdict, string> = {
  pass: "通过",
  fail: "不通过",
  review: "待复核",
};

export const VERDICT_CLASS: Record<Verdict, string> = {
  pass: "badge pass",
  fail: "badge fail",
  review: "badge review",
};

export const ANOMALY_LABEL: Record<AnomalyKind, string> = {
  overLimit: "偏差超限",
  temperature: "气温越界",
  incomplete: "资料不齐",
  reed: "簧片异常",
};

export const LEVEL_LABEL: Record<AnomalyLevel, string> = {
  fail: "不通过",
  review: "待复核",
  warn: "关注",
};

export function fmt(n: number | null, digits = 1): string {
  return n === null || !Number.isFinite(n) ? "—" : n.toFixed(digits);
}

export function fmtSigned(n: number | null, digits = 1): string {
  if (n === null || !Number.isFinite(n)) return "—";
  const v = n.toFixed(digits);
  return n > 0 ? `+${v}` : v;
}

export function Badge({ verdict }: { verdict: Verdict }) {
  return <span className={VERDICT_CLASS[verdict]}>{VERDICT_LABEL[verdict]}</span>;
}

export function Empty({ text }: { text: string }) {
  return <p className="empty">{text}</p>;
}
