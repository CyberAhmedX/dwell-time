import { describe, it, expect } from "vitest";
import { INTERVIEWS } from "../src/content/interviews";
import { TICKETS } from "../src/content/tickets";
import { SCENES } from "../src/content/scenes";
import { CHAPTERS } from "../src/content/chapters";
import { CODEX } from "../src/content/codex";
import { ENDINGS } from "../src/engine/endings";

// Gather every string of player-facing text so we can assert house rules on it.
function allText(): string[] {
  const out: string[] = [];
  const push = (s?: string): void => {
    if (typeof s === "string") out.push(s);
  };

  for (const iv of INTERVIEWS) {
    iv.intro.forEach(push);
    iv.hiredText.forEach(push);
    iv.rejectedText.forEach(push);
    for (const q of iv.questions) {
      push(q.prompt);
      q.options.forEach(push);
      push(q.explainRight);
      push(q.explainWrong);
    }
  }
  for (const t of TICKETS) {
    push(t.title);
    push(t.brief.join(" "));
    t.closingRight.forEach(push);
    for (const ev of t.evidence) {
      push(ev.label);
      if (ev.kind === "email") {
        push(ev.from);
        push(ev.to);
        push(ev.subject);
        ev.body.forEach(push);
        if (ev.headers) Object.values(ev.headers).forEach(push);
      } else if (ev.kind === "log") {
        ev.rows.forEach((r) => r.forEach(push));
      } else if (ev.kind === "chat") {
        ev.lines.forEach((l) => push(l.text));
      } else if (ev.kind === "flow") {
        ev.rows.forEach((r) => {
          push(r.src);
          push(r.dst);
          push(r.note);
        });
      } else if (ev.kind === "note") {
        push(ev.title);
        ev.lines.forEach(push);
      } else if (ev.kind === "timeline") {
        ev.events.forEach((e) => push(e.text));
      } else if (ev.kind === "tree") {
        const walk = (n: { name: string; detail?: string; children?: unknown[] }): void => {
          push(n.name);
          push(n.detail);
          (n.children as typeof n[] | undefined)?.forEach(walk);
        };
        walk(ev.root);
      }
    }
    for (const q of t.questions) {
      push(q.prompt);
      if (q.type === "single" || q.type === "multi") {
        q.options.forEach(push);
        push(q.explainRight);
        push(q.explainWrong);
      } else if (q.type === "order") {
        q.items.forEach(push);
        push(q.explainRight);
        push(q.explainWrong);
      } else {
        for (const o of q.options) {
          push(o.text);
          push(o.result);
        }
      }
    }
  }
  for (const s of SCENES) {
    s.lines.forEach((l) => push(l.text));
    if (s.choice) {
      push(s.choice.prompt);
      for (const o of s.choice.options) {
        push(o.text);
        o.reply?.forEach((l) => push(l.text));
      }
    }
  }
  for (const c of CODEX) {
    push(c.term);
    c.body.forEach(push);
  }
  for (const e of Object.values(ENDINGS)) {
    push(e.title);
    push(e.epigraph);
    e.lines.forEach(push);
    push(e.rankTitle);
    push(e.hint);
  }
  return out;
}

