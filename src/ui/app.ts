import type { Chapter, Dept, Evidence, Scene, SceneChoice, Ticket, Question } from "../engine/types";
import { DEPTS, DEPT_LABEL } from "../engine/types";
import {
  type SaveData,
  freshSave,
  load,
  save,
  wipe,
  rankTitle,
  rankIndex,
  rankProgress,
  conduct,
  accuracy,
  hasAll,
  hasNone,
  setFlag,
  markDone,
  isDone,
  unlockCodex,
  xpForClose,
  hasFlag,
  HINT_COST,
  trackFlag,
} from "../engine/state";
import { pickTargets } from "../engine/pick";
import { resolveEnding, ENDINGS, ENDING_ORDER } from "../engine/endings";
import {
  type MetaData,
  TEXT_SCALES,
  loadMeta,
  saveMeta,
  wipeMeta,
  freshMeta,
  recordEnding,
  recordCodex,
  recordCheckpoint,
  checkpointCopy,
  canSelectChapter,
} from "../engine/meta";
import { ACHIEVEMENTS, checkAchievements } from "../engine/achievements";
import { OfficeScene } from "../scene/office";
import { drawPortrait } from "../scene/portraits";
import { audio } from "../audio/audio";
import { CHARACTERS, charName } from "../content/characters";
import { INTERVIEWS, interviewFor } from "../content/interviews";
import { TICKETS, ticketById } from "../content/tickets";
import { SCENES, sceneById } from "../content/scenes";
import { CHAPTERS, chapterPlan } from "../content/chapters";
import { CODEX } from "../content/codex";
import { el, mount, clear, shuffled } from "./dom";
import { renderEvidence } from "./evidence";

export class App {
  private root: HTMLElement;
  private stage: HTMLElement;
  private topbar: HTMLElement;
  private scene: OfficeScene;
  private s: SaveData;
  private meta: MetaData;
  private toasts: HTMLElement;
  // The title screen opens every visit, so returning players press Continue,
  // and that click is what lets the browser start the audio.
  private started = false;

  constructor(root: HTMLElement, bgCanvas: HTMLCanvasElement) {
    this.root = root;
    this.scene = new OfficeScene(bgCanvas);
    this.s = load();
    // saves from before track cases existed: give them their track flag
    if (this.s.hired && this.s.track) setFlag(this.s, trackFlag(this.s.track));
    this.meta = loadMeta();
    this.topbar = el("div", { class: "topbar", role: "banner" });
    this.stage = el("div", { class: "stage" });
    this.toasts = el("div", { class: "toasts", role: "status", "aria-live": "polite" });
    mount(this.root, this.topbar, this.stage, this.toasts);
    this.applySettings();
    this.scene.setChapter(this.s.chapter);
    this.scene.start();
    this.render();
  }

  private persist(): void {
    save(this.s);
    recordCodex(this.meta, this.s.codex);
    for (const a of checkAchievements(this.s, this.meta)) this.showToast(`Achievement: ${a.title}`);
    saveMeta(this.meta);
  }

  private applySettings(): void {
    const set = this.meta.settings;
    audio.setMuted(set.muted);
    audio.setMusicVolume(set.music);
    audio.setEffectsVolume(set.effects);
    document.documentElement.style.setProperty("--ts", String(set.textScale));
    const reduce = set.reducedMotion ?? matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.documentElement.classList.toggle("reduce-motion", reduce);
    this.scene.setReducedMotion(set.reducedMotion);
  }

  // A click on the title screen is what lets the browser start the audio.
  private startSession(): void {
    this.started = true;
    audio.init();
    audio.startMusic();
    audio.setChapter(0);
  }

  private portrait(key: string, size = 96): HTMLCanvasElement {
    const c = el("canvas", { class: "portrait", width: size, height: size, "aria-hidden": "true" });
    drawPortrait(c, key);
    return c;
  }

  // ----------------------------------------------------------------- top bar
  private renderTopbar(): void {
    const prog = rankProgress(this.s);
    const pct = prog.max ? 100 : Math.round((prog.have / prog.need) * 100);
    const left = el("div", { class: "tb-left" }, [el("span", { class: "tb-logo", text: "Dwell Time" })]);

    let mid: HTMLElement;
    if (this.s.hired) {
      const con = conduct(this.s);
      const sign = this.s.integrity >= 3 ? "good" : this.s.integrity >= 0 ? "mid" : "bad";
      mid = el("div", { class: "tb-rank" }, [
        el("span", { class: "tb-rankname", text: rankTitle(this.s) }),
        el("span", { class: `tb-conduct ${sign}`, title: con.note }, [
          el("span", { class: "tb-conduct-dot" }),
          el("span", { text: con.tier }),
        ]),
        el("div", { class: "xpbar" }, [el("div", { class: "xpfill", style: `width:${pct}%` })]),
        el("span", { class: "tb-xp", text: prog.max ? "max rank" : `${this.s.xp} XP` }),
      ]);
    } else {
      mid = el("div", { class: "tb-rank" }, [el("span", { class: "tb-rankname", text: "Applicant" })]);
    }
    const btns = el("div", { class: "tb-right" }, [
      this.s.hired ? this.iconBtn("Field Notes", () => this.openCodex()) : el("span"),
      this.iconBtn("Settings", () => this.openSettings()),
      this.iconBtn(audio.isMuted ? "Sound off" : "Sound on", () => {
        this.meta.settings.muted = !audio.isMuted;
        this.applySettings();
        saveMeta(this.meta);
        this.renderTopbar();
      }),
    ]);
    mount(this.topbar, left, mid, btns);
  }

  private iconBtn(label: string, on: () => void): HTMLElement {
    const b = el("button", { class: "tb-btn", type: "button", text: label });
    b.addEventListener("click", () => {
      audio.click();
      on();
    });
    return b;
  }

  // ----------------------------------------------------------------- router
  private render(): void {
    this.renderTopbar();
    this.scene.setChapter(this.s.chapter);
    if (!this.started) {
      this.screenTitle();
      return;
    }
    if (!this.s.hired) {
      if (!this.s.track) {
        if (this.s.playerName === "") this.screenTitle();
        else this.screenTrack();
      } else {
        this.screenInterview();
      }
      return;
    }
    if (this.s.chapter >= 6) {
      this.screenEnding();
      return;
    }
    this.screenChapter();
  }

