import { sha256 } from "./sha256";

// A small, read-only shell over a case's files. It runs the commands an analyst
// reaches for first, with real syntax and real output formats, so what you learn
// here works on a real machine: ls, cat, head, tail, grep, sort, uniq, wc, cut,
// awk '{print $N}', base64, sha256sum, echo, and pipes between them.
//
// Nothing can be written: evidence is read-only. A few extra commands answer
// back in character.

export type Files = Readonly<Record<string, string>>;

export interface ShellResult {
  out: string;
  error?: boolean;
  clear?: boolean; // the UI should wipe the screen
}

interface Ctx {
  files: Files;
  history: readonly string[];
}

type Stage = (args: string[], input: string | null, ctx: Ctx) => { out: string; error?: boolean };

const MAX_LINES = 400;

export const COMMANDS = ["ls", "cat", "head", "tail", "grep", "sort", "uniq", "wc", "cut", "awk", "base64", "sha256sum", "xxd", "echo", "history", "clear", "help"];

export function runLine(line: string, files: Files, history: readonly string[] = []): ShellResult {
  const trimmed = line.trim();
  if (!trimmed) return { out: "" };

  let stages: string[][];
  try {
    stages = parse(trimmed);
  } catch (e) {
    return { out: `bash: ${(e as Error).message}`, error: true };
  }
  if (stages.some((s) => s.length === 0)) return { out: "bash: syntax error near unexpected token `|'", error: true };

  if (stages.length === 1 && stages[0][0] === "clear") return { out: "", clear: true };

  const ctx: Ctx = { files, history };
  let data: string | null = null;
  for (const argv of stages) {
    const [name, ...args] = argv;
    const fn = BUILTINS[name] ?? EXTRAS[name];
    if (!fn) return { out: `bash: ${name}: command not found. Type help to see what this terminal can do.`, error: true };
    const r = fn(args, data, ctx);
    if (r.error) return { out: r.out, error: true };
    data = r.out;
  }
  return { out: limit(data ?? "") };
}

/** Lines that would complete the last word: commands first, then file names. */
export function complete(line: string, files: Files): string[] {
  const words = line.split(/\s+/);
  const last = words[words.length - 1] ?? "";
  const first = words.length === 1 || /\|\s*\S*$/.test(line);
  const pool = first ? COMMANDS : Object.keys(files);
  return pool.filter((w) => w.startsWith(last) && w !== last);
}

// ---------- parsing ----------

function parse(line: string): string[][] {
  const stages: string[][] = [[]];
  let word = "";
  let inWord = false;
  let quote: '"' | "'" | null = null;
  const flush = (): void => {
    if (inWord) stages[stages.length - 1].push(word);
    word = "";
    inWord = false;
  };
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quote) {
      if (c === quote) quote = null;
      else if (c === "\\" && quote === '"' && i + 1 < line.length) word += line[++i];
      else word += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      inWord = true;
    } else if (c === "\\" && i + 1 < line.length) {
      word += line[++i];
      inWord = true;
    } else if (c === "|") {
      if (line[i + 1] === "|") throw new Error("|| is not supported here. Use one command at a time.");
      flush();
      stages.push([]);
    } else if (c === ">" || c === "<") {
      throw new Error("evidence is read-only, so redirects are switched off. Pipe into the next command instead.");
    } else if (c === ";" || c === "&") {
      throw new Error("run one command line at a time. Pipes with | are fine.");
    } else if (/\s/.test(c)) {
      flush();
    } else {
      word += c;
      inWord = true;
    }
  }
  if (quote) throw new Error("unexpected end of line: a quote was never closed");
  flush();
  return stages;
}

// ---------- helpers ----------

function lines(text: string): string[] {
  if (text === "") return [];
  return text.replace(/\n$/, "").split("\n");
}

function limit(text: string): string {
  const all = lines(text);
  if (all.length <= MAX_LINES) return all.join("\n");
  return `${all.slice(0, MAX_LINES).join("\n")}\n... ${all.length - MAX_LINES} more lines. Narrow it down with grep, or use head.`;
}

