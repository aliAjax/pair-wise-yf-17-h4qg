// 展示模块：偏差表（实时判定 + 已锁定批次的历史快照，只读不可改）

import type { Archive, Hall, Pipe, Stop } from "../types";
import { buildDeviationRows } from "../modules/archive";
import { MATERIAL_LABEL } from "../modules/judge";
import { Badge, Empty, fmt, fmtSigned } from "./ui";

interface Props {
  pipes: Pipe[];
  stops: Stop[];
  halls: Hall[];
  archive: Archive;
  onCommit: () => void;
}

function hallName(id: string, halls: Hall[]) {
  return halls.find((h) => h.id === id)?.name ?? id;
}
function stopName(id: string, stops: Stop[]) {
  return stops.find((s) => s.id === id)?.name ?? id;
}

function Table({
  rows,
  stops,
  halls,
}: {
  rows: ReturnType<typeof buildDeviationRows>;
  stops: Stop[];
  halls: Hall[];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>音管</th>
            <th>厅堂</th>
            <th>音栓</th>
            <th>材质</th>
            <th>气温℃</th>
            <th>实测Hz</th>
            <th>原始偏差</th>
            <th>20℃折算Hz</th>
            <th>折算偏差(音分)</th>
            <th>判定</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.pipeId} className={`row-${r.verdict}`}>
              <td>{r.pipeCode}</td>
              <td>{hallName(r.hallId, halls)}</td>
              <td>{stopName(r.stopId, stops)}</td>
              <td>{MATERIAL_LABEL[r.material]}</td>
              <td>{fmt(r.tempC, 1)}</td>
              <td>{fmt(r.measuredHz, 2)}</td>
              <td>{fmtSigned(r.rawCents)}</td>
              <td>{fmt(r.correctedHz, 2)}</td>
              <td className={r.verdict === "fail" ? "num-fail" : r.verdict === "pass" ? "num-pass" : ""}>
                {fmtSigned(r.deviationCents)}
              </td>
              <td>
                <Badge verdict={r.verdict} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DeviationTable({
  pipes,
  stops,
  halls,
  archive,
  onCommit,
}: Props) {
  const liveRows = buildDeviationRows(pipes, stops, halls);
  const counts = {
    pass: liveRows.filter((r) => r.verdict === "pass").length,
    fail: liveRows.filter((r) => r.verdict === "fail").length,
    review: liveRows.filter((r) => r.verdict === "review").length,
  };

  return (
    <section className="panel" id="deviation">
      <div className="heading">
        <div>
          <p>偏差表</p>
          <h2>二十摄氏度折算偏差（±5 音分）</h2>
        </div>
        <button className="primary" onClick={onCommit}>
          提交结论并锁定本批
        </button>
      </div>

      <div className="stat-line">
        <span className="dot pass" /> 通过 {counts.pass}
        <span className="dot fail" /> 不通过 {counts.fail}
        <span className="dot review" /> 待复核 {counts.review}
        <span className="muted">
          折算公式 f₂₀ = f测 × (1 + α(20−t))；资料不齐或气温超出 5–35℃ 不折算
        </span>
      </div>

      <h3 className="sub">当前实时判定</h3>
      <Table rows={liveRows} stops={stops} halls={halls} />

      <h3 className="sub">历史锁定批次（只读）</h3>
      {archive.deviationTables.length === 0 ? (
        <Empty text="尚无锁定批次，提交结论后此处保存不可变快照。" />
      ) : (
        <div className="history-list">
          {[...archive.deviationTables].reverse().map((t) => {
            const summary = archive.batches.find((b) => b.id === t.batchId);
            return (
              <details key={t.batchId} className="history-block">
                <summary>
                  {t.batchId} · {t.createdAt} · {t.rows.length} 支
                  {summary &&
                    `（通过 ${summary.passCount} / 不通过 ${summary.failCount} / 待复核 ${summary.reviewCount}${
                      summary.withdrawnCount ? ` / 退出 ${summary.withdrawnCount}` : ""
                    }）`}
                </summary>
                <Table rows={t.rows} stops={stops} halls={halls} />
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