  // ----------------------------------------------------------------- title
  private screenTitle(): void {
    const begin = (): void => this.startSession();
    const resumeAvailable = this.s.playerName !== "";

    const nameInput = el("input", {
      class: "name-input",
      type: "text",
      id: "player-name",
      maxlength: 24,
      placeholder: "Your name",
      value: this.s.playerName,
    }) as HTMLInputElement;

    const start = el("button", {
      class: resumeAvailable ? "btn ghost" : "btn primary",
      type: "button",
      text: resumeAvailable ? "Start over as a new applicant" : "Apply to Lanternhouse",
    });
    let confirmingRestart = false;
    start.addEventListener("click", () => {
      if (resumeAvailable && !confirmingRestart) {
        confirmingRestart = true;
        start.textContent = "This erases your saved game. Tap again to confirm";
        return;
      }
      begin();
      const name = nameInput.value.trim() || "Alex";
      this.s = freshSave();
      this.s.playerName = name;
      audio.click();
      this.persist();
      this.render();
    });

    const card = el("div", { class: "title-card" }, [
      el("h1", { class: "title-logo", text: "DWELL TIME" }),
      el("p", { class: "title-sub", text: "how long an intruder stays before anyone notices" }),
      el("p", { class: "title-blurb", text: "You are the newest hire at Lanternhouse Security, a small firm keeping a rainy harbor town safe. Learn the trade, close the tickets, and find out what has been hiding in the quiet." },
      ),
    ]);

    if (resumeAvailable) {
      const cont = el("button", { class: "btn primary", type: "button", text: `Continue as ${this.s.playerName}` });
      cont.addEventListener("click", () => {
        begin();
        audio.click();
        this.render();
      });
      card.append(cont, el("label", { class: "field-label", for: "player-name", text: "Or sign a new application" }), nameInput, start);
    } else {
      card.append(el("label", { class: "field-label", for: "player-name", text: "Sign your application" }), nameInput, start);
    }

    // Once you have finished a run, you can look back at it and replay a chapter.
    const extras = el("div", { class: "title-extras" });
    if (canSelectChapter(this.meta)) {
      const pick = el("button", { class: "btn ghost small", type: "button", text: "Replay a chapter" });
      pick.addEventListener("click", () => {
        audio.click();
        this.openChapterSelect();
      });
      extras.append(pick);
    }
    if (this.meta.endings.length > 0 || this.meta.achievements.length > 0) {
      const rec = el("button", { class: "btn ghost small", type: "button", text: "Endings and achievements" });
      rec.addEventListener("click", () => {
        audio.click();
        this.openRecord();
      });
      extras.append(rec);
    }
    if (extras.childElementCount > 0) card.append(extras);

    this.stage.className = "stage center";
    mount(this.stage, card);
    const firstButton = card.querySelector("button");
    setTimeout(() => (resumeAvailable ? firstButton?.focus() : nameInput.focus()), 30);
  }

  // ----------------------------------------------------------------- track
  private screenTrack(): void {
    const title = el("div", { class: "screen-head" }, [
      el("h2", { text: `Welcome, ${this.s.playerName}.` }),
      el("p", { text: "Lanternhouse has openings across six teams. Pick the one you want to interview for. You will be asked real questions, so choose where your instincts are sharpest." }),
    ]);
    const grid = el("div", { class: "track-grid" });
    for (const dept of DEPTS) {
      const iv = interviewFor(dept);
      const card = el("button", { class: "track-card", type: "button" }, [
        this.portrait(iv ? iv.interviewer : "you", 72),
        el("div", { class: "track-name", text: DEPT_LABEL[dept] }),
        el("div", { class: "track-by", text: iv ? `Interviewer: ${charName(iv.interviewer)}` : "" }),
        el("div", { class: "track-desc", text: TRACK_PITCH[dept] }),
      ]);
      card.addEventListener("click", () => {
        audio.click();
        this.s.track = dept;
        this.s.interviewScore = 0;
        this.persist();
        this.render();
      });
      grid.append(card);
    }
    this.stage.className = "stage";
    mount(this.stage, title, grid);
  }

  // ----------------------------------------------------------------- interview
  private screenInterview(): void {
    const iv = interviewFor(this.s.track as Dept);
    if (!iv) {
      this.s.track = null;
      this.render();
      return;
    }
    // intro dialogue, then questions one at a time, then verdict
    this.playDialogue(iv.intro.map((t) => ({ who: iv.interviewer, text: t })), undefined, () => {
      this.runInterviewQuestions(0, 0);
    });
  }

  private runInterviewQuestions(i: number, correct: number): void {
    const iv = interviewFor(this.s.track as Dept)!;
    if (i >= iv.questions.length) {
      this.s.interviewScore = correct;
      const hired = correct >= iv.passLine;
      const lines = (hired ? iv.hiredText : iv.rejectedText).map((t) => ({ who: iv.interviewer, text: t }));
      this.playDialogue(lines, undefined, () => {
        if (hired) {
          this.s.hired = true;
          setFlag(this.s, trackFlag(iv.dept));
          this.s.chapter = 1;
          this.s.xp = 0;
          audio.rankUp();
          this.persist();
          this.render();
        } else {
          // rejection is recorded. You can retry, but it goes on the board.
          this.s.interviewFails++;
          this.showToast("Interview failed. It stays on your record.");
          this.s.track = null;
          this.persist();
          this.render();
        }
      });
      return;
    }
    const q = iv.questions[i];
    const head = el("div", { class: "iv-head" }, [
      this.portrait(iv.interviewer, 72),
      el("div", {}, [
        el("div", { class: "iv-who", text: charName(iv.interviewer) }),
        el("div", { class: "iv-count", text: `Question ${i + 1} of ${iv.questions.length}` }),
      ]),
    ]);
    const prompt = el("p", { class: "q-prompt", text: q.prompt });
    const opts = el("div", { class: "q-opts" });
    let answered = false;
    // options appear in a new random order every time, so position gives nothing away
    const shown = shuffled(q.options.map((_, i) => i));
    shown.forEach((oi) => {
      const b = el("button", { class: "opt", type: "button", text: q.options[oi] });
      b.addEventListener("click", () => {
        if (answered) return;
        answered = true;
        const right = oi === q.answer;
        [...opts.children].forEach((c, pos) => {
          c.classList.add("locked");
          if (shown[pos] === q.answer) c.classList.add("correct");
          else if (shown[pos] === oi) c.classList.add("wrong");
        });
        if (right) audio.correct();
        else audio.wrong();
        const explain = el("div", { class: right ? "explain good" : "explain bad" }, [
          el("p", { text: right ? q.explainRight : q.explainWrong }),
        ]);
        const next = el("button", { class: "btn primary small", type: "button", text: i + 1 < iv.questions.length ? "Next question" : "See the verdict" });
        next.addEventListener("click", () => {
          audio.click();
          this.runInterviewQuestions(i + 1, correct + (right ? 1 : 0));
        });
        explain.append(next);
        card.append(explain);
      });
      opts.append(b);
    });
    const card = el("div", { class: "card-panel iv-card" }, [head, prompt, opts]);
    this.stage.className = "stage";
    mount(this.stage, card);
  }

