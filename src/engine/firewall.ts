// A small firewall, close to ufw's syntax so the habit carries over:
//
//   allow from guest to internet
//   deny from guest to internet port 445 proto tcp
//   allow from 192.168.50.0/24 to 192.168.50.1 port 53 proto udp
//   deny from any to any
//
// Rules are checked top to bottom and the first match wins. Anything no rule
// matches is denied. Addresses can be single IPv4 addresses, CIDR ranges, any,
// or named zones defined by the case (a zone can exclude ranges with !).

export interface Flow {
  src: string;
  dst: string;
  port: number;
  proto: "tcp" | "udp";
  what: string; // what this traffic is, in plain words
  want: "allow" | "deny";
}

export interface Rule {
  line: number; // 1-based line in the rule text
  action: "allow" | "deny";
  from: string;
  to: string;
  ports: [number, number] | null; // null means any port
  proto: "tcp" | "udp" | null;
  text: string;
}

export type Zones = Readonly<Record<string, readonly string[]>>;

export class RuleError extends Error {
  constructor(
    public line: number,
    message: string,
  ) {
    super(`line ${line}: ${message}`);
  }
}

export interface Verdict {
  action: "allow" | "deny";
  rule: Rule | null; // null when nothing matched and the default deny applied
  ok: boolean; // matches what the flow wants
}

// ---------- addresses ----------

export function ipToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/** Does ip fall inside spec (an address or a CIDR range)? */
export function inRange(ip: string, spec: string): boolean {
  const a = ipToInt(ip);
  const [base, bitsText] = spec.split("/");
  const b = ipToInt(base);
  if (a === null || b === null) return false;
  const bits = bitsText === undefined ? 32 : Number(bitsText);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}

function validSpec(spec: string): boolean {
  const [base, bits] = spec.split("/");
  if (ipToInt(base) === null) return false;
  return bits === undefined || (/^\d+$/.test(bits) && Number(bits) <= 32);
}

/** Does ip match an address word: any, a zone, an address or a range? */
function matches(ip: string, word: string, zones: Zones): boolean {
  if (word === "any") return true;
  const zone = zones[word];
  if (!zone) return inRange(ip, word);
  const include = zone.filter((z) => !z.startsWith("!"));
  const exclude = zone.filter((z) => z.startsWith("!")).map((z) => z.slice(1));
  return (include.length === 0 || include.some((z) => inRange(ip, z))) && !exclude.some((z) => inRange(ip, z));
}

// ---------- rules ----------

export function parseRules(text: string, zones: Zones): Rule[] {
  const rules: Rule[] = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const body = raw.replace(/#.*$/, "").trim();
    if (!body) return;
    const w = body.split(/\s+/);
    const action = w[0]?.toLowerCase();
    if (action !== "allow" && action !== "deny") {
      throw new RuleError(line, `a rule starts with allow or deny, not "${w[0]}"`);
    }
    const rule: Rule = { line, action, from: "any", to: "any", ports: null, proto: null, text: body };
    let k = 1;
    const word = (what: string): string => {
      const v = w[++k];
      if (v === undefined) throw new RuleError(line, `${w[k - 1]} needs ${what}`);
      return v;
    };
    for (; k < w.length; k++) {
      const key = w[k].toLowerCase();
      if (key === "from" || key === "to") {
        const v = word("an address, a range, a zone name or any");
        if (v !== "any" && !zones[v] && !validSpec(v)) {
          throw new RuleError(line, `"${v}" is not an address, a range like 10.10.0.0/16, or a zone (${Object.keys(zones).join(", ")})`);
        }
        rule[key] = v;
      } else if (key === "port") {
        const v = word("a port number, like 443, or a range like 8000:8100");
        const m = /^(\d+)(?:[:-](\d+))?$/.exec(v);
        const lo = m ? Number(m[1]) : NaN;
        const hi = m ? Number(m[2] ?? m[1]) : NaN;
        if (!m || lo < 1 || hi > 65535 || lo > hi) throw new RuleError(line, `"${v}" is not a port from 1 to 65535`);
        rule.ports = [lo, hi];
      } else if (key === "proto") {
        const v = word("tcp or udp").toLowerCase();
        if (v !== "tcp" && v !== "udp") throw new RuleError(line, `proto is tcp or udp, not "${v}"`);
        rule.proto = v;
      } else {
        throw new RuleError(line, `did not expect "${w[k]}". A rule looks like: allow from guest to internet port 443 proto tcp`);
      }
    }
    rules.push(rule);
  });
  return rules;
}

export function verdict(rules: readonly Rule[], flow: Flow, zones: Zones): Verdict {
  for (const r of rules) {
    if (!matches(flow.src, r.from, zones)) continue;
    if (!matches(flow.dst, r.to, zones)) continue;
    if (r.ports && (flow.port < r.ports[0] || flow.port > r.ports[1])) continue;
    if (r.proto && r.proto !== flow.proto) continue;
    return { action: r.action, rule: r, ok: r.action === flow.want };
  }
  return { action: "deny", rule: null, ok: flow.want === "deny" };
}

/** Replay every flow. Throws RuleError if the rules do not parse. */
export function replay(text: string, flows: readonly Flow[], zones: Zones): Verdict[] {
  const rules = parseRules(text, zones);
  return flows.map((f) => verdict(rules, f, zones));
}

/** True when the rules parse and every flow gets the outcome it wants. */
export function rulesPass(text: string, flows: readonly Flow[], zones: Zones): boolean {
  try {
    return replay(text, flows, zones).every((v) => v.ok);
  } catch (e) {
    if (e instanceof RuleError) return false;
    throw e;
  }
}
