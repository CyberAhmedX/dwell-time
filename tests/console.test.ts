import { describe, it, expect } from "vitest";
import { initConsole, act, goalMet, goalsMet, type ConsoleUser, type ConsoleGoal } from "../src/engine/console";

const users: ConsoleUser[] = [
  {
    upn: "boss@school.example",
    name: "Boss",
    role: "Principal",
    mfa: "push",
    sessions: [
      { id: "s1", device: "Phone", ip: "198.51.100.12", place: "Port Halden", since: "08:02" },
      { id: "s2", device: "Browser", ip: "203.0.113.90", place: "Unknown", since: "03:18" },
    ],
    rules: [
      { id: "r1", name: "Newsletters", summary: "move to folder" },
      { id: "r2", name: ".", summary: "forward invoices outside" },
    ],
  },
  { upn: "teacher@school.example", name: "Teacher", role: "Teacher", mfa: "number", sessions: [], rules: [] },
];
const upn = "boss@school.example";
const intruder = { upn, ip: "203.0.113.90" };
const goals: ConsoleGoal[] = [
  { kind: "password-reset", upn, label: "" },
  { kind: "reset-before-revoke", upn, label: "" },
  { kind: "no-sessions", upn, label: "" },
  { kind: "rule-removed", upn, rule: "r2", label: "" },
  { kind: "rule-kept", upn, rule: "r1", label: "" },
  { kind: "mfa", upn, method: "number", label: "" },
  { kind: "only-touched", upn, label: "" },
];

function goodRun() {
  const s = initConsole(users);
  act(s, { type: "reset", upn }, intruder);
  act(s, { type: "revoke", upn }, intruder);
  act(s, { type: "delete-rule", upn, rule: "r2" }, intruder);
  act(s, { type: "mfa", upn, method: "number" }, intruder);
  return s;
}

describe("admin console", () => {
  it("does not change the starting data", () => {
    goodRun();
    expect(users[0].sessions).toHaveLength(2);
  });

  it("accepts the right fix", () => {
    expect(goalsMet(goodRun(), goals, users)).toBe(true);
  });

  it("warns when sessions are revoked while the password still works", () => {
    const s = initConsole(users);
    const note = act(s, { type: "revoke", upn }, intruder);
    expect(note).toContain("203.0.113.90");
    expect(s.log[0].warn).toBe(true);
    act(s, { type: "reset", upn }, intruder);
    expect(goalMet(s, goals[1], users)).toBe(false);
    // revoking again after the reset fixes the order
    act(s, { type: "revoke", upn }, intruder);
    expect(goalMet(s, goals[1], users)).toBe(false);
  });

  it("catches the shortcuts", () => {
    const allRules = goodRun();
    act(allRules, { type: "delete-rule", upn, rule: "r1" });
    expect(goalMet(allRules, goals[4], users)).toBe(false);

    const off = goodRun();
    act(off, { type: "mfa", upn, method: "off" });
    expect(goalMet(off, goals[5], users)).toBe(false);

    const wrongUser = goodRun();
    act(wrongUser, { type: "reset", upn: "teacher@school.example" });
    expect(goalMet(wrongUser, goals[6], users)).toBe(false);

    const blocked = goodRun();
    act(blocked, { type: "block", upn, on: true });
    expect(goalMet(blocked, goals[6], users)).toBe(false);
    act(blocked, { type: "block", upn, on: false });
    expect(goalMet(blocked, goals[6], users)).toBe(true);

    const deleted = goodRun();
    act(deleted, { type: "delete-user", upn });
    expect(goalsMet(deleted, goals, users)).toBe(false);
  });
});