  // ----------------------------------------------------------------- chapter desk
  private screenChapter(): void {
    const plan = chapterPlan(this.s.chapter);
    if (!plan) {
      // past the last chapter: go to ending
      this.s.chapter = 6;
      this.persist();
      this.screenEnding();
      return;
    }
    // play intro scene once
    if (!isDone(this.s, `intro_${plan.chapter}`)) {
      // remember how the run stood when this chapter began, for chapter select
      recordCheckpoint(this.meta, this.s);
      saveMeta(this.meta);
      const sc = sceneById(plan.intro);
      if (sc) {
        this.playScene(sc, () => {
          markDone(this.s, `intro_${plan.chapter}`);
          this.persist();
          this.screenChapter();
        });
        return;
      }
    }

    const mainTickets = plan.main.map(ticketById).filter(isVisible(this.s)) as Ticket[];
    const sideTickets = plan.side.map(ticketById).filter(isVisible(this.s)) as Ticket[];
    const allMainDone = mainTickets.every((t) => isDone(this.s, t.id));

    const head = el("div", { class: "desk-head" }, [
      el("div", { class: "chapter-badge", text: `${plan.title}` }),
      el("h2", { class: "chapter-title", text: plan.subtitle }),
      el("p", { class: "desk-note", text: allMainDone ? "Caught up. When you are ready, carry on." : "Open tickets are waiting. Work them when you are ready." }),
    ]);

    const queue = el("div", { class: "queue" });
    for (const t of [...mainTickets, ...sideTickets]) {
      queue.append(this.ticketCard(t, isDone(this.s, t.id)));
    }

    const footer = el("div", { class: "desk-footer" });
    if (allMainDone) {
      const cont = el("button", { class: "btn primary", type: "button", text: this.s.chapter === 5 ? "Face the storm" : "Continue the day" });
      cont.addEventListener("click", () => {
        audio.click();
        this.runOutro(plan.outro, 0);
      });
      footer.append(cont);
    } else {
      footer.append(el("p", { class: "muted", text: `Close the remaining case${mainTickets.filter((t) => !isDone(this.s, t.id)).length > 1 ? "s" : ""} to continue.` }));
    }

    this.stage.className = "stage";
    mount(this.stage, head, queue, footer);
  }

  private ticketCard(t: Ticket, done: boolean): HTMLElement {
    const card = el("button", { class: `ticket-card sev-${t.severity}${done ? " done" : ""}${t.side ? " side" : ""}`, type: "button" }, [
      el("div", { class: "tk-top" }, [
        el("span", { class: "tk-sev", text: t.severity.toUpperCase() }),
        t.side ? el("span", { class: "tk-side", text: "SIDE" }) : el("span", { class: "tk-dept", text: DEPT_LABEL[t.dept] }),
        done ? el("span", { class: "tk-check", text: "CLOSED" }) : el("span", { class: "tk-xp", text: `${t.xp} XP` }),
      ]),
      el("div", { class: "tk-title", text: t.title }),
      el("div", { class: "tk-client", text: t.client }),
    ]);
    card.addEventListener("click", () => {
      audio.click();
      this.openTicket(t, done);
    });
    return card;
  }

  private runOutro(ids: string[], i: number): void {
    if (i >= ids.length) {
      // advance chapter
      this.s.chapter = (this.s.chapter + 1) as Chapter;
      this.persist();
      this.render();
      return;
    }
    const sc = sceneById(ids[i]);
    if (!sc || !isVisible(this.s)(sc) || isDone(this.s, sc.id)) {
      this.runOutro(ids, i + 1);
      return;
    }
    this.playScene(sc, () => {
      markDone(this.s, sc.id);
      this.persist();
      this.runOutro(ids, i + 1);
    });
  }

  // ----------------------------------------------------------------- ticket
  private openTicket(t: Ticket, review: boolean): void {
    this.playDialogue(
      t.brief.map((text) => ({ who: speakerFor(t), text })),
      undefined,
      () => this.ticketWorkstation(t, review),
    );
  }

  private ticketWorkstation(t: Ticket, review: boolean): void {
    const head = el("div", { class: "ws-head" }, [
      el("div", {}, [
        el("div", { class: `tk-sev inline sev-${t.severity}`, text: t.severity.toUpperCase() }),
        el("h2", { class: "ws-title", text: t.title }),
        el("div", { class: "ws-client", text: `${t.client} · ${t.team ?? DEPT_LABEL[t.dept]}` }),
      ]),
    ]);

    // evidence a spot question asks about is shown without warning marks
    const spotted = new Set(t.questions.flatMap((q) => (q.type === "spot" ? [q.evidence] : [])));
    const evPanel = el("div", { class: "ev-panel" }, t.evidence.map((ev) => renderEvidence(ev, { plain: spotted.has(ev.id) })));

    const qPanel = el("div", { class: "q-panel" });
    const ctx: QuestionContext = { ticket: t, evPanel, review, disarm: null };
    const controls: QuestionControl[] = t.questions.map((q) => this.buildQuestion(q, qPanel, ctx));

    const submit = el("button", { class: "btn primary", type: "button", text: review ? "Back to desk" : "Submit findings" });
    const feedback = el("div", { class: "ws-feedback" });

    // Critical cases bite: a limited number of tries, then the case is botched
    // and closes badly rather than letting you retry forever.
    const critical = t.severity === "critical";
    const maxAttempts = critical ? 2 : Infinity;
    let wrong = 0;

    if (critical && !review) {
      feedback.append(
        el("p", { class: "warn-crit", text: `Critical case. You have ${maxAttempts} attempts before it goes down as botched.` }),
      );
    }

    submit.addEventListener("click", () => {
      audio.click();
      if (review) {
        this.screenChapter();
        return;
      }
      const missing = controls.find((c) => !c.ready());
      if (missing) {
        mount(feedback, el("p", { class: "warn", text: "Answer every item before you submit." }));
        missing.focus();
        return;
      }
      const allCorrect = controls.every((c) => c.correct());
      if (!allCorrect) {
        wrong++;
        if (wrong >= maxAttempts) {
          // out of tries on a critical case: decisions still count, but the
          // investigation itself is botched.
          audio.wrong();
          closeCase(true);
          return;
        }
        // Say which answers are wrong, but never which option is right, so a
        // retry still means reading the evidence again.
        controls.forEach((c) => c.mark());
        audio.wrong();
        const left = maxAttempts - wrong;
        const tail = critical ? ` ${left} attempt${left === 1 ? "" : "s"} left.` : "";
        mount(feedback, el("p", { class: "warn", text: `Not quite. The answers marked in red are wrong. Re-read the evidence and try again.${tail}` }));
        return;
      }
      audio.correct();
      closeCase(false);
    });

    // Show every answer with its explanation, then leave the case on a click,
    // so the teaching notes are actually read.
    const closeCase = (botched: boolean): void => {
      ctx.disarm?.();
      controls.forEach((c) => c.reveal());
      controls.forEach((c) => c.apply(this.s));
      qPanel.classList.add("done");
      const done = el("button", { class: "btn primary", type: "button", text: "Close the case" });
      done.addEventListener("click", () => {
        audio.click();
        const hints = t.questions.filter((q) => hasFlag(this.s, hintFlag(q))).length;
        this.completeTicket(t, { wrongAttempts: wrong, botched, hints });
      });
      mount(
        feedback,
        el("p", {
          class: botched ? "warn" : "good-note",
          text: botched ? "Out of attempts. Read what each answer should have been, then close the case." : "Solved. Read the notes on each answer, then close the case.",
        }),
      );
      if (t.attack?.length) feedback.append(attackTags(t));
      submit.replaceWith(done);
      done.focus();
    };

    const body = el("div", { class: "ws-body" }, [
      el("div", { class: "ws-col ws-evidence" }, [el("div", { class: "col-label", text: "Evidence" }), evPanel]),
      el("div", { class: "ws-col ws-questions" }, [el("div", { class: "col-label", text: "Your analysis" }), qPanel, feedback, submit]),
    ]);

    if (review && t.attack?.length) head.append(attackTags(t));

    this.stage.className = "stage ticket";
    mount(this.stage, head, body);
  }

