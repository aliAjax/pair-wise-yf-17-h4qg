import type { ArchiveState } from "../../archive/types";
import { updatePipe, submitConclusion } from "../../archive/store";
import {
  MATERIALS,
  TEMP_MAX,
  TEMP_MIN,
} from "../../domain/evaluate";
import type { PipeRow } from "../rows";
import { LockBadge, VerdictBadge } from "./Badge";
import { MaterialSelect, NumInput, ReedSelect } from "./Controls";

export function PipesTab({
  archive,
  rows,
}: {
  archive: ArchiveState;
  rows: PipeRow[];
}) {
  return (
    <div className="tab-body">
      <div className="hint-bar">
        共 8 支音管，分属两厅堂三音栓。材质、气温、实测音高可直接修改并即时存档；
        已锁定「通过」的音管若改动这三项，将立即退出通过，历史结论保持不动。
      </div>
      {archive.halls.map((hall) => {
        const hallRows = rows.filter((r) => r.hallId === hall.id);
        return (
          <section className="hall-block" key={hall.id}>
            <header className="hall-head">
              <h3>{hall.name}</h3>
              <span>{hall.place}</span>
            </header>
            {archive.stops
              .filter((s) => s.hallId === hall.id)
              .map((stop) => {
                const stopRows = hallRows.filter(
                  (r) => r.pipe.stopId === stop.id,
                );
                return (
                  <div className="stop-block" key={stop.id}>
                    <h4>
                      {stop.name}
                      <em>{stop.kind === "reed" ? "簧管音栓" : "哨管音栓"}</em>
                    </h4>
                    <div className="pipe-grid">
                      {stopRows.map((row) => (
                        <PipeCard
                          key={row.pipe.id}
                          row={row}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </section>
        );
      })}
      <details className="spec-note">
        <summary>材质温漂参数（判定依据）</summary>
        <ul>
          {Object.values(MATERIALS).map((m) => (
            <li key={m.key}>
              <b>{m.label}</b>：{m.note}
            </li>
          ))}
          <li>
            折算公式：20℃偏差 = 实测偏差 −（实测气温 − {20}）× 材质温漂系数；
            气温须在 {TEMP_MIN}–{TEMP_MAX}℃ 内，|折算偏差| ≤ 15 音分判通过。
          </li>
        </ul>
      </details>
    </div>
  );
}

function PipeCard({ row }: { row: PipeRow }) {
  const { pipe, ev, lock } = row;
  const lockedPass =
    lock.kind === "active" && lock.record.verdict === "pass";
  const tempInvalid =
    pipe.temperature !== null &&
    (pipe.temperature < TEMP_MIN || pipe.temperature > TEMP_MAX);

  return (
    <article
      className={`pipe-card ${
        lock.kind === "revoked" ? "revoked" : ev.status
      }`}
    >
      <div className="pipe-card-head">
        <div>
          <b>{pipe.code}</b>
          <span>
            {pipe.noteName} · 标称 {pipe.nominalHz} Hz
          </span>
        </div>
        <VerdictBadge verdict={ev.status} />
      </div>

      <div className="pipe-fields">
        <label>
          <span>材质</span>
          <MaterialSelect
            value={pipe.material}
            onChange={(material) => updatePipe(pipe.id, { material })}
          />
        </label>
        <label>
          <span>实测音高</span>
          <NumInput
            value={pipe.measuredHz}
            suffix="Hz"
            onCommit={(measuredHz) => updatePipe(pipe.id, { measuredHz })}
          />
        </label>
        <label>
          <span>实测气温</span>
          <NumInput
            value={pipe.temperature}
            suffix="℃"
            invalid={tempInvalid}
            onCommit={(temperature) => updatePipe(pipe.id, { temperature })}
          />
        </label>
        <label>
          <span>相对湿度</span>
          <NumInput
            value={pipe.humidity}
            suffix="%"
            onCommit={(humidity) => updatePipe(pipe.id, { humidity })}
          />
        </label>
        <label className="wide">
          <span>簧片状况</span>
          <ReedSelect
            value={pipe.reed}
            onChange={(reed) => updatePipe(pipe.id, { reed })}
          />
        </label>
        <label className="wide">
          <span>检修备注</span>
          <input
            type="text"
            value={pipe.repairNote}
            onChange={(e) =>
              updatePipe(pipe.id, { repairNote: e.target.value })
            }
          />
        </label>
      </div>

      <div className="pipe-card-foot">
        <LockBadge lock={lock} />
        <button
          className="primary small"
          disabled={lockedPass}
          title={
            lockedPass
              ? "结论已锁定且资料未变，无需重复提交"
              : "按当前资料折算并锁定结论"
          }
          onClick={() => submitConclusion(pipe.id)}
        >
          {lockedPass ? "已锁定" : "提交结论"}
        </button>
      </div>
    </article>
  );
}