/** Split leading -flags (including grouped ones like -ic) from the rest. */
function flags(args: string[], withValue: string[] = []): { set: Set<string>; values: Map<string, string>; rest: string[] } {
  const set = new Set<string>();
  const values = new Map<string, string>();
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--") {
      rest.push(...args.slice(i + 1));
      break;
    }
    if (a.startsWith("-") && a.length > 1 && rest.length === 0) {
      for (let j = 1; j < a.length; j++) {
        const f = a[j];
        if (withValue.includes(f)) {
          const v = a.slice(j + 1) || args[++i];
          if (v === undefined) throw new Error(`option requires an argument -- '${f}'`);
          values.set(f, v);
          break;
        }
        if (/\d/.test(f)) {
          values.set("n", a.slice(j));
          break;
        }
        set.add(f);
      }
      continue;
    }
    rest.push(a);
  }
  return { set, values, rest };
}

/** Read named files, or stdin when none are named. */
function inputs(cmd: string, names: string[], input: string | null, ctx: Ctx): { name: string; text: string }[] | string {
  if (names.length === 0) {
    if (input === null) return `${cmd}: no input. Name a file (try ls), or pipe something in.`;
    return [{ name: "-", text: input }];
  }
  const out: { name: string; text: string }[] = [];
  for (const n of names) {
    const text = ctx.files[n];
    if (text === undefined) {
      if (n.toLowerCase() === "packet") return PACKET_NOT_A_FILE;
      return `${cmd}: ${n}: No such file or directory`;
    }
    out.push({ name: n, text });
  }
  return out;
}

const fail = (out: string): { out: string; error: true } => ({ out, error: true });

function guard(cmd: string, fn: Stage): Stage {
  return (args, input, ctx) => {
    try {
      return fn(args, input, ctx);
    } catch (e) {
      return fail(`${cmd}: ${(e as Error).message}`);
    }
  };
}

function headTail(cmd: "head" | "tail"): Stage {
  return guard(cmd, (args, input, ctx) => {
    const { values, rest } = flags(args, ["n"]);
    const n = Number(values.get("n") ?? 10);
    if (!Number.isInteger(n) || n < 0) return fail(`${cmd}: invalid number of lines`);
    const src = inputs(cmd, rest, input, ctx);
    if (typeof src === "string") return fail(src);
    const parts = src.map(({ name, text }) => {
      const l = lines(text);
      const pick = cmd === "head" ? l.slice(0, n) : n === 0 ? [] : l.slice(-n);
      return src.length > 1 ? [`==> ${name} <==`, ...pick].join("\n") : pick.join("\n");
    });
    return { out: parts.join("\n\n") };
  });
}

/** Turn a basic grep pattern into a JavaScript regex (+ ? | ( ) { } are literal unless -E). */
function grepRegex(pattern: string, extended: boolean, fixed: boolean, ignoreCase: boolean): RegExp {
  let src: string;
  if (fixed) src = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  else if (extended) src = pattern;
  else src = pattern.replace(/\\([+?|(){}])/g, "\uE000$1").replace(/[+?|(){}]/g, "\\$&").replace(/\uE000/g, "");
  return new RegExp(src, ignoreCase ? "i" : "");
}

function fieldList(spec: string): (n: number) => boolean {
  const parts = spec.split(",").map((p) => {
    const m = /^(\d*)-(\d*)$/.exec(p);
    if (m) {
      const lo = m[1] ? Number(m[1]) : 1;
      const hi = m[2] ? Number(m[2]) : Infinity;
      return (n: number) => n >= lo && n <= hi;
    }
    if (!/^\d+$/.test(p) || Number(p) < 1) throw new Error("fields are numbered from 1, like -f2 or -f2-4");
    return (n: number) => n === Number(p);
  });
  return (n) => parts.some((f) => f(n));
}

function splitFields(line: string, sep: string | undefined): string[] {
  return sep === undefined ? line.trim().split(/\s+/) : line.split(sep);
}

// ---------- the commands ----------