  private completeTicket(t: Ticket, grade: { wrongAttempts: number; botched: boolean; hints: number }): void {
    const beforeRank = rankIndex(this.s);
    const firstTime = !isDone(this.s, t.id);

    // XP scales with how cleanly you closed it. A clean first-try close earns a
    // bonus; retries dock it; a botched critical case barely pays and costs
    // integrity. Story flags always fire so the game never soft-locks.
    let toastMsg = "";
    if (firstTime) {
      this.s.totalCloses++;
      const gain = xpForClose(t.xp, grade);
      if (grade.botched) {
        this.s.integrity -= 1;
        this.s.botched++;
        setFlag(this.s, `botched_${t.id}`);
        toastMsg = `Case botched, +${gain} XP`;
      } else if (grade.wrongAttempts === 0) {
        this.s.cleanCloses++;
        toastMsg = `Closed clean, +${gain} XP`;
      } else {
        toastMsg = `+${gain} XP`;
      }
      this.s.xp += gain;
      markDone(this.s, t.id);
    }

    (t.setFlags ?? []).forEach((f) => setFlag(this.s, f));
    // You only pick up the field note when you work the case properly.
    if (!grade.botched) {
      t.questions.forEach((q) => {
        if ("teaches" in q && q.teaches) unlockCodex(this.s, q.teaches);
      });
      if (t.attack?.length) unlockCodex(this.s, "attack");
    }
    this.persist();

    const rankedUp = rankIndex(this.s) > beforeRank;
    const lines = grade.botched
      ? [
          { who: "narration", text: "The case closes, but not the way anyone wanted. The notes will say it took too long, and that you reached for answers instead of reading the evidence." },
          { who: speakerFor(t), text: "We got there. Barely. On a critical case, barely is how towns end up on the news. Learn from this one." },
        ]
      : t.closingRight.map((text) => ({ who: speakerFor(t), text }));

    this.playDialogue(lines, undefined, () => {
      if (toastMsg) this.showToast(toastMsg);
      if (rankedUp) {
        audio.rankUp();
        this.showToast(`Promoted to ${rankTitle(this.s)}`);
      }
      this.screenChapter();
    });
  }

