import type { ArchiveState, ConclusionRecord, Pipe } from "./types";
import { evaluate, fingerprint, formatCents } from "../domain/evaluate";

export const ARCHIVE_VERSION = 1;

const hallA = "hall-a";
const hallB = "hall-b";
const sPrincipal = "s-principal";
const sTrumpet = "s-trumpet";
const sBourdon = "s-bourdon";

const seedPipes: Pipe[] = [
  {
    id: "p1",
    code: "PR-08-C4",
    hallId: hallA,
    stopId: sPrincipal,
    noteName: "C4",
    nominalHz: 261.63,
    material: "tin",
    measuredHz: 262.9,
    temperature: 22.4,
    humidity: 52,
    reed: "none",
    repairNote: "例行季检，音色稳定",
  },
  {
    id: "p2",
    code: "PR-08-E4",
    hallId: hallA,
    stopId: sPrincipal,
    noteName: "E4",
    nominalHz: 329.63,
    material: "tin",
    measuredHz: 334.9,
    temperature: 24.1,
    humidity: 49,
    reed: "none",
    repairNote: "音头偏锐，待下调音",
  },
  {
    id: "p3",
    code: "PR-08-G4",
    hallId: hallA,
    stopId: sPrincipal,
    noteName: "G4",
    nominalHz: 392.0,
    material: "lead",
    measuredHz: 389.2,
    temperature: 23.6,
    humidity: 51,
    reed: "none",
    repairNote: "上次移动调音片后偏低，等待恒温复测",
  },
  {
    id: "p4",
    code: "PR-08-A4",
    hallId: hallA,
    stopId: sPrincipal,
    noteName: "A4",
    nominalHz: 440.0,
    material: "",
    measuredHz: 442.1,
    temperature: 21.8,
    humidity: 50,
    reed: "none",
    repairNote: "新换管段，材质铭牌脱落待确认",
  },
  {
    id: "p5",
    code: "TR-08-C5",
    hallId: hallA,
    stopId: sTrumpet,
    noteName: "C5",
    nominalHz: 523.25,
    material: "tin",
    measuredHz: 525.9,
    temperature: 22.9,
    humidity: 53,
    reed: "bent",
    repairNote: "强奏时有杂音，簧舌弧度待校正",
  },
  {
    id: "p6",
    code: "TR-08-D5",
    hallId: hallA,
    stopId: sTrumpet,
    noteName: "D5",
    nominalHz: 587.33,
    material: "lead",
    measuredHz: 589.0,
    temperature: 36.4,
    humidity: 48,
    reed: "good",
    repairNote: "午后西晒升温，改约晨间复测",
  },
  {
    id: "p7",
    code: "BD-16-C3",
    hallId: hallB,
    stopId: sBourdon,
    noteName: "C3",
    nominalHz: 130.81,
    material: "wood",
    measuredHz: 130.6,
    temperature: 19.2,
    humidity: 55,
    reed: "none",
    repairNote: "木塞轻微漏气已涂蜂蜡",
  },
  {
    id: "p8",
    code: "BD-16-F2",
    hallId: hallB,
    stopId: sBourdon,
    noteName: "F2",
    nominalHz: 87.31,
    material: "wood",
    measuredHz: 86.45,
    temperature: 26.8,
    humidity: 72,
    reed: "none",
    repairNote: "梅雨季管体受潮，先恒湿养护再复测",
  },
];

function lockRecord(
  pipe: Pipe,
  at: string,
  id: string,
): ConclusionRecord {
  const ev = evaluate(pipe);
  let reason: string;
  if (ev.status === "review") {
    reason = `留待复核：${ev.reviewReasons.join("、")}`;
  } else {
    const dev = formatCents(ev.devCents20);
    const drift = formatCents(ev.driftCents);
    const measured = formatCents(ev.measuredCents);
    reason =
      ev.status === "pass"
        ? `实测偏差 ${measured} 音分，${pipe.temperature}℃温漂修正 ${drift} 音分，折算20℃偏差 ${dev} 音分，门限±15内`
        : `实测偏差 ${measured} 音分，${pipe.temperature}℃温漂修正 ${drift} 音分，折算20℃偏差 ${dev} 音分，超出±15门限`;
  }
  return {
    id,
    pipeId: pipe.id,
    at,
    verdict: ev.status,
    reason,
    material: pipe.material,
    temperature: pipe.temperature,
    humidity: pipe.humidity,
    measuredHz: pipe.measuredHz,
    measuredCents: ev.measuredCents === null ? null : Math.round(ev.measuredCents * 10) / 10,
    devCents20: ev.devCents20 === null ? null : Math.round(ev.devCents20 * 10) / 10,
    fingerprint: fingerprint(pipe),
  };
}

export function buildSeed(): ArchiveState {
  // p3 的历史通过结论：锁定时测值为 391.0Hz，后来改测为 389.2Hz → 已退出通过
  const p3AtLock: Pipe = { ...seedPipes[2], measuredHz: 391.0 };

  return {
    version: ARCHIVE_VERSION,
    archivedAt: "2026-09-23T09:40:00",
    halls: [
      { id: hallA, name: "圣玛丽大教堂", place: "教堂 · 东区" },
      { id: hallB, name: "城市音乐厅 A 厅", place: "音乐厅 · 三层" },
    ],
    stops: [
      { id: sPrincipal, hallId: hallA, name: "Principal 8′ 主音栓", kind: "flue" },
      { id: sTrumpet, hallId: hallA, name: "Trumpet 8′ 簧片音栓", kind: "reed" },
      { id: sBourdon, hallId: hallB, name: "Bourdon 16′ 低音木管", kind: "flue" },
    ],
    pipes: seedPipes,
    envLog: [
      {
        id: "e1",
        hallId: hallA,
        at: "2026-09-23T09:00:00",
        temperature: 22.4,
        humidity: 52,
        note: "开台前环境记录",
      },
      {
        id: "e2",
        hallId: hallA,
        at: "2026-09-20T15:30:00",
        temperature: 24.1,
        humidity: 49,
        note: "午后西晒，温度爬升",
      },
      {
        id: "e3",
        hallId: hallB,
        at: "2026-09-23T09:30:00",
        temperature: 20.6,
        humidity: 58,
        note: "中央空调恒湿运行中",
      },
    ],
    conclusions: [
      lockRecord(seedPipes[0], "2026-09-12T11:02:00", "c1"),
      lockRecord(p3AtLock, "2026-09-12T11:20:00", "c2"),
    ],
    maintenance: {
      p3: {
        status: "doing",
        note: "调音片已拆下，等管体恒温 20℃ 后复测",
        updatedAt: "2026-09-21T10:05:00",
      },
    },
  };
}