const BUILTINS: Record<string, Stage> = {
  help: () => ({
    out: [
      "Commands in this terminal (real syntax, read-only):",
      "  ls [-l]                      list the case files",
      "  cat FILE                     print a file",
      "  head|tail [-n N] FILE        first or last N lines (default 10)",
      "  grep [-i -v -c -l -n -o -E -F] PATTERN [FILE...]",
      "                               lines matching PATTERN (-i any case, -v not matching, -c count, -l file names)",
      "  sort [-r -n -u -k N -t SEP]  sort lines",
      "  uniq [-c]                    collapse repeated neighbouring lines (-c counts them)",
      "  wc [-l -w -c]                count lines, words, characters",
      "  cut -d SEP -f LIST           pick fields, like -f2 or -f1,3 (tab-separated by default)",
      "  awk [-F SEP] '{print $N}'    print fields; $NF is the last one",
      "  base64 [-d]                  encode, or -d to decode",
      "  sha256sum FILE               fingerprint a file",
      "  xxd [-l N] FILE              show a file's raw bytes in hex (-l: only the first N bytes)",
      "  echo, history, clear",
      "Join commands with |, for example:  cut -f3 conn.log | sort | uniq -c | sort -rn | head",
    ].join("\n"),
  }),

  ls: guard("ls", (args, _input, ctx) => {
    const { set, rest } = flags(args);
    const names = (rest.length ? rest : Object.keys(ctx.files)).slice().sort();
    for (const n of names) if (ctx.files[n] === undefined) return fail(`ls: cannot access '${n}': No such file or directory`);
    if (!set.has("l")) return { out: names.join("  ") };
    const width = Math.max(...names.map((n) => String(ctx.files[n].length).length));
    return {
      out: [`total ${names.length}`, ...names.map((n) => `-r--r--r-- 1 analyst analyst ${String(ctx.files[n].length).padStart(width)} ${n}`)].join("\n"),
    };
  }),

  cat: guard("cat", (args, input, ctx) => {
    const { rest } = flags(args);
    const src = inputs("cat", rest, input, ctx);
    if (typeof src === "string") return src === PACKET_NOT_A_FILE ? { out: src } : fail(src);
    return { out: src.map((s) => s.text.replace(/\n$/, "")).join("\n") };
  }),

  head: headTail("head"),
  tail: headTail("tail"),

  grep: guard("grep", (args, input, ctx) => {
    const { set, rest } = flags(args);
    const [pattern, ...names] = rest;
    if (pattern === undefined) return fail("grep: usage: grep [-i -v -c -l -n -o -E -F] PATTERN [FILE...]");
    let re: RegExp;
    try {
      re = grepRegex(pattern, set.has("E"), set.has("F"), set.has("i"));
    } catch {
      return fail(`grep: invalid pattern: ${pattern}`);
    }
    const src = inputs("grep", names, input, ctx);
    if (typeof src === "string") return fail(src);
    const out: string[] = [];
    for (const { name, text } of src) {
      const prefix = src.length > 1 ? `${name}:` : "";
      let count = 0;
      lines(text).forEach((l, i) => {
        const hit = re.test(l) !== set.has("v");
        if (!hit) return;
        count++;
        if (set.has("c") || set.has("l")) return;
        if (set.has("o") && !set.has("v")) {
          const g = new RegExp(re.source, re.flags + "g");
          for (const m of l.match(g) ?? []) out.push(`${prefix}${set.has("n") ? `${i + 1}:` : ""}${m}`);
        } else {
          out.push(`${prefix}${set.has("n") ? `${i + 1}:` : ""}${l}`);
        }
      });
      if (set.has("l")) {
        if (count > 0) out.push(name);
      } else if (set.has("c")) out.push(`${prefix}${count}`);
    }
    return { out: out.join("\n") };
  }),

  sort: guard("sort", (args, input, ctx) => {
    const { set, values, rest } = flags(args, ["k", "t"]);
    const src = inputs("sort", rest, input, ctx);
    if (typeof src === "string") return fail(src);
    const key = values.has("k") ? Number.parseInt(values.get("k")!, 10) : 0;
    if (values.has("k") && !(key >= 1)) return fail("sort: fields for -k are numbered from 1");
    const sep = values.get("t");
    const keyOf = (l: string): string => (key ? (splitFields(l, sep)[key - 1] ?? "") : l);
    const numeric = set.has("n");
    const num = (s: string): number => {
      const m = /^\s*(-?\d+(\.\d+)?)/.exec(s);
      return m ? Number(m[1]) : 0;
    };
    let all = src.flatMap((s) => lines(s.text));
    all.sort((a, b) => {
      const ka = keyOf(a);
      const kb = keyOf(b);
      const c = numeric ? num(ka) - num(kb) : ka < kb ? -1 : ka > kb ? 1 : 0;
      return c !== 0 ? c : a < b ? -1 : a > b ? 1 : 0;
    });
    if (set.has("r")) all.reverse();
    if (set.has("u")) all = all.filter((l, i) => i === 0 || keyOf(l) !== keyOf(all[i - 1]));
    return { out: all.join("\n") };
  }),

  uniq: guard("uniq", (args, input, ctx) => {
    const { set, rest } = flags(args);
    const src = inputs("uniq", rest, input, ctx);
    if (typeof src === "string") return fail(src);
    const out: string[] = [];
    let prev: string | null = null;
    let n = 0;
    const emit = (): void => {
      if (prev !== null) out.push(set.has("c") ? `${String(n).padStart(7)} ${prev}` : prev);
    };
    for (const l of src.flatMap((s) => lines(s.text))) {
      if (l === prev) n++;
      else {
        emit();
        prev = l;
        n = 1;
      }
    }
    emit();
    return { out: out.join("\n") };
  }),

  wc: guard("wc", (args, input, ctx) => {
    const { set, rest } = flags(args);
    const src = inputs("wc", rest, input, ctx);
    if (typeof src === "string") return fail(src);
    const pick = set.size ? set : new Set(["l", "w", "c"]);
    const row = (text: string, name: string): string => {
      const parts: string[] = [];
      if (pick.has("l")) parts.push(String((text.match(/\n/g) ?? []).length + (text && !text.endsWith("\n") ? 1 : 0)));
      if (pick.has("w")) parts.push(String(text.split(/\s+/).filter(Boolean).length));
      if (pick.has("c")) parts.push(String(new TextEncoder().encode(text).length));
      return (parts.length === 1 ? parts[0] : parts.map((p) => p.padStart(7)).join(" ")) + (name === "-" ? "" : ` ${name}`);
    };
    return { out: src.map((s) => row(s.text, s.name)).join("\n") };
  }),

  cut: guard("cut", (args, input, ctx) => {
    const { values, rest } = flags(args, ["d", "f"]);
    if (!values.has("f")) return fail("cut: you must specify a list of fields, like -f2");
    const sep = values.get("d") ?? "\t";
    if (sep.length !== 1) return fail("cut: the delimiter must be a single character");
    const want = fieldList(values.get("f")!);
    const src = inputs("cut", rest, input, ctx);
    if (typeof src === "string") return fail(src);
    const out = src
      .flatMap((s) => lines(s.text))
      .map((l) => (l.includes(sep) ? l.split(sep).filter((_, i) => want(i + 1)).join(sep) : l));
    return { out: out.join("\n") };
  }),

  awk: guard("awk", (args, input, ctx) => {
    const { values, rest } = flags(args, ["F"]);
    const [program, ...names] = rest;
    const m = /^\s*\{\s*print\s*(.*?)\s*;?\s*\}\s*$/.exec(program ?? "");
    if (!m) return fail("awk: this terminal understands one program shape: awk '{print $1, $3}'");
    const exprs = m[1] ? m[1].split(/\s*,\s*/) : ["$0"];
    for (const e of exprs) if (!/^\$(\d+|NF)$/.test(e)) return fail(`awk: cannot print ${e}. Use fields like $1, $3 or $NF`);
    const sep = values.get("F");
    const src = inputs("awk", names, input, ctx);
    if (typeof src === "string") return fail(src);
    const out = src
      .flatMap((s) => lines(s.text))
      .map((l) => {
        const f = splitFields(l, sep === "\\t" ? "\t" : sep);
        return exprs
          .map((e) => (e === "$0" ? l : e === "$NF" ? (f[f.length - 1] ?? "") : (f[Number(e.slice(1)) - 1] ?? "")))
          .join(" ");
      });
    return { out: out.join("\n") };
  }),

  base64: guard("base64", (args, input, ctx) => {
    const { set, rest } = flags(args);
    const src = inputs("base64", rest, input, ctx);
    if (typeof src === "string") return fail(src);
    const text = src.map((s) => s.text).join("");
    if (set.has("d")) {
      try {
        const bin = atob(text.replace(/\s+/g, ""));
        return { out: new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))) };
      } catch {
        return fail("base64: invalid input");
      }
    }
    let bin = "";
    for (const b of new TextEncoder().encode(text)) bin += String.fromCharCode(b);
    return { out: btoa(bin) };
  }),

  sha256sum: guard("sha256sum", (args, input, ctx) => {
    const { rest } = flags(args);
    const src = inputs("sha256sum", rest, input, ctx);
    if (typeof src === "string") return fail(src);
    return { out: src.map((s) => `${sha256(s.text)}  ${s.name}`).join("\n") };
  }),

  // The classic hex dump: offset, 16 bytes as hex in pairs, then the printable
  // characters. Files hold one byte per character, so binaries survive intact.
  xxd: guard("xxd", (args, input, ctx) => {
    const { values, rest } = flags(args, ["l"]);
    const max = values.has("l") ? Number(values.get("l")) : Infinity;
    if (Number.isNaN(max) || max < 0) return fail("xxd: -l needs a number of bytes");
    const src = inputs("xxd", rest.slice(0, 1), input, ctx);
    if (typeof src === "string") return fail(src);
    const text = src[0].text.slice(0, max);
    const out: string[] = [];
    for (let off = 0; off < text.length; off += 16) {
      const chunk = [...text.slice(off, off + 16)].map((c) => c.charCodeAt(0) & 0xff);
      const hex = chunk.map((b) => b.toString(16).padStart(2, "0"));
      const pairs: string[] = [];
      for (let i = 0; i < 16; i += 2) pairs.push((hex[i] ?? "  ") + (hex[i + 1] ?? "  "));
      const ascii = chunk.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".")).join("");
      out.push(`${off.toString(16).padStart(8, "0")}: ${pairs.join(" ")}  ${ascii}`);
    }
    return { out: out.join("\n") };
  }),

  echo: (args) => ({ out: args.join(" ") }),
  history: (_args, _input, ctx) => ({ out: ctx.history.map((h, i) => `${String(i + 1).padStart(5)}  ${h}`).join("\n") }),
};

