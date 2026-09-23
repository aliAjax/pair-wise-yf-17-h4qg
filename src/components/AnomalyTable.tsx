// 展示模块：异常表（锁定时固化的异常 + 锁定后退出通过的记录）

import type { Archive, Hall, Stop } from "../types";
import { ANOMALY_LABEL, LEVEL_LABEL, Empty } from "./ui";

interface Props {
  archive: Archive;
  halls: Hall[];
  stops: Stop[];
}

export default function AnomalyTable({ archive, halls, stops }: Props) {
  const hallName = (id: string) =>
    halls.find((h) => h.id === id)?.name ?? "—";
  const stopName = (id: string) =>
    stops.find((s) => s.id === id)?.name ?? "—";

  const anomalies = [...archive.anomalies].reverse();

  return (
    <section className="panel" id="anomalies">
      <div className="heading">
        <div>
          <p>异常表</p>
          <h2>异常音管标记与退出通过记录</h2>
        </div>
        <span className="muted">共 {archive.anomalies.length} 条</span>
      </div>

      {anomalies.length === 0 ? (
        <Empty text="暂无异常；提交结论后超限、越界、缺资料与簧片问题会固化在此。" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>时间</th>
                <th>来源批次</th>
                <th>音管</th>
                <th>厅堂/音栓</th>
                <th>类型</th>
                <th>级别</th>
                <th>说明</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => (
                <tr key={a.id} className={`level-${a.level}`}>
                  <td className="nowrap">{a.createdAt}</td>
                  <td>{a.batchId ?? "锁定后追加"}</td>
                  <td>{a.pipeCode}</td>
                  <td>
                    {a.hallId ? hallName(a.hallId) : "—"} / {stopName(a.stopId)}
                  </td>
                  <td>{ANOMALY_LABEL[a.kind]}</td>
                  <td>
                    <span className={`badge ${a.level}`}>{LEVEL_LABEL[a.level]}</span>
                  </td>
                  <td>{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="sub">退出通过记录（历史结论不回改）</h3>
      {archive.withdrawals.length === 0 ? (
        <Empty text="结论锁定后若改动材质、气温或测值，相关音管将在此退出通过。" />
      ) : (
        <ul className="withdrawals">
          {[...archive.withdrawals].reverse().map((w) => (
            <li key={`${w.fromBatchId}-${w.pipeId}`}>
              <strong>{w.pipeCode}</strong>
              <span className="nowrap">{w.createdAt}</span>
              <span>{w.reason}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
