import { expect, type Locator, type Page } from "@playwright/test";
import type { Dept, Question } from "../src/engine/types";
import { DEPT_LABEL } from "../src/engine/types";
import { TICKETS } from "../src/content/tickets";
import { SCENES } from "../src/content/scenes";
import { interviewFor } from "../src/content/interviews";

// Plays Dwell Time through the real UI, answering from the game's own content.
// Every graded answer is right on the first submit and no hint is bought; the
// plan only decides the choices that steer the story.

export interface Plan {
  name: string;
  track: Dept;
  // case decision id -> option index; default is the option with the most integrity
  decisions?: Record<string, number>;
  // scene id -> option index among all options; default is the most integrity on offer
  scenes?: Record<string, number>;
  // stop once the save reaches this chapter (6 means play to the ending)
  untilChapter?: number;
  // a hard mode run, which must never offer a hint
  hard?: boolean;
}

export async function save(page: Page): Promise<{ chapter: number; flags: string[]; done: string[] }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("dwell-time.save.v1") ?? "{}"));
}

export async function meta(page: Page): Promise<{ endings: string[]; achievements: string[] }> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("dwell-time.meta.v1") ?? "{}"));
}

/** Elements matching selector whose whole text is exactly text. */
function withText(scope: Locator | Page, selector: string, text: string): Locator {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return scope.locator(selector, { hasText: new RegExp(`^\\s*${escaped}\\s*$`) });
}

function best<T extends { integrity?: number }>(options: T[]): number {
  let at = 0;
  options.forEach((o, i) => {
    if ((o.integrity ?? 0) > (options[at].integrity ?? 0)) at = i;
  });
  return at;
}