// ---------- things people try ----------

const PACKET_NOT_A_FILE = [" /\\_/\\", "( o.o )  Packet is not a file. Packet is a cat.", " > ^ <   She has walked across this keyboard before."].join("\n");

const say = (text: string): Stage => () => ({ out: text });

const EXTRAS: Record<string, Stage> = {
  sudo: say("analyst is not in the sudoers file. This incident will be reported. (To Mags. She will be thrilled.)"),
  su: say("su: Authentication failure. Nice try."),
  rm: say("rm: this is evidence. Nothing here can be deleted, and Dr. Vance has been notified."),
  mv: say("mv: evidence stays exactly where it was found."),
  cp: say("cp: copies are made in the forensics lab, with a hash, by the book."),
  touch: say("touch: do not touch the evidence."),
  vim: say("No editors on evidence. Also, nobody here agrees on which one is best."),
  vi: say("No editors on evidence. Also, nobody here agrees on which one is best."),
  nano: say("No editors on evidence. Also, nobody here agrees on which one is best."),
  emacs: say("No editors on evidence. Also, nobody here agrees on which one is best."),
  exit: say("There is no leaving. There is only the queue."),
  logout: say("There is no leaving. There is only the queue."),
  ping: say("This box is cut off from the network for your safety. Nothing goes out."),
  curl: say("This box is cut off from the network for your safety. Nothing goes out."),
  wget: say("This box is cut off from the network for your safety. Nothing goes out."),
  ssh: say("This box is cut off from the network for your safety. Nothing goes out."),
  whoami: say("analyst"),
  hostname: say("lh-analysis-04"),
  pwd: say("/cases/current"),
  cd: say("You are already where the evidence is."),
  date: say("It is later than you think. The queue does not care."),
  man: say("No manual pages here. Type help for the short version."),
  coffee: say("Theo's coffee fund is empty again. It is always empty again."),
  file: say("file: not installed on this box. Dr. Vance says read the magic bytes yourself: xxd -l 32 FILE"),
  strings: say("strings: not installed on this box. grep works on binaries too: grep -o 'text' FILE"),
  meow: say(PACKET_NOT_A_FILE),
};
