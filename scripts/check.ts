// 逻辑自测（不入打包入口）：判定 + 提交锁定 + 锁定后改动退出通过
import { SEED_PIPES, STOPS, HALLS } from "../src/data/seed";
import { judgeAll, signatureOf } from "../src/modules/judge";
import {
  commitBatch,
  emptyArchive,
  buildDeviationRows,
  detectWithdrawals,
} from "../src/modules/archive";

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exit(1);
  }
  console.log("ok  -", msg);
}

// --- localStorage stub ---
const mem: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (k: string) => mem[k] ?? null,
  setItem: (k: string, v: string) => {
    mem[k] = v;
  },
  removeItem: (k: string) => {
    delete mem[k];
  },
};

const results = judgeAll(SEED_PIPES);
const byId = Object.fromEntries(results.map((r) => [r.pipeId, r]));

assert(byId.P01.verdict === "pass", "P01 锡管 20℃ +2.5 音分 → 通过");
assert(byId.P02.verdict === "pass", "P02 锡管 21℃ 折算后 → 通过");
assert(byId.P03.verdict === "fail", "P03 锡管 +6.2 音分 → 不通过");
assert(byId.P04.verdict === "pass", "P04 铅管 → 通过");
assert(byId.P05.verdict === "fail", "P05 铅管簧片磨损且超限 → 不通过");
assert(byId.P05.anomalies.includes("reed"), "P05 簧片异常单列");
assert(byId.P06.verdict === "review", "P06 资料不齐（未测音高）→ 待复核");
assert(byId.P06.deviationCents === null, "P06 不做折算");
assert(byId.P07.verdict === "pass", "P07 木管 28℃ → 通过");
assert(byId.P08.verdict === "review", "P08 气温 36.2℃ 越界 → 待复核");
assert(byId.P08.deviationCents === null, "P08 越界不折算");

const counts = results.reduce(
  (acc, r) => ((acc[r.verdict] += 1), acc),
  { pass: 0, fail: 0, review: 0 } as Record<string, number>
);
assert(counts.pass === 4 && counts.fail === 2 && counts.review === 2, "4 通过 / 2 不通过 / 2 待复核");

// 待复核分支：缺湿度
const pipes = SEED_PIPES.map((p) => ({ ...p }));
const p3 = pipes.find((p) => p.id === "P03")!;
p3.measuredHz = "415.5";
p3.humidityPct = "";
assert(judgeAll(pipes).find((r) => r.pipeId === "P03")!.verdict === "review", "缺湿度 → 只留待复核");
p3.humidityPct = "46";
// 气温边界
p3.tempC = "5";
assert(judgeAll(pipes).find((r) => r.pipeId === "P03")!.verdict !== "review", "气温 5℃ 属边界可判定");
p3.tempC = "35";
assert(judgeAll(pipes).find((r) => r.pipeId === "P03")!.verdict !== "review", "气温 35℃ 属边界可判定");
p3.tempC = "35.1";
assert(judgeAll(pipes).find((r) => r.pipeId === "P03")!.verdict === "review", "气温 35.1℃ → 待复核");

// --- 提交锁定 ---
let archive = emptyArchive();
let locked: Record<string, string> = {};
const r1 = commitBatch(archive, SEED_PIPES, STOPS, HALLS);
archive = r1.archive;
SEED_PIPES.forEach((p) => (locked[p.id] = signatureOf(p)));

assert(archive.batches.length === 1, "生成批次 B001");
assert(archive.batches[0].id === "B001", "批次号 B001");
assert(archive.deviationTables.length === 1, "偏差表固化 1 份快照");
assert(archive.environmentLogs.length === 2, "环境记录覆盖两个厅堂");
assert(archive.maintenanceOrders.length === 1, "生成 1 张维护单");
assert(
  archive.maintenanceOrders[0].items.map((i) => i.pipeId).join(",") ===
    "P03,P05,P06,P08",
  "维护单列 P03/P05/P06/P08"
);

// 再提交一批（历史将对照）
const r2 = commitBatch(archive, SEED_PIPES, STOPS, HALLS);
archive = r2.archive;
assert(archive.batches.length === 2, "第二批次 B002 生成");
const snapshotBefore = JSON.stringify(archive.deviationTables[0]);

// --- 锁定后修改 P01 的实测音高（原通过） → 退出通过，历史不动 ---
const changed = SEED_PIPES.map((p) =>
  p.id === "P01" ? { ...p, measuredHz: "270.0" } : { ...p }
);
const w1 = detectWithdrawals(archive, changed, locked);
archive = w1.archive;
assert(w1.withdrawals.length === 1, "P01 改动测值 → 1 条退出记录");
assert(w1.withdrawals[0].pipeId === "P01", "退出的是 P01");
assert(
  JSON.stringify(archive.deviationTables[0]) === snapshotBefore,
  "历史偏差表快照未改动"
);
assert(archive.batches[0].passCount === 4, "历史批次统计未改动（仍 4 通过）");
assert(archive.anomalies[archive.anomalies.length - 1].batchId === null, "退出记录以非批次异常追加");

// 再改一次 P01 → 同批次不重复记退出
const changed2 = changed.map((p) =>
  p.id === "P01" ? { ...p, tempC: "23" } : p
);
const w2 = detectWithdrawals(archive, changed2, locked);
assert(w2.withdrawals.length === 0, "同批次同管反复改动不重复退出");

// 改 P03（原本不通过）→ 不产生退出
const changed3 = SEED_PIPES.map((p) =>
  p.id === "P03" ? { ...p, measuredHz: "400" } : { ...p }
);
const w3 = detectWithdrawals(archive, changed3, locked);
assert(w3.withdrawals.length === 0, "非通过管改动不产生退出");

// 改 P01 的备注（非材质/气温/测值）→ 不退出
const changed4 = SEED_PIPES.map((p) =>
  p.id === "P01" ? { ...p, noteText: "仅改备注" } : { ...p }
);
const w4 = detectWithdrawals(archive, changed4, locked);
assert(w4.withdrawals.length === 0, "改检修备注不影响通过结论");

// 新提交一批后 P01 已按新值判定，旧历史仍不动
const r3 = commitBatch(archive, changed, STOPS, HALLS);
archive = r3.archive;
assert(archive.batches.length === 3, "第三批次 B003 生成");
assert(archive.deviationTables[0].rows.find((r) => r.pipeId === "P01")!.verdict === "pass", "B001 中 P01 仍为通过（历史不动）");
assert(archive.deviationTables[2].rows.find((r) => r.pipeId === "P01")!.verdict === "fail", "B003 中 P01 按新测值为不通过");

// 存档共用一份：所有表都来自同一 Archive 对象
const rows = buildDeviationRows(SEED_PIPES, STOPS, HALLS);
assert(rows.length === 8, "偏差表 8 行");
console.log("\n全部逻辑校验通过 ✔");
