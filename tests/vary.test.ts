import { describe, it, expect } from "vitest";
import { clinicVpnEvents, schoolDnsLog } from "../src/content/logs";
import { withRunData } from "../src/content/vary";
import { TICKETS } from "../src/content/tickets";
import { runSolution } from "../src/engine/solution";
import { normalizeAnswer } from "../src/engine/answer";

// Addresses the game is allowed to use: documentation ranges and private space.
const SAFE_IP = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$|^10\.|^172\.(1[6-9]|2\d|3[01])\.|^192\.168\./;

const SEEDS = [1, 42, 1000, 20260310, 2 ** 31, 4294967295];

describe("seeded clinic VPN generator", () => {
  it("is deterministic: same seed gives identical data", () => {
    expect(clinicVpnEvents(42)).toEqual(clinicVpnEvents(42));
  });

  it("different seeds give different data", () => {
    expect(clinicVpnEvents(42)).not.toEqual(clinicVpnEvents(43));
  });

  it("keeps the spray address fixed and every address in a safe range", () => {
    for (const seed of SEEDS) {
      const vpn = clinicVpnEvents(seed);
      expect(vpn.sprayIp).toBe("203.0.113.77");
      for (const e of vpn.events) expect(e.src_ip, `${seed}: ${e.src_ip}`).toMatch(SAFE_IP);
    }
  });

  it("breaches a real staff account, never a fixed-beat account", () => {
    const reserved = ["b.osei", "k.duarte", "s.nguyen"];
    const seen = new Set<string>();
    for (const seed of SEEDS) {
      const vpn = clinicVpnEvents(seed);
      expect(reserved).not.toContain(vpn.breached);
      expect(vpn.events.some((e) => e.user === vpn.breached && e.src_ip === vpn.sprayIp && e.action === "success")).toBe(true);
      seen.add(vpn.breached);
    }
    expect(seen.size).toBeGreaterThan(1); // it actually varies
  });
});

describe("seeded school DNS generator", () => {
  it("is deterministic and varies the tunnel per seed", () => {
    expect(schoolDnsLog(42)).toEqual(schoolDnsLog(42));
    const seen = new Set(SEEDS.map((s) => `${schoolDnsLog(s).tunnelHost}|${schoolDnsLog(s).tunnelDomain}`));
    expect(seen.size).toBeGreaterThan(1);
  });

  it("the tunnel host is a lab PC and the lookup count is greppable", () => {
    for (const seed of SEEDS) {
      const dns = schoolDnsLog(seed);
      expect(dns.tunnelHost).toMatch(/^lab-pc-\d{2}$/);
      // grep -c of the tunnel domain must equal the reported count (no collisions)
      const hits = dns.log.split("\n").filter((l) => l.includes(dns.tunnelDomain)).length;
      expect(hits, `${seed}`).toBe(dns.tunnelCount);
    }
  });
});

describe("withRunData resolver", () => {
  it("leaves tickets without run data untouched", () => {
    const other = TICKETS.find((t) => t.id === "tr_network")!;
    expect(withRunData(other, 123)).toBe(other);
  });

  it("rebuilds varying cases so every solution still finds its answer", () => {
    for (const id of ["tr_soc", "t2_school_dns"]) {
      const base = TICKETS.find((t) => t.id === id)!;
      for (const seed of SEEDS) {
        const t = withRunData(base, seed);
        for (const q of t.questions) {
          if (q.type !== "typed" || !q.solution) continue;
          const ev = t.evidence.find((e) => e.id === q.solution!.evidence)!;
          const r = runSolution(ev, q.solution.command);
          expect(r.error, `${id}/${seed}/${q.id}: ${r.out}`).toBeFalsy();
          expect(normalizeAnswer(r.out), `${id}/${seed}/${q.id}`).toContain(normalizeAnswer(q.answer[0]));
        }
      }
    }
  });
});
