import { search, SiemError, type SiemEvent } from "./siem";

// Testing a detection rule, the way a SOC does before shipping one: run it over
// a replay of known traffic, where each event is marked as something the rule
// should alert on or stay quiet about. A good rule catches every attack and
// raises no false alarms. The rule is an ordinary SIEM search.

export interface TestEvent {
  event: SiemEvent;
  want: "alert" | "quiet";
  what: string; // what this event is, in plain words
}

export interface RuleTest {
  ok: boolean;
  caught: number[]; // indices of alert events the rule matched
  missed: number[]; // alert events it did not match
  falseAlarms: number[]; // quiet events it matched
  error?: string;
}

const ID = "_test_id";

export function testRule(rule: string, tests: readonly TestEvent[]): RuleTest {
  if (rule.includes("|")) return { ok: false, caught: [], missed: [], falseAlarms: [], error: "a detection rule here is one search with no | commands, so it can judge each event on its own" };
  if (rule.trim() === "" || rule.trim() === "*") return { ok: false, caught: [], missed: [], falseAlarms: [], error: "an empty rule matches everything" };
  let hits: Set<number>;
  try {
    const events = tests.map((t, i) => ({ ...t.event, [ID]: String(i) }));
    const r = search(rule, events, Object.keys(tests[0]?.event ?? {}));
    hits = new Set(r.rows.map((row) => Number(row[ID])));
  } catch (e) {
    if (!(e instanceof SiemError)) throw e;
    return { ok: false, caught: [], missed: [], falseAlarms: [], error: e.message };
  }
  const caught: number[] = [];
  const missed: number[] = [];
  const falseAlarms: number[] = [];
  tests.forEach((t, i) => {
    if (t.want === "alert") (hits.has(i) ? caught : missed).push(i);
    else if (hits.has(i)) falseAlarms.push(i);
  });
  return { ok: missed.length === 0 && falseAlarms.length === 0, caught, missed, falseAlarms };
}
