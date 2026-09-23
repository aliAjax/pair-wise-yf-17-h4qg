import { useState } from "react";
import { submitConclusions } from "../../archive/store";
import {
  formatCents,
  MATERIALS,
  PASS_LIMIT,
  TEMP_MAX,
  TEMP_MIN,
} from "../../domain/evaluate";
import type { PipeRow } from "../rows";
import { LockBadge, VerdictBadge } from "./Badge";

export function DeviationTab({ rows }: { rows: PipeRow[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submittable = rows.filter(
    (r) => !(r.lock.kind === "active" && r.lock.record.verdict === "pass"),
  );

  return (
    <div className="tab-body">
      <div className="table-toolbar">
        <p>
          折算规则：<b>20℃偏差 = 实测偏差 −（气温−20）×材质温漂系数</b>；
          |折算偏差| ≤ {PASS_LIMIT} 音分为通过。资料不齐或气温超出
          {TEMP_MIN}–{TEMP_MAX}℃ 时只留待复核，不折算。
        </p>
        <button
          className="primary"
          disabled={selected.size === 0}
          onClick={() => {
            submitConclusions(Array.from(selected));
            setSelected(new Set());
          }}
        >
          提交并锁定所选（{selected.size}）
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th className="check-col">选</th>
              <th>厅堂</th>
              <th>音栓</th>
              <th>音管编号</th>
              <th>音高</th>
              <th>材质</th>
              <th>实测(Hz)</th>
              <th>气温(℃)</th>
              <th>实测偏差</th>
              <th>温漂修正</th>
              <th>20℃折算偏差</th>
              <th>当前判定</th>
              <th>结论状态</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const driftSpec =
                r.pipe.material === ""
                  ? "—"
                  : `${MATERIALS[r.pipe.material].driftPerC} 音分/℃`;
              const blocked =
                r.lock.kind === "active" && r.lock.record.verdict === "pass";
              return (
                <tr
                  key={r.pipe.id}
                  className={
                    r.lock.kind === "revoked"
                      ? "row-revoked"
                      : `row-${r.ev.status}`
                  }
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.pipe.id)}
                      disabled={blocked}
                      onChange={() => toggle(r.pipe.id)}
                    />
                  </td>
                  <td>{r.hallName}</td>
                  <td>{r.stopName}</td>
                  <td className="mono">{r.pipe.code}</td>
                  <td>
                    {r.pipe.noteName}
                    <small>{r.pipe.nominalHz} Hz</small>
                  </td>
                  <td>
                    {r.pipe.material === "" ? (
                      <span className="missing-text">待确认</span>
                    ) : (
                      MATERIALS[r.pipe.material].label
                    )}
                    <small>{driftSpec}</small>
                  </td>
                  <td className="mono">
                    {r.pipe.measuredHz === null ? (
                      <span className="missing-text">缺测</span>
                    ) : (
                      r.pipe.measuredHz
                    )}
                  </td>
                  <td
                    className={`mono ${
                      r.ev.temperature !== null &&
                      (r.ev.temperature < TEMP_MIN ||
                        r.ev.temperature > TEMP_MAX)
                        ? "missing-text"
                        : ""
                    }`}
                  >
                    {r.ev.temperature === null ? "缺测" : r.ev.temperature}
                  </td>
                  <td className="mono">{formatCents(r.ev.measuredCents)}</td>
                  <td className="mono">
                    {r.ev.driftCents === null
                      ? "不折算"
                      : formatCents(r.ev.driftCents)}
                  </td>
                  <td className="mono strong">
                    {r.ev.devCents20 === null
                      ? "—"
                      : formatCents(r.ev.devCents20)}
                  </td>
                  <td>
                    <VerdictBadge verdict={r.ev.status} />
                    {r.ev.reviewReasons.length > 0 && (
                      <small className="cell-note">
                        {r.ev.reviewReasons.join("；")}
                      </small>
                    )}
                  </td>
                  <td>
                    <LockBadge lock={r.lock} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-foot">
        可提交 {submittable.length} 支（已锁定且仍通过的不可重复提交）；勾选后点上方按钮批量锁定。
      </p>
    </div>
  );
}
