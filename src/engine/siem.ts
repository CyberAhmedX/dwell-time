// A small SIEM search language, modelled on the Splunk searches an analyst
// writes every day, so the habit carries over to the real thing:
//
//   action=failure src_ip=203.0.113.* | stats count, dc(user) by src_ip | sort -count
//
// Search terms: field=value, field!=value, field>N (also <, >=, <=), bare words
// that match any field, * as a wildcard, quotes for values with spaces, and
// AND, OR, NOT with parentheses. Terms next to each other are ANDed.
// Commands after |: stats, sort, head, tail, table, where, dedup.

export type SiemEvent = Readonly<Record<string, string>>;

export interface SiemResult {
  columns: string[];
  rows: Record<string, string>[];
  stats: boolean; // true once rows are aggregates, not events
}

export class SiemError extends Error {}

const MAX_RESULTS = 10_000;

export function search(query: string, events: readonly SiemEvent[], fieldOrder: readonly string[]): SiemResult {
  const [first, ...commands] = splitPipes(query);
  const matcher = parseSearch(first.trim());
  let rows: Record<string, string>[] = events.filter((e) => matcher(e)).map((e) => ({ ...e }));
  let columns = ["_time", ...fieldOrder.filter((f) => f !== "_time")];
  let stats = false;

  for (const raw of commands) {
    const cmd = raw.trim();
    const [name] = cmd.split(/\s+/, 1);
    const rest = cmd.slice(name.length).trim();
    switch (name.toLowerCase()) {
      case "stats":
        ({ rows, columns } = statsCmd(rest, rows));
        stats = true;
        break;
      case "sort":
        rows = sortCmd(rest, rows);
        break;
      case "head":
      case "tail": {
        const n = rest === "" ? 10 : Number(rest);
        if (!Number.isInteger(n) || n < 0) throw new SiemError(`${name} needs a number, like | ${name} 5`);
        rows = name === "head" ? rows.slice(0, n) : rows.slice(Math.max(0, rows.length - n));
        break;
      }
      case "table":
      case "fields": {
        const want = rest.split(/[\s,]+/).filter(Boolean);
        if (!want.length) throw new SiemError("table needs field names, like | table _time user src_ip");
        columns = want;
        break;
      }
      case "where":
        rows = rows.filter(whereCmd(rest));
        break;
      case "dedup": {
        const f = rest.split(/[\s,]+/).filter(Boolean);
        if (!f.length) throw new SiemError("dedup needs a field, like | dedup user");
        const seen = new Set<string>();
        rows = rows.filter((r) => {
          const k = f.map((x) => r[x] ?? "").join("\u0001");
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        break;
      }
      case "":
        throw new SiemError("there is an empty command after a |");
      default:
        throw new SiemError(`unknown command "${name}". This SIEM knows stats, sort, head, tail, table, where and dedup.`);
    }
  }
  return { columns, rows: rows.slice(0, MAX_RESULTS), stats };
}

/** Plain-text rendering, used by tests and by the bot to read results. */
export function resultText(r: SiemResult): string {
  return [r.columns.join("  "), ...r.rows.map((row) => r.columns.map((c) => row[c] ?? "").join("  "))].join("\n");
}

// ---------- the search part ----------

function splitPipes(q: string): string[] {
  const out = [""];
  let quote = false;
  for (const c of q) {
    if (c === '"') quote = !quote;
    if (c === "|" && !quote) out.push("");
    else out[out.length - 1] += c;
  }
  if (quote) throw new SiemError("a quote is never closed");
  return out;
}

type Tok = { t: "word"; v: string } | { t: "("} | { t: ")" } | { t: "AND" } | { t: "OR" } | { t: "NOT" };

function tokenize(s: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "(" || c === ")") {
      toks.push({ t: c });
      i++;
    } else {
      let w = "";
      let quote = false;
      while (i < s.length && (quote || !/[\s()]/.test(s[i]))) {
        if (s[i] === '"') quote = !quote;
        else w += s[i];
        i++;
      }
      if (w === "AND" || w === "OR" || w === "NOT") toks.push({ t: w });
      else toks.push({ t: "word", v: w });
    }
  }
  return toks;
}

type Pred = (e: SiemEvent) => boolean;

function parseSearch(s: string): Pred {
  if (s === "" || s === "*") return () => true;
  const toks = tokenize(s);
  let i = 0;
  const peek = (): Tok | undefined => toks[i];
  const orExpr = (): Pred => {
    let left = andExpr();
    while (peek()?.t === "OR") {
      i++;
      const right = andExpr();
      const l = left;
      left = (e) => l(e) || right(e);
    }
    return left;
  };
  const andExpr = (): Pred => {
    let left = notExpr();
    for (;;) {
      const p = peek();
      if (!p || p.t === "OR" || p.t === ")") return left;
      if (p.t === "AND") i++;
      const right = notExpr();
      const l = left;
      left = (e) => l(e) && right(e);
    }
  };
  const notExpr = (): Pred => {
    if (peek()?.t === "NOT") {
      i++;
      const inner = notExpr();
      return (e) => !inner(e);
    }
    return atom();
  };
  const atom = (): Pred => {
    const p = toks[i++];
    if (!p) throw new SiemError("the search ends too early. Is something missing after AND, OR or NOT?");
    if (p.t === "(") {
      const inner = orExpr();
      if (toks[i++]?.t !== ")") throw new SiemError("a ( is never closed");
      return inner;
    }
    if (p.t === "word") return term(p.v);
    throw new SiemError(`unexpected ${p.t} in the search`);
  };
  const pred = orExpr();
  if (i < toks.length) throw new SiemError("unexpected ) in the search");
  return pred;
}

