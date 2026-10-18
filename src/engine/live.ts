import type { Ticket } from "./types";
import { type SaveData, hasFlag } from "./state";

// Live cases run against a clock. Relaxed timers double it. Crossing the line
// in chapter four halves it, because the attacker comes in through the door
// you opened: still winnable, much harder.

/** Set by every team's chapter four temptation, if you give in to it. */
export const CROSSED_LINE = "crossed_line";

export function liveSeconds(t: Ticket, s: SaveData, relaxed: boolean): number {
  let n = t.live?.seconds ?? 0;
  if (relaxed) n *= 2;
  if (hasFlag(s, CROSSED_LINE)) n = Math.ceil(n / 2);
  return n;
}
