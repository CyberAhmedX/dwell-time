import type { Evidence } from "./types";
import { runLine } from "./shell";
import { search, resultText, SiemError } from "./siem";
import { lookup } from "./pivot";

/** Run a typed question's example command or search against its evidence, as text. */
export function runSolution(ev: Evidence, command: string): { out: string; error: boolean } {
  if (ev.kind === "terminal") {
    const r = runLine(command, ev.files);
    return { out: r.out, error: !!r.error };
  }
  if (ev.kind === "siem") {
    try {
      return { out: resultText(search(command, ev.events, ev.fields)), error: false };
    } catch (e) {
      if (e instanceof SiemError) return { out: e.message, error: true };
      throw e;
    }
  }
  if (ev.kind === "pivot") {
    const hits = lookup(ev.db, command);
    if (!hits.length) return { out: `No records for ${command}.`, error: false };
    return { out: hits.map((r) => `${r.domain}  ${r.ip}  ${r.firstSeen} to ${r.lastSeen}${r.note ? `  ${r.note}` : ""}`).join("\n"), error: false };
  }
  return { out: `${ev.id} is not something you can run commands on`, error: true };
}