function glob(value: string): RegExp {
  const src = value.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${src}$`, "i");
}

const num = (v: string | undefined): number => (v !== undefined && v.trim() !== "" ? Number(v) : NaN);

function compare(op: string, have: string | undefined, want: string): boolean {
  if (op === "=") return have !== undefined && glob(want).test(have);
  if (op === "!=") return have === undefined || !glob(want).test(have);
  const a = num(have);
  const b = num(want);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return op === ">" ? a > b : op === "<" ? a < b : op === ">=" ? a >= b : a <= b;
}

function term(word: string): Pred {
  const m = /^([A-Za-z_][\w.]*)(!=|>=|<=|=|>|<)(.*)$/.exec(word);
  if (m) {
    const [, field, op, value] = m;
    return (e) => compare(op, e[field], value);
  }
  // a bare word matches anywhere in any field, like a keyword search
  const re = glob(`*${word}*`);
  return (e) => Object.values(e).some((v) => re.test(v));
}

// ---------- commands ----------

function statsCmd(spec: string, rows: Record<string, string>[]): { rows: Record<string, string>[]; columns: string[] } {
  const m = /^(.*?)(?:\s+by\s+(.+))?$/i.exec(spec)!;
  const aggs = m[1]
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => {
      const am = /^(count|dc|distinct_count|values)(?:\((\w[\w.]*)?\))?(?:\s+as\s+(\w+))?$/i.exec(a);
      if (!am) throw new SiemError(`stats does not understand "${a}". Try count, dc(field) or values(field).`);
      const fn = am[1].toLowerCase() === "distinct_count" ? "dc" : am[1].toLowerCase();
      const field = am[2];
      if ((fn === "dc" || fn === "values") && !field) throw new SiemError(`${fn} needs a field, like ${fn}(user)`);
      return { fn, field, name: am[3] ?? (field ? `${fn}(${field})` : fn) };
    });
  if (!aggs.length) throw new SiemError("stats needs something to count, like | stats count by src_ip");
  const by = m[2] ? m[2].split(/[\s,]+/).filter(Boolean) : [];

  const groups = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    if (by.some((f) => r[f] === undefined)) continue; // like Splunk, events missing a by-field drop out
    const k = by.map((f) => r[f]).join("\u0001");
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  if (by.length === 0 && groups.size === 0) groups.set("", []);

  const out: Record<string, string>[] = [];
  for (const g of groups.values()) {
    const row: Record<string, string> = {};
    by.forEach((f) => (row[f] = g[0]?.[f] ?? ""));
    for (const a of aggs) {
      if (a.fn === "count") row[a.name] = String(a.field ? g.filter((r) => r[a.field!] !== undefined).length : g.length);
      else {
        const vals = [...new Set(g.map((r) => r[a.field!]).filter((v): v is string => v !== undefined))].sort();
        row[a.name] = a.fn === "dc" ? String(vals.length) : vals.join(" ");
      }
    }
    out.push(row);
  }
  // Splunk lists stats groups in order of the by-fields
  out.sort((x, y) => by.map((f) => cmp(x[f], y[f])).find((c) => c !== 0) ?? 0);
  return { rows: out, columns: [...by, ...aggs.map((a) => a.name)] };
}

function cmp(a: string | undefined, b: string | undefined): number {
  const x = num(a);
  const y = num(b);
  if (!Number.isNaN(x) && !Number.isNaN(y)) return x - y;
  return (a ?? "").localeCompare(b ?? "");
}

function sortCmd(spec: string, rows: Record<string, string>[]): Record<string, string>[] {
  const keys = spec
    .replace(/([-+])\s+/g, "$1")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((k) => ({ desc: k.startsWith("-"), field: k.replace(/^[-+]/, "") }));
  if (!keys.length) throw new SiemError("sort needs a field, like | sort -count");
  return rows.slice().sort((a, b) => {
    for (const k of keys) {
      const c = cmp(a[k.field], b[k.field]);
      if (c !== 0) return k.desc ? -c : c;
    }
    return 0;
  });
}

function whereCmd(spec: string): (r: Record<string, string>) => boolean {
  const m = /^(\S+?)\s*(!=|>=|<=|==|=|>|<)\s*"?(.*?)"?$/.exec(spec);
  if (!m) throw new SiemError('where needs a comparison, like | where count > 5');
  const [, field, op, value] = m;
  return (r) => compare(op === "==" ? "=" : op, r[field], value);
}