  // ----------------------------------------------------------------- questions
  private buildQuestion(q: Question, panel: HTMLElement, ctx: QuestionContext): QuestionControl {
    const wrap = el("div", { class: "q-block" });
    wrap.append(el("p", { class: "q-prompt", text: q.prompt }));
    if (q.type !== "decision" && q.hint && !ctx.review) wrap.append(this.hintBox(q.hint, hintFlag(q)));
    panel.append(wrap);

    if (q.type === "spot") return this.spotQuestion(q, wrap, ctx);

    // options appear in a new random order every time, so position gives nothing away
    if (q.type === "single") {
      let sel = -1;
      const shown = shuffled(q.options.map((_, i) => i));
      const opts = el("div", { class: "q-opts" });
      shown.forEach((oi) => {
        const b = el("button", { class: "opt", type: "button", text: q.options[oi] });
        b.addEventListener("click", () => {
          sel = oi;
          [...opts.children].forEach((c, pos) => c.classList.toggle("sel", shown[pos] === oi));
          audio.type();
        });
        opts.append(b);
      });
      wrap.append(opts);
      const expl = el("div", { class: "explain", hidden: true });
      wrap.append(expl);
      return {
        ready: () => sel >= 0,
        correct: () => sel === q.answer,
        reveal: () => {
          [...opts.children].forEach((c, pos) => {
            c.classList.toggle("correct", shown[pos] === q.answer);
            c.classList.toggle("wrong", shown[pos] === sel && sel !== q.answer);
          });
          expl.hidden = false;
          expl.className = sel === q.answer ? "explain good" : "explain bad";
          mount(expl, el("p", { text: sel === q.answer ? q.explainRight : q.explainWrong }));
        },
        mark: () => markBlock(wrap, sel === q.answer),
        apply: () => {},
        focus: () => wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" }),
      };
    }

    if (q.type === "multi") {
      const sel = new Set<number>();
      const shown = shuffled(q.options.map((_, i) => i));
      const opts = el("div", { class: "q-opts" });
      shown.forEach((oi) => {
        const b = el("button", { class: "opt check", type: "button" }, [
          el("span", { class: "box" }),
          el("span", { text: q.options[oi] }),
        ]);
        b.addEventListener("click", () => {
          if (sel.has(oi)) sel.delete(oi);
          else sel.add(oi);
          b.classList.toggle("sel", sel.has(oi));
          audio.type();
        });
        opts.append(b);
      });
      wrap.append(opts);
      const expl = el("div", { class: "explain", hidden: true });
      wrap.append(expl);
      const want = new Set(q.answer);
      const isRight = (): boolean => sel.size === want.size && [...want].every((x) => sel.has(x));
      return {
        ready: () => sel.size > 0,
        correct: isRight,
        reveal: () => {
          [...opts.children].forEach((c, pos) => {
            const oi = shown[pos];
            c.classList.toggle("correct", want.has(oi));
            c.classList.toggle("wrong", sel.has(oi) && !want.has(oi));
          });
          expl.hidden = false;
          expl.className = isRight() ? "explain good" : "explain bad";
          mount(expl, el("p", { text: isRight() ? q.explainRight : q.explainWrong }));
        },
        mark: () => markBlock(wrap, isRight()),
        apply: () => {},
        focus: () => wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" }),
      };
    }

    if (q.type === "order") {
      // never start already in the right order, or the question answers itself
      let order = shuffled(q.items.map((_, i) => i));
      while (order.length > 1 && order.every((v, i) => v === i)) order = shuffled(order);
      const list = el("ol", { class: "q-order" });
      const redraw = (): void => {
        clear(list);
        order.forEach((itemIdx, pos) => {
          const li = el("li", {}, [
            el("span", { class: "ord-num", text: String(pos + 1) }),
            el("span", { class: "ord-text", text: q.items[itemIdx] }),
            el("span", { class: "ord-btns" }, [
              mkArrow("up", pos > 0, () => {
                [order[pos - 1], order[pos]] = [order[pos], order[pos - 1]];
                audio.type();
                redraw();
              }),
              mkArrow("down", pos < order.length - 1, () => {
                [order[pos + 1], order[pos]] = [order[pos], order[pos + 1]];
                audio.type();
                redraw();
              }),
            ]),
          ]);
          list.append(li);
        });
      };
      redraw();
      wrap.append(list);
      const expl = el("div", { class: "explain", hidden: true });
      wrap.append(expl);
      const isRight = (): boolean => order.every((v, i) => v === i);
      return {
        ready: () => true,
        correct: isRight,
        reveal: () => {
          expl.hidden = false;
          expl.className = isRight() ? "explain good" : "explain bad";
          mount(expl, el("p", { text: isRight() ? q.explainRight : q.explainWrong }));
        },
        mark: () => markBlock(wrap, isRight()),
        apply: () => {},
        focus: () => wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" }),
      };
    }

    // decision
    let chosen = -1;
    const opts = el("div", { class: "q-opts decision" });
    const result = el("div", { class: "decision-result", hidden: true });
    q.options.forEach((o, oi) => {
      const b = el("button", { class: "opt decision-opt", type: "button", text: o.text });
      b.addEventListener("click", () => {
        if (chosen >= 0) return;
        chosen = oi;
        [...opts.children].forEach((c, ci) => {
          c.classList.add("locked");
          if (ci === oi) c.classList.add("sel");
        });
        result.hidden = false;
        mount(result, el("p", { text: o.result }));
        audio.notify();
      });
      opts.append(b);
    });
    wrap.append(opts, result);
    return {
      ready: () => chosen >= 0,
      correct: () => true,
      reveal: () => {},
      mark: () => {},
      apply: (sv) => {
        const o = q.options[chosen];
        (o.setFlags ?? []).forEach((f) => setFlag(sv, f));
        (o.clearFlags ?? []).forEach((f) => {
          const idx = sv.flags.indexOf(f);
          if (idx >= 0) sv.flags.splice(idx, 1);
        });
        sv.integrity += o.integrity ?? 0;
      },
      focus: () => wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" }),
    };
  }

  // A hint costs XP when the case closes. Bought hints are stored as flags, so a
  // reload neither loses them nor makes them free.
  private hintBox(hint: string, flag: string): HTMLElement {
    const box = el("div", { class: "hint" });
    const show = (): void => mount(box, el("p", { class: "hint-text", text: hint }));
    if (hasFlag(this.s, flag)) {
      show();
      return box;
    }
    const b = el("button", { class: "hint-btn", type: "button", text: `Hint (costs ${HINT_COST} XP)` });
    b.addEventListener("click", () => {
      audio.click();
      setFlag(this.s, flag);
      this.s.hintsUsed++;
      this.persist();
      show();
    });
    box.append(b);
    return box;
  }

