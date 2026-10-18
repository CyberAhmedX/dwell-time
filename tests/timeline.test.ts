import { describe, it, expect } from "vitest";
import { mergeTimeline, offsetsRight, offsetLabel, type TimelineSource } from "../src/engine/timeline";

const sources: TimelineSource[] = [
  { id: "pc", name: "PC", note: "local", offset: 1, events: [{ time: "08:51:00", text: "USB in" }, { time: "08:52:00", text: "program runs" }] },
  { id: "fw", name: "Firewall", note: "UTC", offset: 0, events: [{ time: "07:53:00", text: "call out" }] },
];

describe("timeline builder", () => {
  it("shifts each source to UTC and sorts", () => {
    const right = mergeTimeline(sources, { pc: 1, fw: 0 });
    expect(right.map((e) => `${e.utc} ${e.text}`)).toEqual(["07:51:00 USB in", "07:52:00 program runs", "07:53:00 call out"]);
    const wrong = mergeTimeline(sources, { pc: 0, fw: 0 });
    expect(wrong[0].text).toBe("call out"); // the effect before its cause
  });

  it("marks times that cross midnight", () => {
    const late: TimelineSource[] = [{ id: "a", name: "A", note: "", offset: 2, events: [{ time: "01:00:00", text: "x" }] }];
    expect(mergeTimeline(late, { a: 2 })[0].utc).toBe("23:00:00 (day before)");
    expect(mergeTimeline(late, { a: -3 })[0].utc).toBe("04:00:00");
  });

  it("checks every clock", () => {
    expect(offsetsRight(sources, { pc: 1, fw: 0 })).toBe(true);
    expect(offsetsRight(sources, { pc: 1 })).toBe(true); // unset means UTC
    expect(offsetsRight(sources, { pc: 0, fw: 0 })).toBe(false);
  });

  it("labels offsets", () => {
    expect([offsetLabel(0), offsetLabel(1), offsetLabel(-2)]).toEqual(["UTC", "UTC+1", "UTC-2"]);
  });
});
