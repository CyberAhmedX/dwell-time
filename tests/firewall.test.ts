import { describe, it, expect } from "vitest";
import { inRange, parseRules, replay, rulesPass, RuleError, type Flow } from "../src/engine/firewall";

const zones = {
  guest: ["192.168.50.0/24"],
  staff: ["10.10.0.0/16"],
  internet: ["!10.0.0.0/8", "!172.16.0.0/12", "!192.168.0.0/16"],
};
const flow = (src: string, dst: string, port: number, proto: "tcp" | "udp", want: "allow" | "deny"): Flow => ({ src, dst, port, proto, want, what: "" });

describe("addresses", () => {
  it("does CIDR maths", () => {
    expect(inRange("10.20.4.5", "10.20.0.0/16")).toBe(true);
    expect(inRange("10.21.4.5", "10.20.0.0/16")).toBe(false);
    expect(inRange("192.168.50.255", "192.168.50.0/24")).toBe(true);
    expect(inRange("172.31.0.1", "172.16.0.0/12")).toBe(true);
    expect(inRange("172.32.0.1", "172.16.0.0/12")).toBe(false);
    expect(inRange("203.0.113.9", "0.0.0.0/0")).toBe(true);
    expect(inRange("10.0.0.1", "10.0.0.1")).toBe(true);
    expect(inRange("10.0.0.2", "10.0.0.1")).toBe(false);
  });
});

describe("firewall rules", () => {
  it("first match wins, and anything unmatched is denied", () => {
    const flows = [flow("192.168.50.5", "198.51.100.9", 445, "tcp", "deny"), flow("192.168.50.5", "198.51.100.9", 443, "tcp", "allow")];
    // wrong order: the broad allow catches SMB before the deny is reached
    const wrong = replay("allow from guest to internet\ndeny from guest to internet port 445 proto tcp", flows, zones);
    expect(wrong.map((v) => v.action)).toEqual(["allow", "allow"]);
    expect(wrong[0].ok).toBe(false);
    expect(wrong[0].rule?.line).toBe(1);
    const right = replay("deny from guest to internet port 445 proto tcp\nallow from guest to internet", flows, zones);
    expect(right.every((v) => v.ok)).toBe(true);
    const none = replay("", [flow("192.168.50.5", "10.10.0.1", 22, "tcp", "deny")], zones)[0];
    expect(none).toEqual({ action: "deny", rule: null, ok: true });
  });

  it("zones can leave ranges out", () => {
    const flows = [flow("192.168.50.5", "10.10.4.12", 445, "tcp", "deny"), flow("192.168.50.5", "203.0.113.50", 3478, "udp", "allow")];
    expect(rulesPass("allow from guest to internet", flows, zones)).toBe(true);
  });

  it("matches ports, port ranges and protocols", () => {
    const f = [flow("192.168.50.5", "192.168.50.1", 53, "udp", "allow"), flow("192.168.50.5", "192.168.50.1", 53, "tcp", "deny")];
    expect(rulesPass("allow from guest to 192.168.50.1 port 53 proto udp", f, zones)).toBe(true);
    expect(rulesPass("allow from guest to 192.168.50.1 port 50:60 proto udp", f, zones)).toBe(true);
    expect(rulesPass("allow from guest to 192.168.50.1 port 53", f, zones)).toBe(false);
  });

  it("ignores comments and blank lines, and is case-insensitive on keywords", () => {
    expect(parseRules("# guest rules\n\nALLOW from guest to internet # web\n", zones)).toHaveLength(1);
  });

  it("explains broken rules with the line number", () => {
    const bad: [string, string][] = [
      ["permit from guest to any", "starts with allow or deny"],
      ["allow from guests to any", "not an address"],
      ["allow from guest to any port 70000", "not a port"],
      ["allow from guest to any proto icmp", "tcp or udp"],
      ["allow from", "needs"],
      ["allow from guest to 10.10.0.0/40", "not an address"],
      ["\nallow guest to any", "line 2"],
    ];
    for (const [text, msg] of bad) {
      expect(() => parseRules(text, zones), text).toThrow(RuleError);
      expect(() => parseRules(text, zones), text).toThrow(msg);
    }
    expect(rulesPass("permit everything", [], zones)).toBe(false);
  });
});