  private spotQuestion(q: Extract<Question, { type: "spot" }>, wrap: HTMLElement, ctx: QuestionContext): QuestionControl {
    const ev = ctx.ticket.evidence.find((e) => e.id === q.evidence) as Evidence;
    const view = ctx.evPanel.querySelector<HTMLElement>(`[data-ev="${q.evidence}"]`)!;
    const labels = new Map(pickTargets(ev).map((p) => [p.key, p.label]));
    let sel: string | null = null;

    const pickBtn = el("button", { class: "btn ghost small spot-btn", type: "button", text: "Pick in the evidence" });
    const yours = el("p", { class: "spot-pick", text: "Nothing picked yet." });
    const expl = el("div", { class: "explain", hidden: true });
    wrap.append(pickBtn, yours, expl);

    const targets = (): HTMLElement[] => [...view.querySelectorAll<HTMLElement>("[data-pick]")];
    const banner = el("div", { class: "pick-banner", text: `${ev.label}: click the part you mean. Esc cancels.` });

    const disarm = (): void => {
      view.classList.remove("picking");
      banner.remove();
      targets().forEach((x) => {
        x.removeAttribute("tabindex");
        x.removeAttribute("role");
      });
      view.removeEventListener("click", onClick);
      view.removeEventListener("keydown", onKey);
      pickBtn.textContent = "Pick in the evidence";
      if (ctx.disarm === disarm) ctx.disarm = null;
    };
    const choose = (key: string): void => {
      sel = key;
      targets().forEach((x) => x.classList.toggle("picked", x.dataset.pick === key));
      const label = labels.get(key) ?? key;
      yours.textContent = `Your pick: ${label.length > 140 ? label.slice(0, 137) + "..." : label}`;
      audio.type();
      disarm();
      wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" });
    };
    const onClick = (e: Event): void => {
      const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-pick]");
      if (hit && view.contains(hit)) choose(hit.dataset.pick!);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        disarm();
        pickBtn.focus();
        return;
      }
      if (e.key !== "Enter" && e.key !== " ") return;
      const hit = (e.target as HTMLElement).closest<HTMLElement>("[data-pick]");
      if (!hit) return;
      e.preventDefault();
      choose(hit.dataset.pick!);
    };
    pickBtn.addEventListener("click", () => {
      audio.click();
      if (ctx.disarm === disarm) {
        disarm();
        return;
      }
      ctx.disarm?.();
      ctx.disarm = disarm;
      view.classList.add("picking");
      view.prepend(banner);
      targets().forEach((x) => {
        x.tabIndex = 0;
        x.setAttribute("role", "button");
      });
      view.addEventListener("click", onClick);
      view.addEventListener("keydown", onKey);
      pickBtn.textContent = "Cancel picking";
      view.scrollIntoView({ behavior: scrollMotion(), block: "start" });
      (targets().find((x) => x.classList.contains("picked")) ?? targets()[0])?.focus({ preventScroll: true });
    });

    const isRight = (): boolean => sel !== null && q.answer.includes(sel);
    return {
      ready: () => sel !== null,
      correct: isRight,
      reveal: () => {
        targets().forEach((x) => {
          x.classList.toggle("pick-right", q.answer.includes(x.dataset.pick!));
          x.classList.toggle("pick-wrong", x.dataset.pick === sel && !isRight());
        });
        expl.hidden = false;
        expl.className = isRight() ? "explain good" : "explain bad";
        mount(expl, el("p", { text: isRight() ? q.explainRight : q.explainWrong }));
      },
      mark: () => markBlock(wrap, isRight()),
      apply: () => {},
      focus: () => wrap.scrollIntoView({ behavior: scrollMotion(), block: "center" }),
    };
  }

  // ----------------------------------------------------------------- scenes
  private playScene(sc: Scene, onDone: () => void): void {
    (sc.setFlags ?? []).forEach((f) => setFlag(this.s, f));
    this.playDialogue(sc.lines, sc.choice, onDone);
  }

  private playDialogue(
    lines: { who: string; text: string }[],
    choice: Scene["choice"] | undefined,
    onDone: () => void,
  ): void {
    let i = 0;
    const box = el("div", { class: "vn", tabindex: 0, role: "button", "aria-label": "Continue the conversation" });
    this.stage.className = "stage vn-stage";
    mount(this.stage, box);
    box.focus({ preventScroll: true });

    const showLine = (): void => {
      const line = lines[i];
      const who = line.who;
      const info = CHARACTERS[who];
      const isNarration = who === "narration" || !info || info.name === "";
      const content = el("div", { class: isNarration ? "vn-box narration" : "vn-box" }, []);
      if (!isNarration) {
        content.append(
          el("div", { class: "vn-speaker" }, [
            this.portrait(info.portrait, 96),
            el("span", { class: "vn-name", text: info.name, style: `color:${info.color}` }),
          ]),
        );
      }
      content.append(el("p", { class: "vn-text", text: line.text }));
      const hint = el("div", { class: "vn-hint", text: "click to continue" });
      content.append(hint);
      mount(box, content);
      box.onclick = (): void => {
        audio.type();
        i++;
        if (i < lines.length) showLine();
        else finishLines();
      };
      box.onkeydown = (e: KeyboardEvent): void => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          box.onclick?.(new MouseEvent("click"));
        }
      };
    };

    const finishLines = (): void => {
      box.onclick = null;
      box.onkeydown = null;
      box.removeAttribute("tabindex");
      box.removeAttribute("role");
      if (choice) {
        showChoice();
      } else {
        onDone();
      }
    };

    const showChoice = (): void => {
      const c = choice!;
      const panel = el("div", { class: "vn-choice" }, [el("p", { class: "vn-choice-prompt", text: c.prompt })]);
      // Some options are only on the table if your earlier conduct earned them.
      const available = c.options.filter((o) => hasAll(this.s, o.requires) && hasNone(this.s, o.hideIf));
      available.forEach((opt) => {
        const b = el("button", { class: "btn choice", type: "button", text: opt.text });
        b.addEventListener("click", () => {
          audio.click();
          this.applyChoice(opt);
          if (opt.reply && opt.reply.length) {
            this.playDialogue(opt.reply, undefined, onDone);
          } else {
            onDone();
          }
        });
        panel.append(b);
      });
      mount(box, panel);
      panel.querySelector("button")?.focus();
    };

    showLine();
  }

  private applyChoice(opt: SceneChoice): void {
    (opt.setFlags ?? []).forEach((f) => setFlag(this.s, f));
    (opt.clearFlags ?? []).forEach((f) => {
      const idx = this.s.flags.indexOf(f);
      if (idx >= 0) this.s.flags.splice(idx, 1);
    });
    this.s.integrity += opt.integrity ?? 0;
    this.persist();
  }

  // ----------------------------------------------------------------- ending
  private screenEnding(): void {
    const ending = resolveEnding(this.s);
    recordEnding(this.meta, ending.id);
    this.persist();
    const lines = [
      { who: "narration", text: `Epilogue. ${ending.epigraph}` },
      ...ending.lines.map((text) => ({ who: "narration", text })),
    ];
    this.playDialogue(lines, undefined, () => {
      const con = conduct(this.s);
      const acc = Math.round(accuracy(this.s) * 100);
      const card = el("div", { class: "ending-card" }, [
        el("div", { class: "ending-kicker", text: "Ending" }),
        el("h1", { class: "ending-title", text: ending.title }),
        el("p", { class: "ending-rank", text: ending.rankTitle }),
        el("p", { class: "ending-epi", text: ending.epigraph }),
        el("div", { class: "ending-stats" }, [
          stat("Conduct", con.tier),
          stat("Case accuracy", `${acc}%`),
          stat("Botched", String(this.s.botched)),
          stat("Interviews failed", String(this.s.interviewFails)),
        ]),
      ]);
      const again = el("button", { class: "btn primary", type: "button", text: "Play again" });
      again.addEventListener("click", () => {
        audio.click();
        const keepName = this.s.playerName;
        this.s = freshSave();
        this.s.playerName = keepName;
        this.persist();
        this.render();
      });
      const record = el("button", { class: "btn ghost small", type: "button", text: "Endings and achievements" });
      record.addEventListener("click", () => {
        audio.click();
        this.openRecord();
      });
      const seen = this.meta.endings.length;
      const total = ENDING_ORDER.length;
      const endings = el("div", { class: "ending-roster" }, [
        el("p", {
          class: "muted",
          text: seen >= total ? "You have seen every ending." : `You have seen ${seen} of ${total} endings. Replay a chapter from the title screen to find the others.`,
        }),
      ]);
      card.append(again, record, endings);
      this.stage.className = "stage center";
      mount(this.stage, card);
    });
  }

  // ----------------------------------------------------------------- overlays
  private openCodex(): void {
    const overlay = el("div", { class: "overlay" });
    const close = (): void => overlay.remove();
    const entries = CODEX.filter((c) => this.s.codex.includes(c.id));
    const list = el("div", { class: "codex-list" });
    if (entries.length === 0) {
      list.append(el("p", { class: "muted", text: "Empty for now. Field notes unlock as you learn each idea on a real case." }));
    }
    for (const e of entries) {
      list.append(
        el("details", { class: "codex-entry" }, [
          el("summary", {}, [
            el("span", { class: "codex-term", text: e.term }),
            el("span", { class: "codex-dept", text: e.dept === "general" ? "general" : DEPT_LABEL[e.dept as Dept] }),
          ]),
          el("div", { class: "codex-body" }, e.body.map((p) => el("p", { text: p }))),
        ]),
      );
    }
    const panel = el("div", { class: "overlay-panel" }, [
      el("div", { class: "overlay-head" }, [
        el("h2", { text: "Field Notes" }),
        el("span", { class: "muted", text: `${entries.length} of ${CODEX.length} learned` }),
      ]),
      list,
    ]);
    overlay.append(panel);
    panel.append(this.closeBtn(close));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    this.root.append(overlay);
  }

  private openSettings(): void {
    const overlay = el("div", { class: "overlay" });
    const close = (): void => overlay.remove();
    const set = this.meta.settings;
    const changed = (): void => {
      this.applySettings();
      saveMeta(this.meta);
    };

    const slider = (id: string, label: string, value: number, on: (v: number) => void): HTMLElement => {
      const input = el("input", { class: "slider", type: "range", min: 0, max: 100, step: 1, value: Math.round(value * 100), id }) as HTMLInputElement;
      input.addEventListener("input", () => on(Number(input.value) / 100));
      return el("div", { class: "set-row" }, [el("label", { for: id, text: label }), input]);
    };

    // a row of buttons where exactly one is pressed
    const choices = <T,>(label: string, options: { text: string; value: T }[], current: T, on: (v: T) => void): HTMLElement => {
      const group = el("div", { class: "seg", role: "group", "aria-label": label });
      for (const o of options) {
        const b = el("button", { class: "seg-btn", type: "button", text: o.text, "aria-pressed": String(o.value === current) });
        b.addEventListener("click", () => {
          audio.click();
          group.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
          on(o.value);
        });
        group.append(b);
      }
      return el("div", { class: "set-row" }, [el("span", { class: "set-label", text: label }), group]);
    };

    const muteBtn = el("button", { class: "btn ghost", type: "button", text: set.muted ? "Unmute" : "Mute" });
    muteBtn.addEventListener("click", () => {
      set.muted = !set.muted;
      muteBtn.textContent = set.muted ? "Unmute" : "Mute";
      changed();
      this.renderTopbar();
    });

    const reset = el("button", { class: "btn danger", type: "button", text: "Erase save and restart" });
    let confirming = false;
    reset.addEventListener("click", () => {
      if (!confirming) {
        confirming = true;
        reset.textContent = "Tap again to confirm. Endings, achievements and settings are kept";
        return;
      }
      wipe();
      this.s = freshSave();
      close();
      this.render();
    });

    const resetAll = el("button", { class: "btn danger ghost-danger", type: "button", text: "Erase everything" });
    let confirmingAll = false;
    resetAll.addEventListener("click", () => {
      if (!confirmingAll) {
        confirmingAll = true;
        resetAll.textContent = "Tap again to erase the save, endings, achievements and settings";
        return;
      }
      wipe();
      wipeMeta();
      this.s = freshSave();
      this.meta = freshMeta();
      this.applySettings();
      close();
      this.render();
    });

    const record = el("button", { class: "btn ghost", type: "button", text: "Endings and achievements" });
    record.addEventListener("click", () => {
      audio.click();
      close();
      this.openRecord();
    });

    const statsBlock = this.s.hired
      ? el("div", { class: "set-stats" }, [
          el("div", { class: "set-stats-head", text: "Your record" }),
          el("div", { class: "ending-stats" }, [
            stat("Rank", rankTitle(this.s)),
            stat("Conduct", conduct(this.s).tier),
            stat("Accuracy", `${Math.round(accuracy(this.s) * 100)}%`),
            stat("Clean / total", `${this.s.cleanCloses} / ${this.s.totalCloses}`),
            stat("Botched", String(this.s.botched)),
            stat("Interviews failed", String(this.s.interviewFails)),
          ]),
          el("p", { class: "muted", text: conduct(this.s).note }),
        ])
      : el("span");

    const panel = el("div", { class: "overlay-panel" }, [
      el("div", { class: "overlay-head" }, [el("h2", { text: "Settings" })]),
      statsBlock,
      slider("vol-music", "Music and rain", set.music, (v) => {
        set.music = v;
        changed();
      }),
      slider("vol-effects", "Sound effects", set.effects, (v) => {
        set.effects = v;
        changed();
      }),
      el("div", { class: "set-row" }, [muteBtn]),
      choices(
        "Text size",
        TEXT_SCALES.map((v, i) => ({ text: ["Small", "Normal", "Large", "Larger"][i], value: v as number })),
        set.textScale,
        (v) => {
          set.textScale = v;
          changed();
        },
      ),
      choices(
        "Reduced motion",
        [
          { text: "Follow my device", value: null as boolean | null },
          { text: "On", value: true },
          { text: "Off", value: false },
        ],
        set.reducedMotion,
        (v) => {
          set.reducedMotion = v;
          changed();
        },
      ),
      el("div", { class: "set-row" }, [record]),
      el("div", { class: "set-about" }, [
        el("p", { text: "Dwell Time is a work of fiction. Every company, person, address and domain is invented. It teaches real cybersecurity ideas through an imagined investigation." }),
        el("p", { class: "muted", text: "All music and sound is generated in your browser. Nothing is sampled or copied." }),
      ]),
      el("div", { class: "set-row danger-row" }, [reset, resetAll]),
    ]);
    overlay.append(panel);
    panel.append(this.closeBtn(close));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    this.root.append(overlay);
  }

  private openRecord(): void {
    const overlay = el("div", { class: "overlay" });
    const close = (): void => overlay.remove();

    const endings = el("div", { class: "gallery" });
    for (const id of ENDING_ORDER) {
      const e = ENDINGS[id];
      const seen = this.meta.endings.includes(id);
      endings.append(
        el("div", { class: seen ? "gal-item seen" : "gal-item" }, [
          el("div", { class: "gal-title", text: seen ? e.title : "Not found yet" }),
          el("p", { class: "gal-text", text: seen ? e.epigraph : e.hint }),
          seen ? el("p", { class: "gal-rank", text: e.rankTitle }) : el("span"),
        ]),
      );
    }

    const achievements = el("div", { class: "gallery" });
    for (const a of ACHIEVEMENTS) {
      const got = this.meta.achievements.includes(a.id);
      achievements.append(
        el("div", { class: got ? "gal-item seen" : "gal-item" }, [
          el("div", { class: "gal-title", text: a.title }),
          el("p", { class: "gal-text", text: a.desc }),
          el("p", { class: "gal-rank", text: got ? "Earned" : "Not yet" }),
        ]),
      );
    }

    const panel = el("div", { class: "overlay-panel" }, [
      el("div", { class: "overlay-head" }, [
        el("h2", { text: "Endings" }),
        el("span", { class: "muted", text: `${this.meta.endings.length} of ${ENDING_ORDER.length} seen` }),
      ]),
      endings,
      el("div", { class: "overlay-head sub" }, [
        el("h2", { text: "Achievements" }),
        el("span", { class: "muted", text: `${this.meta.achievements.length} of ${ACHIEVEMENTS.length} earned` }),
      ]),
      achievements,
    ]);
    overlay.append(panel);
    panel.append(this.closeBtn(close));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    this.root.append(overlay);
  }

  private openChapterSelect(): void {
    const overlay = el("div", { class: "overlay" });
    const close = (): void => overlay.remove();
    const list = el("div", { class: "codex-list" });
    for (const plan of CHAPTERS) {
      const cp = this.meta.checkpoints[plan.chapter];
      if (!cp) continue;
      const b = el("button", { class: "btn choice", type: "button" }, [
        el("span", { class: "cs-title", text: `${plan.title}: ${plan.subtitle}` }),
        el("span", { class: "cs-note", text: `${cp.playerName}, ${rankTitle(cp)}, ${conduct(cp).tier} conduct` }),
      ]);
      let confirming = false;
      b.addEventListener("click", () => {
        audio.click();
        const inProgress = this.s.playerName !== "" && this.s.chapter < 6;
        if (inProgress && !confirming) {
          confirming = true;
          b.querySelector(".cs-note")!.textContent = "This replaces the run you have in progress. Tap again to confirm";
          return;
        }
        const copy = checkpointCopy(this.meta, plan.chapter);
        if (!copy) return;
        this.s = copy;
        this.persist();
        close();
        this.startSession();
        this.render();
      });
      list.append(b);
    }
    const panel = el("div", { class: "overlay-panel" }, [
      el("div", { class: "overlay-head" }, [el("h2", { text: "Replay a chapter" })]),
      el("p", { class: "muted", text: "Each chapter starts with the choices you had made by then in your most recent run." }),
      list,
    ]);
    overlay.append(panel);
    panel.append(this.closeBtn(close));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    this.root.append(overlay);
  }

  private closeBtn(on: () => void): HTMLElement {
    const b = el("button", { class: "overlay-close", type: "button", text: "Close", "aria-label": "Close" });
    b.addEventListener("click", () => {
      audio.click();
      on();
    });
    return b;
  }

  private showToast(text: string): void {
    const t = el("div", { class: "toast", text });
    this.toasts.append(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 400);
    }, 2600);
  }
}

