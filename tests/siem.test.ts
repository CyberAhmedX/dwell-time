import { describe, it, expect } from "vitest";
import { search, resultText, SiemError } from "../src/engine/siem";

const ev: Record<string, string>[] = [
  { _time: "03:12:01", src_ip: "203.0.113.77", user: "a.reyes", action: "failure", bytes: "120" },
  { _time: "03:12:02", src_ip: "203.0.113.77", user: "b.osei", action: "failure", bytes: "118" },
  { _time: "03:12:04", src_ip: "203.0.113.77", user: "e.novak", action: "success", bytes: "900" },
  { _time: "07:58:00", src_ip: "198.51.100.23", user: "b.osei", action: "failure", bytes: "110" },
  { _time: "07:58:30", src_ip: "198.51.100.23", user: "b.osei", action: "success", bytes: "2400" },
  { _time: "09:00:00", src_ip: "198.51.100.40", user: "c.lindgren", action: "success", bytes: "1500", note: "new laptop" },
];
const fields = ["src_ip", "user", "action", "bytes"];
const q = (s: string) => search(s, ev, fields);

describe("SIEM search", () => {
  it("matches field=value, with wildcards and any case", () => {
    expect(q("action=failure").rows).toHaveLength(3);
    expect(q("src_ip=203.0.113.*").rows).toHaveLength(3);
    expect(q("user=B.OSEI").rows).toHaveLength(3);
    expect(q('note="new laptop"').rows).toHaveLength(1);
    expect(q("note=*").rows).toHaveLength(1);
  });

  it("combines terms with AND, OR, NOT and parentheses", () => {
    expect(q("action=failure src_ip=198.51.100.23").rows).toHaveLength(1);
    expect(q("action=failure AND src_ip=198.51.100.23").rows).toHaveLength(1);
    expect(q("user=a.reyes OR user=e.novak").rows).toHaveLength(2);
    expect(q("NOT action=failure").rows).toHaveLength(3);
    expect(q("action!=failure").rows).toHaveLength(3);
    expect(q("(user=a.reyes OR user=b.osei) action=failure").rows).toHaveLength(3);
  });

  it("compares numbers", () => {
    expect(q("bytes>1000").rows).toHaveLength(2);
    expect(q("bytes<=118").rows).toHaveLength(2);
  });

  it("finds bare words anywhere", () => {
    expect(q("novak").rows).toHaveLength(1);
    expect(q("laptop").rows).toHaveLength(1);
  });

  it("counts with stats, count and dc, grouped by fields", () => {
    const r = q("action=failure | stats count by src_ip | sort -count");
    expect(r.columns).toEqual(["src_ip", "count"]);
    expect(r.rows).toEqual([
      { src_ip: "203.0.113.77", count: "2" },
      { src_ip: "198.51.100.23", count: "1" },
    ]);
    expect(q("| stats dc(user) by src_ip").rows.find((x) => x.src_ip === "203.0.113.77")).toEqual({ src_ip: "203.0.113.77", "dc(user)": "3" });
    expect(q("* | stats count").rows).toEqual([{ count: "6" }]);
    expect(q("action=nothing | stats count").rows).toEqual([{ count: "0" }]);
    expect(q("| stats count as tries, values(user) by src_ip | where tries > 2").rows).toEqual([
      { src_ip: "203.0.113.77", tries: "3", "values(user)": "a.reyes b.osei e.novak" },
    ]);
  });

  it("sorts, limits, picks columns and dedups", () => {
    expect(q("| sort - bytes | head 1").rows[0].user).toBe("b.osei");
    expect(q("| sort bytes | head 2").rows.map((r) => r.bytes)).toEqual(["110", "118"]);
    expect(q("| table _time user").columns).toEqual(["_time", "user"]);
    expect(q("| dedup user").rows).toHaveLength(4);
    expect(q("| tail 1").rows[0].user).toBe("c.lindgren");
  });

  it("renders text the bot and tests can read", () => {
    expect(resultText(q("src_ip=203.0.113.77 action=success | table user"))).toBe("user\ne.novak");
  });

  it("explains bad searches", () => {
    for (const bad of ["(action=failure", 'user="x', "| stats", "| frobnicate", "| head x", "action=failure |", "| stats dc", "NOT"]) {
      expect(() => q(bad), bad).toThrow(SiemError);
    }
  });
});
