// CVSS v3.1 base scores, computed the way the FIRST specification does, so a
// score here is the score the official calculator gives. A pentester rates a
// finding by answering eight questions about it; the vector records the
// answers, like AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N.

export type Metric = "AV" | "AC" | "PR" | "UI" | "S" | "C" | "I" | "A";

export const METRICS: Metric[] = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"];

export interface MetricInfo {
  name: string;
  question: string;
  values: { v: string; label: string }[];
}

export const METRIC_INFO: Record<Metric, MetricInfo> = {
  AV: {
    name: "Attack Vector",
    question: "From where can the attacker reach it?",
    values: [
      { v: "N", label: "Network" },
      { v: "A", label: "Adjacent" },
      { v: "L", label: "Local" },
      { v: "P", label: "Physical" },
    ],
  },
  AC: {
    name: "Attack Complexity",
    question: "Does it need special conditions outside the attacker's control?",
    values: [
      { v: "L", label: "Low" },
      { v: "H", label: "High" },
    ],
  },
  PR: {
    name: "Privileges Required",
    question: "What access must the attacker already have?",
    values: [
      { v: "N", label: "None" },
      { v: "L", label: "Low" },
      { v: "H", label: "High" },
    ],
  },
  UI: {
    name: "User Interaction",
    question: "Does a victim have to do something?",
    values: [
      { v: "N", label: "None" },
      { v: "R", label: "Required" },
    ],
  },
  S: {
    name: "Scope",
    question: "Can it affect things beyond the vulnerable component?",
    values: [
      { v: "U", label: "Unchanged" },
      { v: "C", label: "Changed" },
    ],
  },
  C: {
    name: "Confidentiality",
    question: "How much can the attacker read?",
    values: [
      { v: "N", label: "None" },
      { v: "L", label: "Low" },
      { v: "H", label: "High" },
    ],
  },
  I: {
    name: "Integrity",
    question: "How much can the attacker change?",
    values: [
      { v: "N", label: "None" },
      { v: "L", label: "Low" },
      { v: "H", label: "High" },
    ],
  },
  A: {
    name: "Availability",
    question: "How much can the attacker knock over?",
    values: [
      { v: "N", label: "None" },
      { v: "L", label: "Low" },
      { v: "H", label: "High" },
    ],
  },
};

export type Vector = Record<Metric, string>;

export class CvssError extends Error {}

/** Parse AV:N/AC:L/... (an optional CVSS:3.1/ prefix is allowed). Every metric must be present once. */
export function parseVector(text: string): Vector {
  const parts = text.trim().replace(/^CVSS:3\.[01]\//, "").split("/");
  const out: Partial<Vector> = {};
  for (const p of parts) {
    const [k, v] = p.split(":");
    if (!METRICS.includes(k as Metric)) throw new CvssError(`unknown metric ${k}`);
    if (out[k as Metric] !== undefined) throw new CvssError(`${k} is given twice`);
    if (!METRIC_INFO[k as Metric].values.some((x) => x.v === v)) throw new CvssError(`${k} cannot be ${v}`);
    out[k as Metric] = v;
  }
  for (const m of METRICS) if (out[m] === undefined) throw new CvssError(`${m} is missing`);
  return out as Vector;
}

export function vectorString(v: Partial<Vector>): string {
  return METRICS.map((m) => `${m}:${v[m] ?? "?"}`).join("/");
}

const W = {
  AV: { N: 0.85, A: 0.62, L: 0.55, P: 0.2 },
  AC: { L: 0.77, H: 0.44 },
  UI: { N: 0.85, R: 0.62 },
  CIA: { H: 0.56, L: 0.22, N: 0 },
} as const;

function pr(v: string, changed: boolean): number {
  if (v === "N") return 0.85;
  if (v === "L") return changed ? 0.68 : 0.62;
  return changed ? 0.5 : 0.27;
}

/** The spec's Roundup: the smallest one-decimal number not below x, without float surprises. */
export function roundUp(x: number): number {
  const i = Math.round(x * 100000);
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10;
}

export function baseScore(v: Vector): number {
  const changed = v.S === "C";
  const cia = (k: "C" | "I" | "A"): number => W.CIA[v[k] as "H" | "L" | "N"];
  const iss = 1 - (1 - cia("C")) * (1 - cia("I")) * (1 - cia("A"));
  const impact = changed ? 7.52 * (iss - 0.029) - 3.25 * Math.pow(iss - 0.02, 15) : 6.42 * iss;
  const exploit = 8.22 * W.AV[v.AV as "N"] * W.AC[v.AC as "L"] * pr(v.PR, changed) * W.UI[v.UI as "N"];
  if (impact <= 0) return 0;
  return changed ? roundUp(Math.min(1.08 * (impact + exploit), 10)) : roundUp(Math.min(impact + exploit, 10));
}

export function severity(score: number): "None" | "Low" | "Medium" | "High" | "Critical" {
  if (score === 0) return "None";
  if (score < 4) return "Low";
  if (score < 7) return "Medium";
  if (score < 9) return "High";
  return "Critical";
}
