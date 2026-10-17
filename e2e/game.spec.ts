import { test, expect, type Page } from "@playwright/test";
import { play, save, meta, type Plan } from "./bot";
import { ENDINGS } from "../src/engine/endings";
import { DEPTS, DEPT_LABEL } from "../src/engine/types";
import { TICKETS } from "../src/content/tickets";
import { trackFlag } from "../src/engine/state";

const GAME = new URL("../dist/index.html", import.meta.url).href;

async function replayChapter(page: Page, title: string): Promise<void> {
  await page.goto(GAME);
  await page.getByRole("button", { name: "Replay a chapter" }).click();
  await page.locator(".overlay-panel .btn.choice", { hasText: title }).click();
}

test("one full run, then every other ending through chapter select", async ({ page }) => {
  test.setTimeout(6 * 60_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(GAME);

  // A clean run: right first time, no hints, every side case, the principled choice everywhere.
  const base: Plan = { name: "Riley", track: "soc" };
  expect(await play(page, base)).toBe(ENDINGS.lighthouse.title);
  const clean = await meta(page);
  for (const id of ["first_try", "chain", "scope", "lead", "by_the_book", "clean_hands", "no_hints", "side_work"]) {
    expect(clean.achievements, id).toContain(id);
  }

  // Break the chain of custody in chapter three and report anyway.
  await replayChapter(page, "Chapter Three");
  expect(await play(page, { ...base, decisions: { q_clinic_walter: 1 } })).toBe(ENDINGS.crackedlens.title);

  // The last chapter decides the rest.
  await replayChapter(page, "Chapter Five");
  expect(await play(page, { ...base, scenes: { s5_evidence: 1 } })).toBe(ENDINGS.lowtide.title);
  await replayChapter(page, "Chapter Five");
  expect(await play(page, { ...base, scenes: { s5_evidence: 2 } })).toBe(ENDINGS.keeper.title);
  await replayChapter(page, "Chapter Five");
  expect(await play(page, { ...base, scenes: { s5_contain: 1 } })).toBe(ENDINGS.deadwater.title);

  const all = await meta(page);
  expect([...all.endings].sort()).toEqual(Object.keys(ENDINGS).sort());
  expect(all.achievements).toContain("every_ending");

  // the gallery shows all five
  await page.getByRole("button", { name: "Endings and achievements" }).click();
  await expect(page.locator(".gal-item.seen")).toHaveCount(Object.keys(ENDINGS).length + all.achievements.length);
  expect(errors).toEqual([]);
});

for (const dept of DEPTS) {
  test(`the ${DEPT_LABEL[dept]} hire gets their own case and nobody else's`, async ({ page }) => {
    test.setTimeout(2 * 60_000);
    await page.goto(GAME);
    expect(await play(page, { name: "Sam", track: dept, untilChapter: 3 })).toBeNull();
    const s = await save(page);
    const own = TICKETS.find((t) => t.requires?.includes(trackFlag(dept)))!;
    const others = TICKETS.filter((t) => t.requires?.some((f) => f.startsWith("track_")) && t !== own);
    expect(s.done).toContain(own.id);
    for (const t of others) expect(s.done).not.toContain(t.id);
  });
}