/** Play from wherever the page is until the plan's chapter or the ending card. Returns the ending title, if reached. */
export async function play(page: Page, plan: Plan): Promise<string | null> {
  const until = plan.untilChapter ?? 6;
  for (let step = 0; step < 3000; step++) {
    if ((await page.locator(".ending-card").count()) > 0) return page.locator(".ending-title").innerText();
    if (until < 6 && (await save(page)).chapter >= until) return null;

    // dialogue: advance one line
    const vn = page.locator(".vn[role=button]");
    if (await vn.count()) {
      await vn.click();
      continue;
    }
    // a story choice at the end of a scene
    if (await page.locator(".vn-choice").count()) {
      await chooseInScene(page, plan);
      continue;
    }
    if (await page.locator(".title-card").count()) {
      const cont = page.getByRole("button", { name: /^Continue as / });
      if (await cont.count()) await cont.click();
      else {
        await page.fill("#player-name", plan.name);
        await page.getByRole("button", { name: "Apply to Lanternhouse" }).click();
      }
      continue;
    }
    if (await page.locator(".track-grid").count()) {
      await page.locator(".track-card", { hasText: DEPT_LABEL[plan.track] }).click();
      continue;
    }
    if (await page.locator(".iv-card").count()) {
      await answerInterview(page, plan.track);
      continue;
    }
    if (await page.locator(".ws-title").count()) {
      await workCase(page, plan);
      continue;
    }
    if (await page.locator(".queue").count()) {
      const open = page.locator(".ticket-card:not(.done)");
      if (await open.count()) await open.first().click();
      else await page.locator(".desk-footer .btn.primary").click();
      continue;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`${plan.name}: did not finish`);
}

/** Work one case in practice mode, from its brief back to the practice list. */
export async function practiseCase(page: Page, title: string): Promise<void> {
  await page.locator(".overlay-panel .btn.choice", { hasText: title }).click();
  for (let step = 0; step < 200; step++) {
    if (await page.locator(".overlay-panel h2", { hasText: "Practice a case" }).count()) return;
    const vn = page.locator(".vn[role=button]");
    if (await vn.count()) {
      await vn.click();
      continue;
    }
    if (await page.locator(".ws-title").count()) {
      await workCase(page, { name: "practice", track: "soc" });
      continue;
    }
    await page.waitForTimeout(50);
  }
  throw new Error(`practice of "${title}" did not finish`);
}

async function chooseInScene(page: Page, plan: Plan): Promise<void> {
  const prompt = await page.locator(".vn-choice-prompt").innerText();
  const scene = SCENES.find((s) => s.choice?.prompt === prompt);
  expect(scene, `scene with choice "${prompt}"`).toBeDefined();
  const offered = await page.locator(".vn-choice .btn.choice").allInnerTexts();
  const options = scene!.choice!.options.filter((o) => offered.includes(o.text));
  const wanted = plan.scenes?.[scene!.id];
  const pick = wanted !== undefined ? scene!.choice!.options[wanted] : options[best(options)];
  expect(offered, `${scene!.id}: option "${pick.text}" is on offer`).toContain(pick.text);
  await withText(page, ".vn-choice .btn.choice", pick.text).click();
}

async function answerInterview(page: Page, track: Dept): Promise<void> {
  const card = page.locator(".iv-card");
  const prompt = await card.locator(".q-prompt").innerText();
  const q = interviewFor(track)!.questions.find((x) => x.prompt === prompt);
  expect(q, `interview question "${prompt}"`).toBeDefined();
  await withText(card, ".opt", q!.options[q!.answer]).click();
  await expect(card.locator(".opt.correct")).toHaveText(q!.options[q!.answer]);
  await card.locator(".explain button").click();
}

async function workCase(page: Page, plan: Plan): Promise<void> {
  const close = page.getByRole("button", { name: "Close the case" });
  if (await close.count()) {
    await close.click();
    return;
  }
  const title = await page.locator(".ws-title").innerText();
  const t = TICKETS.find((x) => x.title === title);
  expect(t, `case "${title}"`).toBeDefined();
  const blocks = page.locator(".q-panel .q-block");
  await expect(blocks).toHaveCount(t!.questions.length);
  if (plan.hard) await expect(page.locator(".hint-btn")).toHaveCount(0);
  for (let i = 0; i < t!.questions.length; i++) await answer(page, blocks.nth(i), t!.questions[i], plan);
  await page.getByRole("button", { name: "Submit findings" }).click();
  await expect(close, `${t!.id} should close on the first submit`).toBeVisible();
  await expect(page.locator(".ws-feedback .good-note")).toBeVisible();
}

async function answer(page: Page, block: Locator, q: Question, plan: Plan): Promise<void> {
  const opt = (text: string): Locator => withText(block, ".opt", text);
  switch (q.type) {
    case "single":
      await opt(q.options[q.answer]).click();
      return;
    case "multi":
      for (const i of q.answer) await opt(q.options[i]).click();
      return;
    case "order":
      // move each item up into place, top to bottom
      for (let k = 0; k < q.items.length; k++) {
        let pos = (await block.locator(".ord-text").allInnerTexts()).indexOf(q.items[k]);
        while (pos > k) {
          await block.locator(".q-order li").nth(pos).locator(".ord-arrow").first().click();
          pos--;
        }
      }
      expect(await block.locator(".ord-text").allInnerTexts()).toEqual(q.items);
      return;
    case "typed":
      // do it the way a player would: run the command, read the output, type the answer
      if (q.solution) {
        const tool = page.locator(`[data-ev="${q.solution.evidence}"]`);
        const pivot = (await tool.locator(".pv-input").count()) > 0;
        const siem = (await tool.locator(".siem-input").count()) > 0;
        const box = tool.locator(pivot ? ".pv-input" : siem ? ".siem-input" : ".term-input");
        await box.fill(q.solution.command);
        await box.press("Enter");
        await expect(tool.locator(pivot ? ".pv-results" : siem ? ".siem-results" : ".term-out")).toContainText(q.answer[0]);
      }
      await block.locator(".typed-input").fill(q.answer[0]);
      return;
    case "rules": {
      const fw = page.locator(`[data-ev="${q.evidence}"]`);
      await fw.locator(".fw-rules").fill(q.solution);
      await fw.getByRole("button", { name: "Replay traffic" }).click();
      await expect(fw.locator(".fw-status")).toHaveClass(/good/);
      return;
    }
    case "request": {
      const rq = page.locator(`[data-ev="${q.evidence}"]`);
      const box = rq.locator(".req-input");
      await rq.getByRole("button", { name: "Send" }).click();
      // change the booking id to one that is not ours and send again
      const text = await box.inputValue();
      await box.fill(text.replace("id=1041", "id=1042"));
      await rq.getByRole("button", { name: "Send" }).click();
      await expect(rq.locator(".req-response")).toContainText("belongs_to_this_session");
      return;
    }
    case "merge": {
      const tl = page.locator(`[data-ev="${q.evidence}"]`);
      const ev = TICKETS.flatMap((t) => t.evidence).find((e) => e.id === q.evidence);
      if (ev?.kind !== "merge") throw new Error(`${q.evidence} is not a timeline builder`);
      for (const src of ev.sources) await tl.locator(`select[data-source="${src.id}"]`).selectOption(String(src.offset));
      return;
    }
    case "console": {
      const adm = page.locator(`[data-ev="${q.evidence}"]`);
      for (const a of q.solution) {
        await adm.locator(`.adm-user[data-upn="${a.upn}"]`).click();
        if (a.type === "delete-rule") await adm.locator(`[data-act="delete-rule"][data-rule="${a.rule}"]`).click();
        else if (a.type === "mfa") {
          await adm.locator(`select[data-act="mfa"]`).selectOption(a.method);
          await adm.locator(`[data-act="save-mfa"]`).click();
        } else if (a.type === "block" || a.type === "delete-user") throw new Error("the bot never blocks or deletes");
        else await adm.locator(`[data-act="${a.type}"]`).click();
      }
      return;
    }
    case "spot":
      await block.locator(".spot-btn").click();
      await page.locator(`[data-ev="${q.evidence}"] [data-pick="${q.answer[0]}"]`).click();
      return;
    case "decision": {
      const i = plan.decisions?.[q.id] ?? best(q.options);
      await withText(block, ".decision-opt", q.options[i].text).click();
      return;
    }
  }
}