describe("writing house rules", () => {
  const text = allText();

  it("contains no em dashes or en dashes", () => {
    const offenders = text.filter((s) => s.includes("—") || s.includes("–"));
    expect(offenders).toEqual([]);
  });

  it("uses only reserved documentation IP ranges", () => {
    // Any dotted quad that appears must be in a documentation or private range.
    const quad = /\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/g;
    const allowed = (ip: string): boolean => {
      const [a, b] = ip.split(".").map(Number);
      if (a === 192 && b === 0) return true; // 192.0.2.0/24 documentation (and 192.0.x)
      if (a === 198 && b === 51) return true; // 198.51.100.0/24
      if (a === 203 && b === 0) return true; // 203.0.113.0/24
      if (a === 10) return true; // private
      if (a === 192 && b === 168) return true; // private
      if (a === 172 && b >= 16 && b <= 31) return true; // private
      return false;
    };
    const bad: string[] = [];
    for (const s of text) {
      const matches = s.match(quad);
      if (!matches) continue;
      for (const m of matches) if (!allowed(m)) bad.push(m);
    }
    expect(bad).toEqual([]);
  });

  it("never references a real public TLD (domains stay in .example/.test)", () => {
    // The real risk is a domain that points at a live system. Flag any token
    // ending in a genuine public TLD. Fictional usernames like "w.abernathy"
    // and process names like "services.host" are not domains and are fine.
    const realTld =
      /\b[a-z0-9-]+\.(com|net|org|io|gov|edu|co|us|uk|dev|app|info|biz|ai|xyz|cloud|online|site|tech|me|ru|cn|de|fr)\b/i;
    const bad = text.filter((s) => realTld.test(s));
    expect(bad).toEqual([]);
  });

  it("defangs any http links", () => {
    const offenders = text.filter((s) => /https?:\/\//i.test(s));
    expect(offenders).toEqual([]);
  });
});

describe("content integrity", () => {
  it("every chapter references scenes and tickets that exist", () => {
    const sceneIds = new Set(SCENES.map((s) => s.id));
    const ticketIds = new Set(TICKETS.map((t) => t.id));
    for (const ch of CHAPTERS) {
      expect(sceneIds.has(ch.intro), `intro ${ch.intro}`).toBe(true);
      for (const m of ch.main) expect(ticketIds.has(m), `main ticket ${m}`).toBe(true);
      for (const s of ch.side) expect(ticketIds.has(s), `side ticket ${s}`).toBe(true);
      for (const o of ch.outro) expect(sceneIds.has(o), `outro ${o}`).toBe(true);
    }
  });

  it("single and multi questions have valid answer indices", () => {
    for (const t of TICKETS) {
      for (const q of t.questions) {
        if (q.type === "single") {
          expect(q.answer).toBeGreaterThanOrEqual(0);
          expect(q.answer).toBeLessThan(q.options.length);
        } else if (q.type === "multi") {
          expect(q.answer.length).toBeGreaterThan(0);
          for (const a of q.answer) expect(a).toBeLessThan(q.options.length);
        }
      }
    }
    for (const iv of INTERVIEWS) {
      for (const q of iv.questions) {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
    }
  });

  it("every ticket requirement flag is produced somewhere", () => {
    const produced = new Set<string>();
    for (const t of TICKETS) (t.setFlags ?? []).forEach((f) => produced.add(f));
    for (const s of SCENES) {
      (s.setFlags ?? []).forEach((f) => produced.add(f));
      s.choice?.options.forEach((o) => (o.setFlags ?? []).forEach((f) => produced.add(f)));
    }
    for (const t of TICKETS) {
      t.questions.forEach((q) => {
        if (q.type === "decision") q.options.forEach((o) => (o.setFlags ?? []).forEach((f) => produced.add(f)));
      });
    }
    for (const t of TICKETS) {
      for (const req of t.requires ?? []) {
        expect(produced.has(req), `requirement ${req} for ${t.id} is never set`).toBe(true);
      }
    }
  });

  it("each interview is winnable and losable", () => {
    for (const iv of INTERVIEWS) {
      expect(iv.passLine).toBeGreaterThan(0);
      expect(iv.passLine).toBeLessThanOrEqual(iv.questions.length);
    }
  });
});

// Quiz-writing house rule: the right answer must not stand out by length.
// When the correct option is always the longest, players learn to pick the
// longest option instead of reading the evidence.
describe("answer options do not give the answer away", () => {
  const singles = [
    ...TICKETS.flatMap((t) => t.questions),
    ...INTERVIEWS.flatMap((iv) => iv.questions),
  ].filter((q) => q.type === "single");

  it("the correct option is never much longer than the longest wrong one", () => {
    for (const q of singles) {
      if (q.type !== "single") continue;
      const right = q.options[q.answer].length;
      const longestWrong = Math.max(...q.options.filter((_, i) => i !== q.answer).map((o) => o.length));
      expect(right, `${q.id}: correct option is ${right} characters, longest wrong one is ${longestWrong}`).toBeLessThanOrEqual(longestWrong * 1.15);
    }
  });

  it("the correct option is the longest in at most a third of the questions", () => {
    const longest = singles.filter((q) => {
      if (q.type !== "single") return false;
      const lens = q.options.map((o) => o.length);
      return lens[q.answer] === Math.max(...lens) && lens.filter((l) => l === lens[q.answer]).length === 1;
    });
    expect(longest.length, longest.map((q) => q.id).join(", ")).toBeLessThanOrEqual(Math.floor(singles.length / 3));
  });
});
