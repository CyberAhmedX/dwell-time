import type { CvssQuestion, DetectQuestion, IocQuestion, MapQuestion, ReportQuestion, ScopeEvidence, ScopeQuestion } from "../engine/types";
import { testRule } from "../engine/detect";
import { checkReport, countWords } from "../engine/report";
import type { SaveData } from "../engine/state";
import { checkScope } from "../engine/scope";
import { METRICS, METRIC_INFO, baseScore, parseVector, severity, vectorString, type Metric, type Vector } from "../engine/cvss";
import { defang, gradeIocs } from "../engine/ioc";
import { normalizeAnswer } from "../engine/answer";
import { audio } from "../audio/audio";
import { el, mount, shuffled } from "./dom";

// The answer side of a case: one control per question, all with the same
// shape, so the workstation can check, mark and reveal them alike. The newer
// hands-on question types live here; app.ts builds the classic ones.

export interface QuestionControl {
  ready(): boolean;
  correct(): boolean;
  reveal(): void;
  /** After a wrong submit: say whether this answer is right, without showing the right option. */
  mark(): void;
  apply(save: SaveData): void;
  focus(): void;
}

export function markBlock(wrap: HTMLElement, right: boolean, detail?: string): void {
  wrap.classList.toggle("q-right", right);
  wrap.classList.toggle("q-wrong", !right);
  let note = wrap.querySelector<HTMLElement>(".q-mark");
  if (!note) {
    note = el("p", { class: "q-mark" });
    wrap.insertBefore(note, wrap.children[1] ?? null);
    // the mark goes away as soon as the answer is changed
    const drop = (e: Event): void => {
      const t = e.target as HTMLElement;
      if (e.type === "input" || t.closest("button")) {
        wrap.classList.remove("q-right", "q-wrong");
        note?.remove();
        wrap.removeEventListener("click", drop);
        wrap.removeEventListener("input", drop);
      }
    };
    wrap.addEventListener("click", drop);
    wrap.addEventListener("input", drop);
  }
  note.textContent = right ? "Correct" : `Not right yet${detail ? `: ${detail}` : ""}`;
}

export function scrollMotion(): ScrollBehavior {
  return document.documentElement.classList.contains("reduce-motion") ? "auto" : "smooth";
}

function explainBox(wrap: HTMLElement): HTMLElement {
  const expl = el("div", { class: "explain", hidden: true });
  wrap.append(expl);
  return expl;
}

function showExplain(expl: HTMLElement, right: boolean, q: { explainRight: string; explainWrong: string }, ...more: HTMLElement[]): void {
  expl.hidden = false;
  expl.className = right ? "explain good" : "explain bad";
  mount(expl, el("p", { text: right ? q.explainRight : q.explainWrong }), ...more);
}

// ---------- scope ----------

export function scopeQuestion(q: ScopeQuestion, wrap: HTMLElement, ev: ScopeEvidence): QuestionControl {
  const verdicts = q.targets.map((t) => checkScope(ev, t.address));
  const sel = new Set<number>();
  const shown = shuffled(q.targets.map((_, i) => i));
  const opts = el("div", { class: "q-opts" });
  shown.forEach((i) => {
    const t = q.targets[i];
    const b = el("button", { class: "opt check", type: "button" }, [
      el("span", { class: "box" }),
      el("span", {}, [el("span", { class: "mono", text: t.address }), el("span", { class: "sc-what", text: ` ${t.what}` })]),
    ]);
    b.addEventListener("click", () => {
      if (sel.has(i)) sel.delete(i);
      else sel.add(i);
      b.classList.toggle("sel", sel.has(i));
      audio.type();
    });
    opts.append(b);
  });
  wrap.append(el("p", { class: "rules-progress", text: "Tick every target you may test. Leave the rest alone." }), opts);
  const expl = explainBox(wrap);
  const isRight = (): boolean => verdicts.every((v, i) => v.inScope === sel.has(i));
  return {
    ready: () => true,
    correct: isRight,
    reveal: () => {
      [...opts.children].forEach((c, pos) => {
        const i = shown[pos];
        c.classList.add("locked");
        c.classList.toggle("correct", verdicts[i].inScope);
        c.classList.toggle("wrong", sel.has(i) !== verdicts[i].inScope);
      });
      showExplain(
        expl,
        isRight(),
        q,
        el("ul", { class: "goal-list" }, q.targets.map((t, i) => el("li", { class: verdicts[i].inScope ? "met" : "missed" }, [el("span", { class: "goal-mark", text: verdicts[i].inScope ? "In" : "Out" }), el("span", { text: `${t.address}: ${verdicts[i].reason}` })]))),
      );
    },
    mark: () => markBlock(wrap, isRight()),
    apply: () => {},
    focus: () => wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" }),
  };
}

