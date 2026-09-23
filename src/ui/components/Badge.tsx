import type { ReactNode } from "react";
import type { Verdict } from "../../archive/types";

const BADGE_CLASS: Record<Verdict, string> = {
  pass: "badge pass",
  fail: "badge fail",
  review: "badge review",
};

const BADGE_TEXT: Record<Verdict, string> = {
  pass: "通过",
  fail: "不通过",
  review: "留待复核",
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  return <span className={BADGE_CLASS[verdict]}>{BADGE_TEXT[verdict]}</span>;
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "bad" | "info";
  children: ReactNode;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function LockBadge({
  lock,
}: {
  lock:
    | { kind: "none" }
    | { kind: "active"; record: { verdict: Verdict } }
    | { kind: "revoked"; record: { verdict: Verdict } };
}) {
  if (lock.kind === "none")
    return <Badge tone="neutral">未提交结论</Badge>;
  if (lock.kind === "active") {
    if (lock.record.verdict === "pass")
      return <Badge tone="ok">结论已锁定 · 通过</Badge>;
    if (lock.record.verdict === "review")
      return <Badge tone="warn">结论已锁定 · 留待复核</Badge>;
    return <Badge tone="bad">结论已锁定 · 不通过</Badge>;
  }
  return <Badge tone="bad">已退出通过（历史保留）</Badge>;
}
