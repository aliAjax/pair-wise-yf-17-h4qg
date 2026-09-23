import { useMemo, useState } from "react";
import "./styles.css";
import { resetArchive, useArchive } from "./archive/store";
import { buildRows, formatDateTime } from "./ui/rows";
import { PipesTab } from "./ui/components/PipesTab";
import { DeviationTab } from "./ui/components/DeviationTab";
import { AnomaliesTab } from "./ui/components/AnomaliesTab";
import { EnvironmentTab } from "./ui/components/EnvironmentTab";
import { MaintenanceTab } from "./ui/components/MaintenanceTab";
import { ConclusionsTab } from "./ui/components/ConclusionsTab";

type TabKey =
  | "pipes"
  | "deviations"
  | "anomalies"
  | "environment"
  | "maintenance"
  | "conclusions";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pipes", label: "音管总览" },
  { key: "deviations", label: "偏差表" },
  { key: "anomalies", label: "异常表" },
  { key: "environment", label: "环境记录" },
  { key: "maintenance", label: "维护单" },
  { key: "conclusions", label: "结论档案" },
];

export default function App() {
  const archive = useArchive();
  const [tab, setTab] = useState<TabKey>("pipes");
  const [hallFilter, setHallFilter] = useState<string>("all");

  const allRows = useMemo(() => buildRows(archive), [archive]);
  const rows = useMemo(
    () =>
      hallFilter === "all"
        ? allRows
        : allRows.filter((r) => r.hallId === hallFilter),
    [allRows, hallFilter],
  );

  const passCount = allRows.filter((r) => r.ev.status === "pass").length;
  const failCount = allRows.filter((r) => r.ev.status === "fail").length;
  const reviewCount = allRows.filter((r) => r.ev.status === "review").length;
  const revokedCount = allRows.filter(
    (r) => r.lock.kind === "revoked",
  ).length;
  const lockedPassCount = allRows.filter(
    (r) => r.lock.kind === "active" && r.lock.record.verdict === "pass",
  ).length;
  const workCount = allRows.filter((r) => r.needsWork).length;

  const tabCounts: Partial<Record<TabKey, number>> = {
    anomalies: allRows.filter((r) => r.reasons.length > 0).length,
    maintenance: workCount,
    conclusions: archive.conclusions.length,
  };

  return (
    <main className="app">
      <header className="topbar">
        <div>
          <p className="kicker">管风琴维护台 · 两厅堂 / 三音栓 / 八音管</p>
          <h1>音管调音与检修工作台</h1>
          <span className="subtitle">
            按材质温漂折算 20℃ 偏差；资料不齐或气温不在 5–35℃ 只留待复核；
            结论锁定后改材质、气温或测值，相关音管退出通过，历史不动。
          </span>
        </div>
        <div className="topbar-side">
          <small>本地建档时间 {formatDateTime(archive.archivedAt)}</small>
          <button
            className="ghost"
            onClick={() => {
              if (
                window.confirm(
                  "确定清空当前本地存档并恢复示例资料？所有已锁定结论将丢失。",
                )
              ) {
                resetArchive();
              }
            }}
          >
            重置本地存档
          </button>
        </div>
      </header>

      <section className="metrics">
        <article>
          <small>通过（20℃折算 ≤±15 音分）</small>
          <strong className="ok-text">{passCount}</strong>
          <em>已锁定通过 {lockedPassCount}</em>
        </article>
        <article>
          <small>不通过（偏差超限）</small>
          <strong className="bad-text">{failCount}</strong>
          <em>需调音作业</em>
        </article>
        <article>
          <small>留待复核</small>
          <strong className="warn-text">{reviewCount}</strong>
          <em>资料不齐或气温越窗</em>
        </article>
        <article>
          <small>退出通过（历史保留）</small>
          <strong className="bad-text">{revokedCount}</strong>
          <em>维护单待办 {workCount}</em>
        </article>
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? "tab active" : "tab"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            {tabCounts[t.key] !== undefined && (
              <span className="tab-count">{tabCounts[t.key]}</span>
            )}
          </button>
        ))}
        <div className="filter">
          <span>厅堂</span>
          <select
            value={hallFilter}
            onChange={(e) => setHallFilter(e.target.value)}
          >
            <option value="all">全部两厅堂</option>
            {archive.halls.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </nav>

      <section className="content">
        {tab === "pipes" && <PipesTab archive={archive} rows={rows} />}
        {tab === "deviations" && <DeviationTab rows={rows} />}
        {tab === "anomalies" && <AnomaliesTab rows={rows} />}
        {tab === "environment" && <EnvironmentTab archive={archive} />}
        {tab === "maintenance" && (
          <MaintenanceTab archive={archive} rows={rows} />
        )}
        {tab === "conclusions" && <ConclusionsTab archive={archive} />}
      </section>

      <footer className="app-foot">
        判定（domain）· 数据（archive，localStorage 本地存档）· 展示（ui）三层分离；
        偏差表、异常表、环境记录与维护单共用同一份本地档案。
      </footer>
    </main>
  );
}