// ---------- CVSS ----------

export function cvssQuestion(q: CvssQuestion, wrap: HTMLElement): QuestionControl {
  const want = parseVector(q.vector);
  const picked: Partial<Vector> = {};
  const score = el("p", { class: "cvss-score", role: "status", text: "Pick a value for every metric to see the score." });
  const rows = METRICS.map((m) => {
    const info = METRIC_INFO[m];
    const group = el("div", { class: "seg", role: "group", "aria-label": info.name });
    for (const v of info.values) {
      const b = el("button", { class: "seg-btn", type: "button", text: v.label, "aria-pressed": "false", "data-metric": m, "data-value": v.v });
      b.addEventListener("click", () => {
        picked[m] = v.v;
        group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
        audio.type();
        update();
      });
      group.append(b);
    }
    return el("div", { class: "cvss-row", "data-metric": m }, [
      el("div", { class: "cvss-label" }, [el("span", { class: "cvss-name", text: `${info.name} (${m})` }), el("span", { class: "cvss-q", text: info.question })]),
      group,
    ]);
  });
  const complete = (): boolean => METRICS.every((m) => picked[m] !== undefined);
  const update = (): void => {
    if (!complete()) {
      score.textContent = `${vectorString(picked)}. Pick a value for every metric to see the score.`;
      return;
    }
    const s = baseScore(picked as Vector);
    score.textContent = `${vectorString(picked)}  =  ${s.toFixed(1)} ${severity(s)}`;
  };
  wrap.append(el("div", { class: "cvss" }, rows), score);
  const expl = explainBox(wrap);
  const isRight = (): boolean => complete() && METRICS.every((m) => picked[m] === want[m]);
  return {
    ready: complete,
    correct: isRight,
    reveal: () => {
      wrap.querySelectorAll<HTMLButtonElement>(".cvss .seg-btn").forEach((b) => {
        b.disabled = true;
        const m = b.dataset.metric as Metric;
        b.classList.toggle("seg-right", b.dataset.value === want[m]);
      });
      const s = baseScore(want);
      showExplain(
        expl,
        isRight(),
        q,
        el("p", { class: "typed-answer", text: `The rating: ${vectorString(want)}, ${s.toFixed(1)} ${severity(s)}` }),
        el("ul", { class: "goal-list" }, METRICS.map((m) => {
          const ok = picked[m] === want[m];
          const label = METRIC_INFO[m].values.find((v) => v.v === want[m])!.label;
          return el("li", { class: ok ? "met" : "missed" }, [el("span", { class: "goal-mark", text: ok ? "Right" : "Wrong" }), el("span", { text: `${METRIC_INFO[m].name}: ${label}. ${q.why[m] ?? ""}`.trim() })]);
        })),
      );
    },
    mark: () => {
      const off = METRICS.filter((m) => picked[m] !== want[m]).length;
      markBlock(wrap, isRight(), `${off} metric${off === 1 ? "" : "s"} rated differently from the finding`);
    },
    apply: () => {},
    focus: () => wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" }),
  };
}

// ---------- IOCs ----------

