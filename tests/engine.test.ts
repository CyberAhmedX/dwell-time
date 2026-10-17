import { describe, it, expect, beforeEach } from "vitest";
import {
  freshSave,
  rankIndex,
  rankTitle,
  rankProgress,
  setFlag,
  hasFlag,
  hasAll,
  hasNone,
  markDone,
  isDone,
  conduct,
  accuracy,
  RANK_THRESHOLDS,
  RANK_TITLES,
  load,
  save,
  wipe,
} from "../src/engine/state";
import { resolveEnding, ENDINGS, F, FINALE_SUCCESS, FINALE_FAILED, LIGHTHOUSE_MIN_INTEGRITY } from "../src/engine/endings";

describe("ranks", () => {
  it("starts as Applicant before hire", () => {
    const s = freshSave();
    expect(rankIndex(s)).toBe(0);
    expect(rankTitle(s)).toBe("Applicant");
  });

  it("climbs the ladder with xp once hired", () => {
    const s = freshSave();
    s.hired = true;
    s.xp = 0;
    expect(rankTitle(s)).toBe(RANK_TITLES[1]);
    s.xp = RANK_THRESHOLDS[2];
    expect(rankIndex(s)).toBe(2);
    s.xp = RANK_THRESHOLDS[RANK_THRESHOLDS.length - 1] + 500;
    expect(rankIndex(s)).toBe(RANK_TITLES.length - 1);
    expect(rankProgress(s).max).toBe(true);
  });

  it("reports progress toward the next rank", () => {
    const s = freshSave();
    s.hired = true;
    s.xp = RANK_THRESHOLDS[2];
    const p = rankProgress(s);
    expect(p.have).toBe(0);
    expect(p.need).toBe(RANK_THRESHOLDS[3] - RANK_THRESHOLDS[2]);
  });
});

describe("flags and progress", () => {
  it("sets, reads and gates on flags", () => {
    const s = freshSave();
    setFlag(s, "a");
    setFlag(s, "a"); // idempotent
    expect(s.flags.filter((f) => f === "a").length).toBe(1);
    expect(hasFlag(s, "a")).toBe(true);
    expect(hasAll(s, ["a"])).toBe(true);
    expect(hasAll(s, ["a", "b"])).toBe(false);
    expect(hasNone(s, ["b"])).toBe(true);
    expect(hasNone(s, ["a"])).toBe(false);
  });

  it("tracks done ids", () => {
    const s = freshSave();
    markDone(s, "t1");
    markDone(s, "t1");
    expect(s.done).toEqual(["t1"]);
    expect(isDone(s, "t1")).toBe(true);
  });
});

describe("save/load", () => {
  beforeEach(() => wipe());

  it("round-trips through localStorage", () => {
    const s = freshSave();
    s.playerName = "Riley";
    s.hired = true;
    s.xp = 200;
    setFlag(s, "knows_truth");
    save(s);
    const back = load();
    expect(back.playerName).toBe("Riley");
    expect(back.xp).toBe(200);
    expect(hasFlag(back, "knows_truth")).toBe(true);
  });

  it("returns a fresh save when nothing is stored", () => {
    const s = load();
    expect(s.hired).toBe(false);
    expect(s.playerName).toBe("");
  });
});

describe("endings", () => {
  function base(): ReturnType<typeof freshSave> {
    const s = freshSave();
    s.hired = true;
    s.chapter = 6;
    return s;
  }

  it("a failed finale always ends in Dead Water", () => {
    const s = base();
    setFlag(s, FINALE_SUCCESS); // even with success flags present
    setFlag(s, F.reportedOut);
    setFlag(s, F.chainIntact);
    setFlag(s, FINALE_FAILED); // failure dominates
    expect(resolveEnding(s).id).toBe(ENDINGS.deadwater.id);
  });

  it("reaches The Lighthouse with a clean chain, external report, and enough integrity", () => {
    const s = base();
    setFlag(s, FINALE_SUCCESS);
    setFlag(s, F.reportedOut);
    setFlag(s, F.chainIntact);
    s.integrity = LIGHTHOUSE_MIN_INTEGRITY;
    expect(resolveEnding(s).id).toBe(ENDINGS.lighthouse.id);
  });

  it("denies The Lighthouse when integrity is too low, even with a clean report", () => {
    const s = base();
    setFlag(s, FINALE_SUCCESS);
    setFlag(s, F.reportedOut);
    setFlag(s, F.chainIntact);
    s.integrity = LIGHTHOUSE_MIN_INTEGRITY - 1;
    expect(resolveEnding(s).id).toBe(ENDINGS.keeper.id);
  });

  it("reaches Low Tide when trusting Nadia and handing her the evidence", () => {
    const s = base();
    setFlag(s, FINALE_SUCCESS);
    setFlag(s, F.gaveNadia);
    setFlag(s, F.trustNadia);
    expect(resolveEnding(s).id).toBe(ENDINGS.lowtide.id);
  });

  it("falls back to Company Keeper", () => {
    const s = base();
    setFlag(s, FINALE_SUCCESS);
    setFlag(s, F.coveredUp);
    expect(resolveEnding(s).id).toBe(ENDINGS.keeper.id);
  });

  it("reporting externally without a clean chain does not reach Lighthouse", () => {
    const s = base();
    setFlag(s, FINALE_SUCCESS);
    setFlag(s, F.reportedOut);
    setFlag(s, F.chainBroken); // chain was broken earlier
    expect(resolveEnding(s).id).toBe(ENDINGS.keeper.id);
  });

  it("all four endings are distinct and reachable", () => {
    const ids = new Set(
      [ENDINGS.lighthouse, ENDINGS.lowtide, ENDINGS.keeper, ENDINGS.deadwater].map((e) => e.id),
    );
    expect(ids.size).toBe(4);
  });
});

describe("conduct and accuracy", () => {
  it("maps integrity to conduct tiers across the range", () => {
    const at = (n: number): string => {
      const s = freshSave();
      s.integrity = n;
      return conduct(s).tier;
    };
    expect(at(8)).toBe("Exemplary");
    expect(at(4)).toBe("Principled");
    expect(at(1)).toBe("Pragmatic");
    expect(at(-2)).toBe("Compromised");
    expect(at(-5)).toBe("Corrupt");
  });

  it("reports full accuracy before any case, then the clean ratio", () => {
    const s = freshSave();
    expect(accuracy(s)).toBe(1);
    s.totalCloses = 4;
    s.cleanCloses = 3;
    expect(accuracy(s)).toBeCloseTo(0.75);
  });
});
