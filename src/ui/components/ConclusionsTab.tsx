import type { ArchiveState, ConclusionRecord } from "../../archive/types";
import {
  MATERIAL_LABEL,
  VERDICT_LABEL,
  fingerprint,
} from "../../domain/evaluate";
import { formatDateTime } from "../rows";
import { Badge } from "./Badge";

export function ConclusionsTab({ archive }: { archive: ArchiveState }) {
  const sorted = archive.conclusions
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  // 每支音管最新一条结论 id
  const latestByPipe = new Map<string, string>();
  for (const c of sorted) {
    if (!latestByPipe.has(c.pipeId)) latestByPipe.set(c.pipeId, c.id);
  }

  const pipeById = new Map(archive.pipes.map((p) => [p.id, p]));
  const stopById = new Map(archive.stops.map((s) => [s.id, s]));
  const hallById = new Map(archive.halls.map((h) => [h.id, h]));

  const revokedPassCount = sorted.filter((c) => {
    const pipe = pipeById.get(c.pipeId);
    return (
      c.verdict === "pass" &&
      latestByPipe.get(c.pipeId) === c.id &&
      !!pipe &&
      c.fingerprint !== fingerprint(pipe)
    );
  }).length;

  return (
    <div className="tab-body">
      <div className="summary-line">
        <Badge tone="neutral">归档结论 {sorted.length} 条</Badge>
        <Badge tone="ok">
          当前有效通过{" "}
          {
            sorted.filter((c) => {
              const pipe = pipeById.get(c.pipeId);
              return (
                c.verdict === "pass" &&
                latestByPipe.get(c.pipeId) === c.id &&
                pipe &&
                c.fingerprint === fingerprint(pipe)
              );
            }).length
          }
          {" "}
        </Badge>
        <Badge tone="bad">退出通过 {revokedPassCount}</Badge>
        <Badge tone="warn">
          留待复核{" "}
          {
            sorted.filter(
              (c) =>
                c.verdict === "review" && latestByPipe.get(c.pipeId) === c.id,
            ).length
          }
        </Badge>
      </div>

      <div className="hint-bar">
        档案只追加、不修改。锁定后若调整材质 / 气温 / 实测音高，相关音管仅退出当前通过，
        下列历史结论的文字、测值与时间均保持原样。
      </div>

      {sorted.length === 0 ? (
        <p className="empty">尚无提交的结论。</p>
      ) : (
        <div className="conclusion-list">
          {sorted.map((c) => (
            <ConclusionItem
              key={c.id}
              record={c}
              isLatest={latestByPipe.get(c.pipeId) === c.id}
              archive={archive}
              pipeName={(() => {
                const pipe = pipeById.get(c.pipeId);
                if (!pipe) return c.pipeId;
                const stop = stopById.get(pipe.stopId);
                const hall = hallById.get(pipe.hallId);
                return `${hall?.name ?? ""} · ${stop?.name ?? ""} · ${pipe.code}`;
              })()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConclusionItem({
  record,
  isLatest,
  archive,
  pipeName,
}: {
  record: ConclusionRecord;
  isLatest: boolean;
  archive: ArchiveState;
  pipeName: string;
}) {
  const pipe = archive.pipes.find((p) => p.id === record.pipeId);
  const revoked =
    isLatest &&
    record.verdict === "pass" &&
    !!pipe &&
    record.fingerprint !== fingerprint(pipe);

  return (
    <article
      className={`conclusion-card verdict-${record.verdict} ${
        revoked ? "revoked" : ""
      } ${isLatest ? "" : "superseded"}`}
    >
      <header>
        <div>
          <b>{pipeName}</b>
          <span className="mono time">{formatDateTime(record.at)} 锁定</span>
        </div>
        <div className="tag-row">
          <Badge
            tone={
              record.verdict === "pass"
                ? "ok"
                : record.verdict === "fail"
                  ? "bad"
                  : "warn"
            }
          >
            {VERDICT_LABEL[record.verdict]}
          </Badge>
          {revoked && <Badge tone="bad">已退出通过（历史不动）</Badge>}
          {!isLatest && <Badge tone="neutral">历史记录</Badge>}
        </div>
      </header>
      <p className="conclusion-reason">{record.reason}</p>
      <footer>
        <span>快照材质：{MATERIAL_LABEL[record.material]}</span>
        <span>快照气温：{record.temperature ?? "缺测"}℃</span>
        <span>快照湿度：{record.humidity ?? "缺测"}%</span>
        <span>快照测值：{record.measuredHz ?? "缺测"} Hz</span>
        <span className="mono">指纹 {record.fingerprint}</span>
      </footer>
    </article>
  );
}