export function iocQuestion(q: IocQuestion, wrap: HTMLElement): QuestionControl {
  const box = el("textarea", {
    class: "fw-rules ioc-input",
    rows: Math.max(4, q.answer.length + 1),
    placeholder: "One indicator per line, defanged, like bad[.]example",
    "aria-label": q.prompt,
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
  }) as HTMLTextAreaElement;
  wrap.append(box);
  const expl = explainBox(wrap);
  const grade = () => gradeIocs(box.value, q.answer);
  return {
    ready: () => box.value.trim() !== "",
    correct: () => grade().ok,
    reveal: () => {
      box.readOnly = true;
      const g = grade();
      const notes: HTMLElement[] = [el("p", { class: "typed-way", text: "The block list:" }), el("pre", { class: "rules-solution", text: q.answer.map(defang).join("\n") })];
      if (g.live.length) notes.unshift(el("p", { class: "typed-answer", text: `Not defanged: ${g.live.join(", ")}` }));
      showExplain(expl, g.ok, q, ...notes);
    },
    mark: () => {
      const g = grade();
      const bits = [g.missing.length ? `${g.missing.length} missing` : "", g.extra.length ? `${g.extra.length} that do not belong` : "", g.live.length ? `${g.live.length} not defanged` : ""].filter(Boolean);
      markBlock(wrap, g.ok, bits.join(", "));
    },
    apply: () => {},
    focus: () => {
      wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" });
      box.focus({ preventScroll: true });
    },
  };
}

// ---------- ATT&CK mapping ----------

export function mapQuestion(q: MapQuestion, wrap: HTMLElement): QuestionControl {
  const inputs = q.items.map((it) => {
    const input = el("input", { class: "typed-input map-input", type: "text", placeholder: "T....", "aria-label": `Technique ID for: ${it.behavior}`, autocomplete: "off", autocapitalize: "characters", spellcheck: "false" }) as HTMLInputElement;
    return { it, input };
  });
  wrap.append(el("div", { class: "map-list" }, inputs.map(({ it, input }) => el("label", { class: "map-row" }, [el("span", { class: "map-behavior", text: it.behavior }), input]))));
  const expl = explainBox(wrap);
  const norm = (s: string): string => normalizeAnswer(s).toUpperCase().replace(/\s+/g, "");
  const ok = (i: number): boolean => inputs[i].it.answer.map(norm).includes(norm(inputs[i].input.value));
  const isRight = (): boolean => inputs.every((_, i) => ok(i));
  return {
    ready: () => inputs.every(({ input }) => input.value.trim() !== ""),
    correct: isRight,
    reveal: () => {
      inputs.forEach(({ input }, i) => {
        input.readOnly = true;
        input.classList.toggle("right", ok(i));
        input.classList.toggle("wrong", !ok(i));
      });
      showExplain(
        expl,
        isRight(),
        q,
        el("ul", { class: "goal-list" }, inputs.map(({ it }, i) => el("li", { class: ok(i) ? "met" : "missed" }, [el("span", { class: "goal-mark", text: it.answer[0] }), el("span", { text: it.behavior })]))),
      );
    },
    mark: () => {
      inputs.forEach(({ input }, i) => {
        input.classList.toggle("right", ok(i));
        input.classList.toggle("wrong", !ok(i));
      });
      const n = inputs.filter((_, i) => !ok(i)).length;
      markBlock(wrap, isRight(), `${n} of ${inputs.length} mapped wrong`);
    },
    apply: () => {},
    focus: () => {
      wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" });
      inputs.find((_, i) => !ok(i))?.input.focus({ preventScroll: true });
    },
  };
}

// ---------- detection rule ----------

