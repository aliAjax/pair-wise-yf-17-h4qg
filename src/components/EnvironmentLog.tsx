// 展示模块：环境记录（每次提交按厅堂固化温湿度快照）

import type { Archive, Hall } from "../types";
import { Empty, fmt } from "./ui";

interface Props {
  archive: Archive;
  halls: Hall[];
}

const STATUS_LABEL = {
  ok: "区间正常",
  outOfRange: "气温越界",
  missing: "资料缺失",
} as const;

export default function EnvironmentLog({ archive, halls }: Props) {
  const logs = [...archive.environmentLogs].reverse();
  const hallName = (id: string) => halls.find((h) => h.id === id)?.name ?? id;

  return (
    <section className="panel" id="environment">
      <div className="heading">
        <div>
          <p>环境记录</p>
          <h2>温湿度存档</h2>
        </div>
        <span className="muted">
          可判定气温区间 5–35℃，超出则对应音管只留待复核
        </span>
      </div>

      {logs.length === 0 ? (
        <Empty text="尚无环境记录，随结论提交一并固化。" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>记录时间</th>
                <th>批次</th>
                <th>厅堂</th>
                <th>气温 (℃)</th>
                <th>湿度 (%)</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((e) => (
                <tr key={e.id} className={`env-${e.status}`}>
                  <td className="nowrap">{e.measuredAt}</td>
                  <td>{e.batchId ?? "—"}</td>
                  <td>{hallName(e.hallId)}</td>
                  <td>{fmt(e.tempC, 1)}</td>
                  <td>{fmt(e.humidityPct, 0)}</td>
                  <td>
                    <span className={`badge env-badge ${e.status}`}>
                      {STATUS_LABEL[e.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
