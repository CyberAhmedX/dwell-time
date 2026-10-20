import { describe, it, expect } from "vitest";
import { runLine } from "../src/engine/shell";
import { search, SiemError } from "../src/engine/siem";
import { parseRules, RuleError } from "../src/engine/firewall";
import { testRule } from "../src/engine/detect";
import { parseRequest, RequestError } from "../src/engine/webapp";

// A player can type anything into the free-text tools (terminal, SIEM, firewall
// rules, detection rules, the request editor). None of that should ever crash a
// tool: each must either work or report a friendly error, never throw something
// the UI does not catch. The e2e bot only plays the happy path, so this guards
// the unhappy one.

const BIG = "a".repeat(200000);
const NASTY = [
  "", " ", "   ", "\n", "\t\t", "\r\n", "|", "||", "| | |", "a |", "| a", "|||",
  '"', "'", "`", '"unclosed', "'unclosed", 'grep "no end', "awk '{", "echo $(rm -rf /)",
  "../../etc/passwd", "cat /etc/passwd", "rm -rf /", "<script>alert(1)</script>", "\u0000", "a\u0000b",
  "cut -f", "cut -fx", "cut -f0", "cut -f-", "cut -d", "cut -d. -f", "head -", "head -x",
  "head 999999999999999999", "tail -", "grep", "grep ", "grep -z foo", "sort -z", "uniq -z",
  "base64 -d nope", "sha256sum nope", "xxd nope", "wc -z", "awk", "echo", "defang",
  "\u{1F600} \u{1F600}", "umlaut", "null\0here", "\\\\\\", "....", "*", "?", "[", "]", "{}", "$(", "${}",
  "grep " + BIG, BIG, "| ".repeat(500), "(".repeat(500), "a=b AND ".repeat(500),
];
const SIEMY = [
  "", "|", "| stats", "stats", "| stats dc()", "| stats values()", "| stats count by",
  "| where", "| where x", "| where count >", "| sort", "| sort -", "| head", "| head x",
  "| table", "| dedup", "field=", "=value", "field=val AND", "NOT", "AND", "OR OR OR",
  "( ( (", ") ) )", "a=b)", "(a=b", "| bogus", "| stats avg(x)", BIG, "a=" + BIG, "*" + BIG,
];
const REQ = [
  "", " ", "GET", "GET /", "garbage", "GET /booking?id=1041", "GET /x HTTP/1.1\nNoColon",
  "POST /x HTTP/1.1\n: novalue", "\n\n", "HELLO world", "GET " + "/".repeat(100000) + " HTTP/1.1",
  "GET /x HTTP/1.1\n" + "X-H: v\n".repeat(5000), BIG, "GET /\u0000 HTTP/1.1", "GET /\u{1F600} HTTP/1.1",
];

function sweep(inputs: string[], call: (s: string) => void, Ok: unknown): string[] {
  const bugs: string[] = [];
  for (const s of inputs) {
    try {
      call(s);
    } catch (e) {
      if (Ok && e instanceof (Ok as new (...a: unknown[]) => Error)) continue;
      bugs.push(`${JSON.stringify(s.slice(0, 32))} -> ${(e as Error).constructor.name}: ${(e as Error).message?.slice(0, 70)}`);
    }
  }
  return bugs;
}

describe("free-text tools survive adversarial input", () => {
  const files = { "dns.log": "13:00:01\tlab-pc-07\t10.40.7.107\tx.data.s.example\tTXT\tNOERROR\n".repeat(5) };
  const events = [
    { _time: "03:12:01", src_ip: "203.0.113.77", user: "a.reyes", action: "failure", reason: "", geo: "x" },
    { _time: "03:12:02", src_ip: "198.51.100.5", user: "b.osei", action: "success", reason: "", geo: "y" },
  ];
  const fields = ["src_ip", "user", "action", "reason", "geo"];
  const zones = { guest: ["192.168.50.0/24"], staff: ["10.10.0.0/16"], internet: ["!10.0.0.0/8"] };
  const tests = [
    { event: { _time: "03:12:01", src_ip: "203.0.113.77", user: "a", action: "failure" }, want: "alert" as const, what: "the spray" },
    { event: { _time: "03:12:02", src_ip: "198.51.100.5", user: "b", action: "success" }, want: "quiet" as const, what: "normal login" },
  ];

  it("terminal never throws, always returns output", () => {
    const bugs = sweep(NASTY, (s) => {
      expect(typeof runLine(s, files, []).out).toBe("string");
    }, null);
    expect(bugs, bugs.join("\n")).toEqual([]);
  });

  it("SIEM search only throws SiemError", () => {
    const bugs = sweep([...SIEMY, ...NASTY], (s) => search(s, events, fields), SiemError);
    expect(bugs, bugs.join("\n")).toEqual([]);
  });

  it("firewall parseRules only throws RuleError", () => {
    const bugs = sweep(NASTY, (s) => parseRules(s, zones), RuleError);
    expect(bugs, bugs.join("\n")).toEqual([]);
  });

  it("detection rule test never throws, always returns a verdict", () => {
    const bugs = sweep([...SIEMY, ...NASTY], (s) => {
      expect(typeof testRule(s, tests).ok).toBe("boolean");
    }, null);
    expect(bugs, bugs.join("\n")).toEqual([]);
  });

  it("request parser only throws RequestError", () => {
    const bugs = sweep([...REQ, ...NASTY], (s) => parseRequest(s), RequestError);
    expect(bugs, bugs.join("\n")).toEqual([]);
  });
});