// ----- helpers -----

function markBlock(wrap: HTMLElement, right: boolean): void {
  wrap.classList.toggle("q-right", right);
  wrap.classList.toggle("q-wrong", !right);
  let note = wrap.querySelector<HTMLElement>(".q-mark");
  if (!note) {
    note = el("p", { class: "q-mark" });
    wrap.insertBefore(note, wrap.children[1] ?? null);
    // the mark goes away as soon as the answer is changed
    wrap.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button")) {
        wrap.classList.remove("q-right", "q-wrong");
        note?.remove();
      }
    }, { once: true });
  }
  note.textContent = right ? "Correct" : "Not right yet";
}

function scrollMotion(): ScrollBehavior {
  return document.documentElement.classList.contains("reduce-motion") ? "auto" : "smooth";
}

function stat(label: string, value: string): HTMLElement {
  return el("div", { class: "stat" }, [
    el("span", { class: "stat-k", text: label }),
    el("span", { class: "stat-v", text: value }),
  ]);
}

interface QuestionContext {
  ticket: Ticket;
  evPanel: HTMLElement;
  review: boolean;
  disarm: (() => void) | null; // stops whichever spot question is picking
}

function hintFlag(q: Question): string {
  return `hint:${q.id}`;
}

function attackTags(t: Ticket): HTMLElement {
  return el("div", { class: "attack" }, [
    el("span", { class: "attack-k", text: "MITRE ATT&CK" }),
    ...(t.attack ?? []).map((a) => el("span", { class: "attack-tag", text: `${a.id} ${a.name}` })),
  ]);
}