export function detectQuestion(q: DetectQuestion, wrap: HTMLElement): QuestionControl {
  const editor = el("textarea", { class: "fw-rules det-rule", rows: 3, spellcheck: "false", autocapitalize: "off", autocomplete: "off", "aria-label": "Your detection rule" }) as HTMLTextAreaElement;
  editor.value = q.start;
  const run = el("button", { class: "btn primary small", type: "button", text: "Test rule" });
  const reset = el("button", { class: "btn ghost small", type: "button", text: "Reset rule" });
  const status = el("p", { class: "fw-status", role: "status" });
  const results = el("div", { class: "fw-results" });
  const fields = Object.keys(q.tests[0].event);
  wrap.append(
    el("p", { class: "fw-help", text: "A rule is one SIEM search, judged event by event. Test it against the replay: it must alert on every attack and stay quiet on everything else." }),
    editor,
    el("div", { class: "btn-row" }, [run, reset]),
    status,
    results,
  );
  const draw = (): void => {
    const r = testRule(editor.value, q.tests);
    if (r.error) {
      status.className = "fw-status err";
      status.textContent = `Rule error: ${r.error}`;
      results.replaceChildren();
      return;
    }
    status.className = r.ok ? "fw-status good" : "fw-status";
    status.textContent = `Caught ${r.caught.length} of ${r.caught.length + r.missed.length} attacks, ${r.falseAlarms.length} false alarm${r.falseAlarms.length === 1 ? "" : "s"}.`;
    const rows = q.tests.map((t, i) => {
      const fired = r.caught.includes(i) || r.falseAlarms.includes(i);
      const good = (t.want === "alert") === fired;
      return el("tr", { class: good ? "fw-ok" : "fw-bad" }, [
        el("td", {}, [el("div", { text: t.what }), el("div", { class: "fw-flow mono", text: fields.map((f) => `${f}=${t.event[f]}`).join(" ") })]),
        el("td", { class: "fw-act", text: t.want === "alert" ? "ATTACK" : "NORMAL" }),
        el("td", { class: "fw-verdict", text: fired ? (good ? "alerted" : "false alarm") : good ? "quiet" : "missed" }),
      ]);
    });
    mount(results, el("div", { class: "log-scroll" }, [el("table", { class: "log fw-table" }, [el("thead", {}, [el("tr", {}, ["Replayed event", "Is", "Your rule"].map((h) => el("th", { text: h })))]), el("tbody", {}, rows)])]));
  };
  run.addEventListener("click", () => {
    audio.click();
    draw();
    wrap.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "siem", evidence: q.id, line: editor.value } }));
  });
  reset.addEventListener("click", () => {
    editor.value = q.start;
    draw();
  });
  draw();
  const expl = explainBox(wrap);
  const isRight = (): boolean => testRule(editor.value, q.tests).ok;
  return {
    ready: () => true,
    correct: isRight,
    reveal: () => {
      editor.readOnly = true;
      draw();
      showExplain(expl, isRight(), q, el("p", { class: "typed-way", text: "One rule that works:" }), el("pre", { class: "rules-solution", text: q.solution }));
    },
    mark: () => markBlock(wrap, isRight()),
    apply: () => {},
    focus: () => {
      wrap.scrollIntoView({ behavior: scrollMotion(), block: "start" });
      editor.focus({ preventScroll: true });
    },
  };
}

// ---------- incident report ----------

export function reportQuestion(q: ReportQuestion, wrap: HTMLElement): QuestionControl {
  const box = el("textarea", { class: "report-input", rows: 8, placeholder: "Write it for someone who was not in the room: what happened, how, what you did, and what happens next.", "aria-label": q.prompt }) as HTMLTextAreaElement;
  const count = el("p", { class: "report-count", text: `0 words. At least ${q.minWords}.` });
  box.addEventListener("input", () => {
    const n = countWords(box.value);
    count.textContent = `${n} word${n === 1 ? "" : "s"}. At least ${q.minWords}.`;
  });
  wrap.append(el("p", { class: "fw-help", text: `The report must cover: ${q.facts.map((f) => f.label.toLowerCase()).join("; ")}.` }), box, count);
  const expl = explainBox(wrap);
  const grade = () => checkReport(box.value, q.facts, q.minWords);
  return {
    ready: () => box.value.trim() !== "",
    correct: () => grade().ok,
    reveal: () => {
      box.readOnly = true;
      const g = grade();
      showExplain(
        expl,
        g.ok,
        q,
        el("ul", { class: "goal-list" }, q.facts.map((f, i) => el("li", { class: g.covered[i] ? "met" : "missed" }, [el("span", { class: "goal-mark", text: g.covered[i] ? "Covered" : "Missing" }), el("span", { text: f.label })]))),
        el("p", { class: "typed-way", text: "A report that covers it all:" }),
        el("p", { class: "report-example", text: q.example }),
      );
    },
    mark: () => {
      const g = grade();
      const missing = q.facts.filter((_, i) => !g.covered[i]).map((f) => f.label.toLowerCase());
      const bits = [g.words < q.minWords ? `too short (${g.words} of ${q.minWords} words)` : "", missing.length ? `missing ${missing.join("; ")}` : ""].filter(Boolean);
      markBlock(wrap, g.ok, bits.join(", "));
    },
    apply: () => {},
    focus: () => {
      wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" });
      box.focus({ preventScroll: true });
    },
  };
}
