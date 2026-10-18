import { inRange, ipToInt } from "./firewall";

// The scope checker: before a pentester touches an address, they check it
// against the engagement letter. Exclusions win over inclusions, and anything
// the letter does not mention is out of scope.

export interface ScopeRules {
  inScope: readonly string[]; // addresses or CIDR ranges
  outOfScope: readonly string[];
}

export interface ScopeVerdict {
  inScope: boolean;
  reason: string;
}

export class ScopeError extends Error {}

export function checkScope(rules: ScopeRules, ip: string): ScopeVerdict {
  if (ipToInt(ip) === null) throw new ScopeError(`${ip} is not an IPv4 address`);
  const out = rules.outOfScope.find((r) => inRange(ip, r));
  if (out) return { inScope: false, reason: `excluded: inside ${out}, which the letter puts out of scope` };
  const hit = rules.inScope.find((r) => inRange(ip, r));
  if (hit) return { inScope: true, reason: `inside ${hit}` };
  return { inScope: false, reason: "not listed. Anything the letter does not name is out of scope" };
}

export interface RangeInfo {
  network: string;
  first: string; // first usable host
  last: string; // last usable host
  broadcast: string;
  size: number; // every address in the range
}

const toIp = (n: number): string => [24, 16, 8, 0].map((s) => (n >>> s) & 255).join(".");

/** What a CIDR range covers, like ipcalc. */
export function rangeInfo(cidr: string): RangeInfo {
  const m = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(cidr.trim());
  const base = m ? ipToInt(m[1]) : null;
  const bits = m ? Number(m[2]) : NaN;
  if (base === null || !(bits >= 0 && bits <= 32)) throw new ScopeError(`${cidr} is not a range like 198.51.100.64/28`);
  const size = 2 ** (32 - bits);
  const net = bits === 0 ? 0 : (base & ((0xffffffff << (32 - bits)) >>> 0)) >>> 0;
  const end = (net + size - 1) >>> 0;
  const hosts = size > 2;
  return { network: toIp(net), first: toIp(hosts ? net + 1 : net), last: toIp(hosts ? end - 1 : end), broadcast: toIp(end), size };
}