interface QuestionControl {
  ready(): boolean;
  correct(): boolean;
  reveal(): void;
  /** After a wrong submit: say whether this answer is right, without showing the right option. */
  mark(): void;
  apply(save: SaveData): void;
  focus(): void;
}

const TRACK_PITCH: Record<Dept, string> = {
  soc: "Watch the alerts. Tell the nothing from the something, fast.",
  network: "Read the traffic. The network always knows, if you listen.",
  helpdesk: "The front door. Keep people safe and calm at the same time.",
  forensics: "Reconstruct what happened, in a way that holds up to scrutiny.",
  pentest: "Break in on purpose, strictly inside the lines.",
  intel: "Connect the dots without inventing them.",
};

function speakerFor(t: Ticket): string {
  return t.speaker ?? briefSpeaker(t.dept);
}

function briefSpeaker(dept: Dept): string {
  const map: Record<Dept, string> = {
    soc: "mags",
    network: "priya",
    helpdesk: "theo",
    forensics: "imani",
    pentest: "rook",
    intel: "juno",
  };
  return map[dept];
}

function isVisible(s: SaveData): (x: { requires?: string[]; hideIf?: string[] } | undefined) => boolean {
  return (x) => !!x && hasAll(s, x.requires) && hasNone(s, x.hideIf);
}

function mkArrow(dir: "up" | "down", enabled: boolean, on: () => void): HTMLElement {
  const b = el("button", { class: "ord-arrow", type: "button", text: dir === "up" ? "▲" : "▼", disabled: !enabled });
  if (enabled) b.addEventListener("click", on);
  return b;
}

// referenced to keep tree-shaking honest in tests
export { INTERVIEWS, TICKETS, SCENES, CHAPTERS };
