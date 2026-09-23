// 展示模块：维护单（每次提交生成一张单次维护单）

import type { Archive, Hall, Stop } from "../types";
import { Empty } from "./ui";

interface Props {
  archive: Archive;
  halls: Hall[];
  stops: Stop[];
}

export default function Maintenance({ archive, halls, stops }: Props) {
  const orders = [...archive.maintenanceOrders].reverse();
  const hallName = (id: string) => halls.find((h) => h.id === id)?.name ?? "—";
  const stopName = (id: string) => stops.find((s) => s.id === id)?.name ?? "—";

  return (
    <section className="panel" id="maintenance">
      <div className="heading">
        <div>
          <p>维护单</p>
          <h2>单次维护报告</h2>
        </div>
        <span className="muted">共 {orders.length} 张</span>
      </div>

      {orders.length === 0 ? (
        <Empty text="提交结论后自动生成维护单：列出不通过、待复核与簧片异常音管。" />
      ) : (
        <div className="orders">
          {orders.map((o) => (
            <article key={o.id} className="order">
              <header>
                <h3>{o.title}</h3>
                <span className="tag">{o.items.length} 项处置</span>
              </header>
              {o.items.length === 0 ? (
                <p className="muted">本批全部通过，无需处置项。</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>音管</th>
                        <th>厅堂 / 音栓</th>
                        <th>处置建议</th>
                        <th>依据</th>
                      </tr>
                    </thead>
                    <tbody>
                      {o.items.map((it) => (
                        <tr key={it.pipeId}>
                          <td>{it.pipeCode}</td>
                          <td>
                            {hallName(it.hallId)} / {stopName(it.stopId)}
                          </td>
                          <td className="action">{it.action}</td>
                          <td className="muted">{it.reasons.join("；")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
