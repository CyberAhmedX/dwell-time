// Checking a written incident report for the facts it must carry. A report is
// prose, so each fact is a set of patterns: any one of them counts. The check
// is generous about wording and strict about substance.

export interface ReportFact {
  label: string; // what the reader needs, shown as a checklist after
  any: string[]; // regular expression sources, matched case-insensitively
}

export interface ReportGrade {
  ok: boolean;
  words: number;
  covered: boolean[]; // one per fact
}

export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w)).length;
}

export function checkReport(text: string, facts: readonly ReportFact[], minWords: number): ReportGrade {
  const words = countWords(text);
  const covered = facts.map((f) => f.any.some((p) => new RegExp(p, "i").test(text)));
  return { ok: words >= minWords && covered.every(Boolean), words, covered };
}
