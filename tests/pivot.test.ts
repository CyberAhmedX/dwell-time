import { describe, it, expect } from "vitest";
import { lookup, addressesOf, namesOn, looksLikeIp, type PivotDb } from "../src/engine/pivot";

const db: PivotDb = {
  records: [
    { domain: "mailbox-portal.test", ip: "203.0.113.77", firstSeen: "2026-01-04", lastSeen: "2026-03-14" },
    { domain: "sync-telemetry.example", ip: "203.0.113.77", firstSeen: "2026-02-01", lastSeen: "2026-03-14" },
    { domain: "tollgate.test", ip: "203.0.113.90", firstSeen: "2026-03-01", lastSeen: "2026-03-14" },
    { domain: "mailbox-portal.test", ip: "198.51.100.5", firstSeen: "2025-11-02", lastSeen: "2025-12-30" },
  ],
};

describe("passive DNS lookups", () => {
  it("tells names and addresses apart", () => {
    expect(looksLikeIp("203.0.113.77")).toBe(true);
    expect(looksLikeIp("mailbox-portal.test")).toBe(false);
  });

  it("looks up a name, ignoring case, defanging and a trailing dot", () => {
    for (const t of ["mailbox-portal.test", "Mailbox-Portal.TEST", "mailbox-portal[.]test", "mailbox-portal.test."]) {
      expect(lookup(db, t), t).toHaveLength(2);
    }
  });

  it("returns nothing for an unknown term", () => {
    expect(lookup(db, "nothing-here.example")).toEqual([]);
    expect(lookup(db, "  ")).toEqual([]);
  });

  it("lists the addresses a name used, oldest first", () => {
    expect(addressesOf(db, "mailbox-portal.test")).toEqual(["198.51.100.5", "203.0.113.77"]);
  });

  it("pivots an address back to every name that used it", () => {
    expect(namesOn(db, "203.0.113.77")).toEqual(["mailbox-portal.test", "sync-telemetry.example"]);
    expect(namesOn(db, "203.0.113.90")).toEqual(["tollgate.test"]);
  });
});
