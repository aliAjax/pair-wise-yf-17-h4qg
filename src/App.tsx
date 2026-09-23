import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import type { Archive, Pipe } from "./types";
import { HALLS, SEED_PIPES, STOPS } from "./data/seed";
import {
  commitBatch,
  detectWithdrawals,
  loadArchive,
  resetArchive,
  saveArchive,
} from "./modules/archive";
import { judgeAll, signatureOf } from "./modules/judge";
import PipeForm from "./components/PipeForm";
import DeviationTable from "./components/DeviationTable";
import AnomalyTable from "./components/AnomalyTable";
import EnvironmentLog from "./components/EnvironmentLog";
import Maintenance from "./components/Maintenance";

const PIPES_KEY = "organ-maintenance-pipes-v1";
// 各音管最近一次锁定时的字段签名（材质|气温|实测音高）
const LOCKS_KEY = "organ-maintenance-locks-v1";

function loadPipes(): Pipe[] {
  try {
    const raw = localStorage.getItem(PIPES_KEY);
    if (raw) return JSON.parse(raw) as Pipe[];
  } catch {
    /* fall through */
  }
  return SEED_PIPES;
}

function loadLocks(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LOCKS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, string>;
  } catch {
    /* fall through */
  }
  return {};
}

const NAV = [
  { href: "#pipes", label: "音管档案" },
  { href: "#deviation", label: "偏差表" },
  { href: "#anomalies", label: "异常表" },
  { href: "#environment", label: "环境记录" },
  { href: "#maintenance", label: "维护单" },
];

function App() {
  const [pipes, setPipes] = useState<Pipe[]>(loadPipes);
  const [archive, setArchive] = useState<Archive>(loadArchive);
  const [lockSignatures, setLockSignatures] =
    useState<Record<string, string>>(loadLocks);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3600);
    return () => clearTimeout(t);
  }, [toast]);

  const liveResults = useMemo(() => judgeAll(pipes), [pipes]);
  const metrics = useMemo(() => {
    const pass = liveResults.filter((r) => r.verdict === "pass").length;
    const fail = liveResults.filter((r) => r.verdict === "fail").length;
    const review = liveResults.filter((r) => r.verdict === "review").length;
    return { pass, fail, review, total: pipes.length };
  }, [liveResults, pipes]);

  function persistPipes(next: Pipe[]) {
    setPipes(next);
    localStorage.setItem(PIPES_KEY, JSON.stringify(next));
    // 结论锁定后改动材质/气温/测值 → 仅让相关音管退出通过，历史不动
    const { archive: nextArchive, withdrawals } = detectWithdrawals(
      archive,
      next,
      lockSignatures
    );
    if (withdrawals.length > 0) {
      setArchive(nextArchive);
      setToast(
        withdrawals
          .map((w) => `${w.pipeCode} 已退出 ${w.fromBatchId} 通过结论（历史不动）`)
          .join("；")
      );
    }
  }

  function handleChange(id: string, field: keyof Pipe, value: string) {
    const next = pipes.map((p) =>
      p.id === id
        ? {
            ...p,
            [field]: value,
            updatedAt: new Date()
              .toISOString()
              .slice(0, 16)
              .replace("T", " "),
          }
        : p
    );
    persistPipes(next as Pipe[]);
  }

  function handleCommit() {
    const { archive: next, batchId } = commitBatch(
      archive,
      pipes,
      STOPS,
      HALLS
    );
    // 锁定当前材质/气温/测值签名（只锁判定相关字段）
    const nextLocks: Record<string, string> = {};
    pipes.forEach((p) => {
      nextLocks[p.id] = signatureOf(p);
    });
    setLockSignatures(nextLocks);
    localStorage.setItem(LOCKS_KEY, JSON.stringify(nextLocks));
    setArchive(next);
    setToast(`结论已提交并锁定：批次 ${batchId}，偏差表/异常表/环境记录/维护单已入本地存档`);
  }

  function handleReset() {
    if (
      !window.confirm(
        "清空本地存档（偏差表、异常表、环境记录、维护单、锁定签名）并恢复八支音管的初始档案？"
      )
    )
      return;
    localStorage.removeItem(PIPES_KEY);
    localStorage.removeItem(LOCKS_KEY);
    setArchive(resetArchive());
    setPipes(SEED_PIPES);
    setLockSignatures({});
    setToast("本地存档已清空，恢复初始档案。");
  }

  return (
    <main className="app">
      <section className="hero">
        <p>管风琴维护台 · hxyfront-62005</p>
        <h1>管风琴音管调音与维护工作台</h1>
        <span>
          两个厅堂、三组音栓、八支音管。提交结论时按锡/铅/木材质温漂折算二十摄氏度偏差：
          资料不齐或气温不在 5–35℃ 的音管只留待复核；结论锁定后调整材质、气温或实测音高，
          仅令相关音管退出通过，历史批次一律不动。偏差表、异常表、环境记录与维护单共用本地存档。
        </span>
        <nav className="nav">
          {NAV.map((n) => (
            <a key={n.href} href={n.href}>
              {n.label}
            </a>
          ))}
          <button className="ghost reset" onClick={handleReset}>
            清空本地存档
          </button>
        </nav>
      </section>

      <section className="metrics">
        <article>
          <small>受检音管 / 音栓</small>
          <strong>
            {metrics.total} <em>支 / 3 组</em>
          </strong>
        </article>
        <article>
          <small>实时通过</small>
          <strong className="num-pass">{metrics.pass}</strong>
        </article>
        <article>
          <small>偏差超限</small>
          <strong className="num-fail">{metrics.fail}</strong>
        </article>
        <article>
          <small>只留待复核 / 已锁定批次</small>
          <strong>
            {metrics.review} <em>/ {archive.batches.length}</em>
          </strong>
        </article>
      </section>

      <PipeForm
        pipes={pipes}
        stops={STOPS}
        halls={HALLS}
        onChange={handleChange}
        lockSignatures={lockSignatures}
        withdrawals={archive.withdrawals}
      />

      <DeviationTable
        pipes={pipes}
        stops={STOPS}
        halls={HALLS}
        archive={archive}
        onCommit={handleCommit}
      />

      <AnomalyTable archive={archive} halls={HALLS} stops={STOPS} />
      <EnvironmentLog archive={archive} halls={HALLS} />
      <Maintenance archive={archive} halls={HALLS} stops={STOPS} />

      <footer className="foot">
        判定规则（modules/judge）· 数据存档（modules/archive，localStorage）·
        展示（components）三层分离；历史锁定批次只读。
      </footer>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

export default App;
