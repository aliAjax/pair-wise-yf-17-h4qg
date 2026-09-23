import {
  ANOMALY_LABEL,
  REED_LABEL,
  WOOD_HUMIDITY_MAX,
  WOOD_HUMIDITY_MIN,
} from "../../domain/evaluate";
import type { PipeRow } from "../rows";
import { Badge } from "./Badge";

export function AnomaliesTab({ rows }: { rows: PipeRow[] }) {
  const flagged = rows.filter((r) => r.reasons.length > 0);

  return (
    <div className="tab-body">
      <div className="summary-line">
        <Badge tone="warn">待复核 {rows.filter((r) => r.ev.status === "review").length}</Badge>
        <Badge tone="bad">偏差超限 {rows.filter((r) => r.ev.status === "fail").length}</Badge>
        <Badge tone="info">
          簧片异常{" "}
          {rows.filter((r) => r.ev.anomalies.includes("reed")).length}
        </Badge>
        <Badge tone="info">
          湿度警戒{" "}
          {rows.filter((r) => r.ev.anomalies.includes("woodHumidity")).length}
        </Badge>
        <Badge tone="bad">
          锁定后退出通过 {rows.filter((r) => r.lock.kind === "revoked").length}
        </Badge>
      </div>

      {flagged.length === 0 ? (
        <p className="empty">当前无异常音管。</p>
      ) : (
        <div className="anomaly-list">
          {flagged.map((r) => (
            <article
              key={r.pipe.id}
              className={r.lock.kind === "revoked" ? "anomaly-card revoked" : "anomaly-card"}
            >
              <div className="anomaly-top">
                <div>
                  <b>{r.pipe.code}</b>
                  <span>
                    {r.hallName} · {r.stopName} · {r.pipe.noteName}
                  </span>
                </div>
                <div className="tag-row">
                  {r.ev.reviewReasons.map((reason) => (
                    <Badge key={reason} tone="warn">
                      {reason}
                    </Badge>
                  ))}
                  {r.ev.anomalies.map((a) => (
                    <Badge
                      key={a}
                      tone={a === "sharp" || a === "flat" ? "bad" : "info"}
                    >
                      {ANOMALY_LABEL[a]}
                    </Badge>
                  ))}
                  {r.lock.kind === "revoked" && (
                    <Badge tone="bad">已退出通过</Badge>
                  )}
                </div>
              </div>
              <dl className="anomaly-detail">
                <div>
                  <dt>簧片</dt>
                  <dd>{REED_LABEL[r.pipe.reed]}</dd>
                </div>
                <div>
                  <dt>温湿度</dt>
                  <dd>
                    {r.pipe.temperature ?? "缺测"}℃ / {r.pipe.humidity ?? "缺测"}%
                    {r.ev.anomalies.includes("woodHumidity") && (
                      <small>
                        （木管建议 {WOOD_HUMIDITY_MIN}–{WOOD_HUMIDITY_MAX}%）
                      </small>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>检修备注</dt>
                  <dd>{r.pipe.repairNote || "无"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
