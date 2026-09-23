import { useState } from "react";
import type { ArchiveState } from "../../archive/types";
import { addEnvReading } from "../../archive/store";
import { TEMP_MAX, TEMP_MIN } from "../../domain/evaluate";
import { formatDateTime } from "../rows";
import { Badge } from "./Badge";

export function EnvironmentTab({ archive }: { archive: ArchiveState }) {
  const [hallId, setHallId] = useState(archive.halls[0]?.id ?? "");
  const [temperature, setTemperature] = useState<string>("");
  const [humidity, setHumidity] = useState<string>("");
  const [note, setNote] = useState("");

  const t = temperature === "" ? null : Number(temperature);
  const h = humidity === "" ? null : Number(humidity);
  const canSubmit =
    hallId !== "" &&
    t !== null &&
    Number.isFinite(t) &&
    h !== null &&
    Number.isFinite(h);

  return (
    <div className="tab-body env-layout">
      <section className="panel-ish">
        <h3>新增环境记录</h3>
        <div className="env-form">
          <label>
            <span>厅堂</span>
            <select
              value={hallId}
              onChange={(e) => setHallId(e.target.value)}
            >
              {archive.halls.map((hall) => (
                <option key={hall.id} value={hall.id}>
                  {hall.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>气温 ℃（须 {TEMP_MIN}–{TEMP_MAX}℃ 才可判定）</span>
            <input
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              placeholder="如 21.5"
            />
          </label>
          <label>
            <span>相对湿度 %</span>
            <input
              type="number"
              step="1"
              value={humidity}
              onChange={(e) => setHumidity(e.target.value)}
              placeholder="如 52"
            />
          </label>
          <label className="wide">
            <span>备注</span>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="如 空调启停、西晒、恒湿柜运行"
            />
          </label>
        </div>
        <button
          className="primary"
          disabled={!canSubmit}
          onClick={() => {
            if (!canSubmit || t === null || h === null) return;
            addEnvReading({ hallId, temperature: t, humidity: h, note });
            setTemperature("");
            setHumidity("");
            setNote("");
          }}
        >
          记入环境档案
        </button>
      </section>

      <section className="panel-ish">
        <h3>环境记录（本地存档）</h3>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>厅堂</th>
                <th>气温</th>
                <th>湿度</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              {archive.envLog
                .slice()
                .sort((a, b) => (a.at < b.at ? 1 : -1))
                .map((e) => {
                  const hall = archive.halls.find((x) => x.id === e.hallId);
                  const outOfRange =
                    e.temperature < TEMP_MIN || e.temperature > TEMP_MAX;
                  return (
                    <tr key={e.id}>
                      <td className="mono">{formatDateTime(e.at)}</td>
                      <td>{hall?.name ?? e.hallId}</td>
                      <td className="mono">
                        {e.temperature}℃{" "}
                        {outOfRange && <Badge tone="bad">越窗</Badge>}
                      </td>
                      <td className="mono">{e.humidity}%</td>
                      <td>{e.note || "—"}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
