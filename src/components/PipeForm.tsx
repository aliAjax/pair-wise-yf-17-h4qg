// 展示模块：音管档案与实测录入（八支音管，按音栓分组）

import type { Hall, Material, Pipe, ReedStatus, Stop, WithdrawalRecord } from "../types";
import {
  MATERIAL_LABEL,
  REED_LABEL,
  judgePipe,
  signatureOf,
} from "../modules/judge";
import { Badge, fmt, fmtSigned } from "./ui";

interface Props {
  pipes: Pipe[];
  stops: Stop[];
  halls: Hall[];
  onChange: (id: string, field: keyof Pipe, value: string) => void;
  lockSignatures: Record<string, string>;
  withdrawals: WithdrawalRecord[];
}

const MATERIALS: Material[] = ["tin", "lead", "wood"];
const REEDS: ReedStatus[] = ["none", "normal", "warn", "bad"];

export default function PipeForm({
  pipes,
  stops,
  halls,
  onChange,
  lockSignatures,
  withdrawals,
}: Props) {
  const hallById = new Map(halls.map((h) => [h.id, h]));
  const withdrawnPipeIds = new Set(withdrawals.map((w) => w.pipeId));

  return (
    <section className="panel" id="pipes">
      <div className="heading">
        <div>
          <p>音管档案</p>
          <h2>八支音管 · 实测录入</h2>
        </div>
        <p className="hint">
          材质 / 气温 / 实测音高在结论锁定后改动，会使该管退出通过（历史不动）
        </p>
      </div>

      <div className="pipe-groups">
        {stops.map((stop) => {
          const hall = hallById.get(stop.hallId);
          const group = pipes.filter((p) => p.stopId === stop.id);
          return (
            <div key={stop.id} className="pipe-group">
              <header>
                <h3>{stop.name}</h3>
                <span className="tag">
                  {hall?.name} · {stop.kind} · {group.length} 支
                </span>
              </header>
              <div className="pipe-cards">
                {group.map((p) => {
                  const r = judgePipe(p);
                  const locked = lockSignatures[p.id];
                  const drifted =
                    locked !== undefined && signatureOf(p) !== locked;
                  return (
                    <article
                      key={p.id}
                      className={`pipe-card${drifted ? " drifted" : ""}`}
                    >
                      <div className="pipe-card-head">
                        <div>
                          <strong>{p.code}</strong>
                          <span className="tag">
                            {p.note} · 名义 {p.nominalHz} Hz
                          </span>
                        </div>
                        <Badge verdict={r.verdict} />
                      </div>

                      {locked && (
                        <p
                          className={
                            drifted ? "lock-flag out" : "lock-flag locked"
                          }
                        >
                          {drifted
                            ? "已退出通过：锁定后改动过材质/气温/测值"
                            : "结论已锁定"}
                        </p>
                      )}
                      {!locked && withdrawnPipeIds.has(p.id) && (
                        <p className="lock-flag out">曾在历史批次退出通过</p>
                      )}

                      <div className="pipe-grid">
                        <label>
                          <span>材质</span>
                          <select
                            value={p.material}
                            onChange={(e) =>
                              onChange(p.id, "material", e.target.value)
                            }
                          >
                            {MATERIALS.map((m) => (
                              <option key={m} value={m}>
                                {MATERIAL_LABEL[m]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>实测音高 (Hz)</span>
                          <input
                            value={p.measuredHz}
                            inputMode="decimal"
                            placeholder="待测量"
                            onChange={(e) =>
                              onChange(p.id, "measuredHz", e.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>气温 (℃)</span>
                          <input
                            value={p.tempC}
                            inputMode="decimal"
                            placeholder="5–35"
                            onChange={(e) =>
                              onChange(p.id, "tempC", e.target.value)
                            }
                          />
                        </label>
                        <label>
                          <span>湿度 (%)</span>
                          <input
                            value={p.humidityPct}
                            inputMode="decimal"
                            placeholder="相对湿度"
                            onChange={(e) =>
                              onChange(p.id, "humidityPct", e.target.value)
                            }
                          />
                        </label>
                        <label className="wide">
                          <span>簧片状况</span>
                          <select
                            value={p.reed}
                            onChange={(e) =>
                              onChange(p.id, "reed", e.target.value)
                            }
                          >
                            {REEDS.map((r2) => (
                              <option key={r2} value={r2}>
                                {REED_LABEL[r2]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="wide">
                          <span>检修备注</span>
                          <textarea
                            rows={2}
                            value={p.noteText}
                            onChange={(e) =>
                              onChange(p.id, "noteText", e.target.value)
                            }
                          />
                        </label>
                      </div>

                      <div className="live-result">
                        <span>
                          原始偏差 <b>{fmtSigned(r.rawCents)}</b> 音分
                        </span>
                        <span>
                          20℃折算 <b>{fmt(r.correctedHz, 2)}</b> Hz
                        </span>
                        <span>
                          折算偏差{" "}
                          <b
                            className={
                              r.verdict === "fail"
                                ? "num-fail"
                                : r.verdict === "pass"
                                ? "num-pass"
                                : ""
                            }
                          >
                            {fmtSigned(r.deviationCents)}
                          </b>{" "}
                          音分
                        </span>
                      </div>
                      <p className="reasons">{r.reasons.join("；")}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
