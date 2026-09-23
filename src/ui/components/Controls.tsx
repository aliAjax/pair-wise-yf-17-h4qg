import type { MaterialOrEmpty, ReedCondition } from "../../archive/types";
import { MATERIALS, REED_LABEL } from "../../domain/evaluate";

export function parseNum(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function MaterialSelect({
  value,
  onChange,
  disabled,
}: {
  value: MaterialOrEmpty;
  onChange: (m: MaterialOrEmpty) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className={`cell-select ${value === "" ? "missing" : ""}`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as MaterialOrEmpty)}
    >
      <option value="">待确认</option>
      {Object.values(MATERIALS).map((m) => (
        <option key={m.key} value={m.key}>
          {m.label}
        </option>
      ))}
    </select>
  );
}

export function ReedSelect({
  value,
  onChange,
  disabled,
}: {
  value: ReedCondition;
  onChange: (r: ReedCondition) => void;
  disabled?: boolean;
}) {
  const keys: ReedCondition[] = ["none", "good", "worn", "bent", "replace"];
  return (
    <select
      className={`cell-select ${
        value === "worn" || value === "bent" || value === "replace"
          ? "missing"
          : ""
      }`}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as ReedCondition)}
    >
      {keys.map((k) => (
        <option key={k} value={k}>
          {REED_LABEL[k]}
        </option>
      ))}
    </select>
  );
}

export function NumInput({
  value,
  onCommit,
  step,
  placeholder = "缺测",
  suffix,
  invalid,
  disabled,
}: {
  value: number | null;
  onCommit: (n: number | null) => void;
  step?: string;
  placeholder?: string;
  suffix?: string;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <span className={`num-input ${invalid ? "invalid" : ""}`}>
      <input
        type="number"
        step={step ?? "any"}
        value={value === null ? "" : value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onCommit(parseNum(e.target.value))}
      />
      {suffix ? <em>{suffix}</em> : null}
    </span>
  );
}
