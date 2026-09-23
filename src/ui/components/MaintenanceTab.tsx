import type { ArchiveState, MaintenanceStatus } from "../../archive/types";
import { setMaintenance } from "../../archive/store";
import { formatDateTime } from "../rows";
import type { PipeRow } from "../rows";
import { Badge } from "./Badge";

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  open: "待处理",
  doing: "处理中",
  done: "已完成",
};

export function MaintenanceTab({
  archive,
  rows,
}: {
  archive: ArchiveState;
  rows: PipeRow[];
}) {
  const workRows = rows.filter((r) => r.needsWork);

  return (
    <div className="tab-body">
      <div className="hint-bar">
        维护单与偏差表、异常表、环境记录共用本地存档。状态与处理备注按音管独立保存；
        待处理 {workRows.filter((r) => (archive.maintenance[r.pipe.id]?.status ?? "open") === "open").length} 项 ·
        处理中 {workRows.filter((r) => archive.maintenance[r.pipe.id]?.status === "doing").length} 项 ·
        已完成 {workRows.filter((r) => archive.maintenance[r.pipe.id]?.status === "done").length} 项。
      </div>

      {workRows.length === 0 ? (
        <p className="empty">暂无需维护音管。</p>
      ) : (
        <div className="maint-list">
          {workRows.map((r) => {
            const state = archive.maintenance[r.pipe.id] ?? {
              status: "open" as MaintenanceStatus,
              note: "",
              updatedAt: "",
            };
            return (
              <article
                key={r.pipe.id}
                className={`maint-card status-${state.status}`}
              >
                <div className="maint-head">
                  <div>
                    <b>{r.pipe.code}</b>
                    <span>
                      {r.hallName} · {r.stopName} · {r.pipe.noteName}
                    </span>
                  </div>
                  <div className="tag-row">
                    {r.reasons.map((reason, i) => (
                      <Badge
                        key={`${reason}-${i}`}
                        tone={reason.includes("退出通过") ? "bad" : "warn"}
                      >
                        {reason}
                      </Badge>
                    ))}
                  </div>
                </div>
                <p className="maint-action">
                  <span>建议作业：</span>
                  {r.action}
                </p>
                <div className="maint-controls">
                  <label>
                    <span>单据状态</span>
                    <select
                      value={state.status}
                      onChange={(e) =>
                        setMaintenance(r.pipe.id, {
                          status: e.target.value as MaintenanceStatus,
                        })
                      }
                    >
                      {(Object.keys(STATUS_LABEL) as MaintenanceStatus[]).map(
                        (s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="grow">
                    <span>处理记录</span>
                    <input
                      type="text"
                      value={state.note}
                      placeholder="记录本次检修动作与复测安排"
                      onChange={(e) =>
                        setMaintenance(r.pipe.id, { note: e.target.value })
                      }
                    />
                  </label>
                  {state.updatedAt && (
                    <span className="maint-updated">
                      更新于 {formatDateTime(state.updatedAt)}
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
