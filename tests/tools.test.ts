import { describe, it, expect } from "vitest";
import { baseScore, parseVector, severity, roundUp, CvssError } from "../src/engine/cvss";
import { checkScope, rangeInfo, ScopeError } from "../src/engine/scope";
import { defang, refang, isDefanged, gradeIocs } from "../src/engine/ioc";
import { runLine } from "../src/engine/shell";

describe("CVSS v3.1 base scores", () => {
  // scores checked against the FIRST calculator
  const known: [string, number][] = [
    ["AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8],
    ["AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10.0],
    ["AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H", 7.8],
    ["AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N", 4.3],
    ["AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", 6.1],
    ["AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N", 5.9],
    ["AV:P/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N", 1.6],
    ["AV:N/AC:L/PR:H/UI:N/S:C/C:H/I:H/A:H", 9.1],
    ["AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N", 0],
  ];
  it("matches the official calculator", () => {
    for (const [v, s] of known) expect(baseScore(parseVector(v)), v).toBe(s);
  });

  it("names the severity bands", () => {
    expect([0, 0.1, 3.9, 4, 6.9, 7, 8.9, 9, 10].map(severity)).toEqual(["None", "Low", "Low", "Medium", "Medium", "High", "High", "Critical", "Critical"]);
  });

  it("rounds up the way the spec does, without float noise", () => {
    expect(roundUp(4.0)).toBe(4.0);
    expect(roundUp(4.02)).toBe(4.1);
    expect(roundUp(4.000001)).toBe(4.0);
  });

  it("refuses a vector with a metric missing, repeated or impossible", () => {
    expect(() => parseVector("AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N")).toThrow(CvssError);
    expect(() => parseVector("AV:N/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N")).toThrow(CvssError);
    expect(() => parseVector("AV:X/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N")).toThrow(CvssError);
    expect(parseVector("CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N").PR).toBe("L");
  });
});

describe("scope checker", () => {
  const rules = { inScope: ["198.51.100.64/28", "203.0.113.5"], outOfScope: ["198.51.100.70"] };

  it("allows what the letter names, and nothing else", () => {
    expect(checkScope(rules, "198.51.100.64").inScope).toBe(true);
    expect(checkScope(rules, "198.51.100.79").inScope).toBe(true);
    expect(checkScope(rules, "198.51.100.80").inScope).toBe(false);
    expect(checkScope(rules, "198.51.100.63").inScope).toBe(false);
    expect(checkScope(rules, "203.0.113.5").inScope).toBe(true);
    expect(checkScope(rules, "203.0.113.6").reason).toMatch(/not listed/);
  });

  it("lets an exclusion win over an inclusion", () => {
    const v = checkScope(rules, "198.51.100.70");
    expect(v.inScope).toBe(false);
    expect(v.reason).toMatch(/excluded/);
  });

  it("spells out what a range covers", () => {
    expect(rangeInfo("198.51.100.64/28")).toEqual({ network: "198.51.100.64", first: "198.51.100.65", last: "198.51.100.78", broadcast: "198.51.100.79", size: 16 });
    expect(rangeInfo("10.20.0.0/16").size).toBe(65536);
    expect(rangeInfo("198.51.100.77/32")).toMatchObject({ first: "198.51.100.77", last: "198.51.100.77", size: 1 });
    expect(() => rangeInfo("198.51.100.0/33")).toThrow(ScopeError);
    expect(() => checkScope(rules, "not-an-ip")).toThrow(ScopeError);
  });
});

describe("indicators and defanging", () => {
  it("defangs and refangs", () => {
    expect(defang("evil.example")).toBe("evil[.]example");
    expect(defang("http://evil.example/x")).toBe("hxxp://evil[.]example/x");
    expect(defang("evil[.]example")).toBe("evil[.]example");
    expect(refang("Evil[.]Example")).toBe("evil.example");
    expect(refang("hxxps://evil(.)example")).toBe("https://evil.example");
  });

  it("knows a safe indicator from a live one", () => {
    for (const ok of ["evil[.]example", "data.evil[.]example", "203.0.113[.]77", "203[.]0[.]113[.]77", "hxxp://evil[.]example/a.php", "e3b0c44298fc1c14"]) expect(isDefanged(ok), ok).toBe(true);
    for (const bad of ["evil.example", "evil[.]example.test", "http://evil[.]example", "203.0.113.77"]) expect(isDefanged(bad), bad).toBe(false);
  });

  it("grades a block list on what is missing, extra and live", () => {
    const want = ["a.test", "b.test", "203.0.113.90"];
    expect(gradeIocs("a[.]test\nb[.]test\n203.0.113[.]90", want).ok).toBe(true);
    expect(gradeIocs("a[.]test, b[.]test 203[.]0[.]113[.]90", want).ok).toBe(true);
    const g = gradeIocs("a[.]test\nb.test\nc[.]test", want);
    expect(g).toMatchObject({ ok: false, missing: ["203.0.113.90"], extra: ["c.test"], live: ["b.test"] });
    expect(gradeIocs("", want).ok).toBe(false);
  });

  it("has a defang command in the terminal", () => {
    expect(runLine("echo bad.example | defang", {}).out).toBe("bad[.]example");
    expect(runLine("grep -oE '[a-z-]+\\.test' r.txt | sort -u | defang", { "r.txt": "see x.test and y.test, x.test again" }).out).toBe("x[.]test\ny[.]test");
  });
});

import { testRule } from "../src/engine/detect";
import { checkReport, countWords } from "../src/engine/report";

describe("detection rule tester", () => {
  const tests = [
    { event: { account: "lh-admin", geo: "External" }, want: "alert" as const, what: "attacker" },
    { event: { account: "lh-admin", geo: "Internal" }, want: "quiet" as const, what: "maintenance" },
    { event: { account: "alice", geo: "External" }, want: "quiet" as const, what: "staff at home" },
  ];
  it("passes only a rule that catches every attack and no normal event", () => {
    expect(testRule("account=lh-admin geo=External", tests).ok).toBe(true);
    expect(testRule("account=lh-admin", tests)).toMatchObject({ ok: false, falseAlarms: [1] });
    expect(testRule("geo=External", tests)).toMatchObject({ ok: false, falseAlarms: [2] });
    expect(testRule("account=bob", tests)).toMatchObject({ ok: false, missed: [0] });
  });
  it("refuses an empty rule or one with pipe commands", () => {
    expect(testRule("", tests).error).toBeTruthy();
    expect(testRule("*", tests).error).toBeTruthy();
    expect(testRule("account=lh-admin | stats count", tests).error).toBeTruthy();
  });
});

describe("incident report check", () => {
  const facts = [
    { label: "root cause", any: ["shared.{0,20}(password|credential)", "never.{0,10}rotat"] },
    { label: "the fix", any: ["rotat", "retir"] },
  ];
  it("counts only real words", () => {
    expect(countWords("one two three")).toBe(3);
    expect(countWords("  ...  --  ")).toBe(0);
  });
  it("needs both the facts and the length", () => {
    const good = "The shared credential was never rotated, which is the root cause. We should rotate it and require MFA now.";
    expect(checkReport(good, facts, 15).ok).toBe(true);
    expect(checkReport(good, facts, 50).ok).toBe(false);
    expect(checkReport("rotate it", facts, 1)).toMatchObject({ ok: false, covered: [false, true] });
  });
});
