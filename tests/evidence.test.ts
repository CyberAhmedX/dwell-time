import { describe, it, expect } from "vitest";
import { TICKETS } from "../src/content/tickets";
import { pickTargets } from "../src/engine/pick";
import { renderEvidence } from "../src/ui/evidence";

// The viewers and pickTargets() must agree on every clickable part, or a spot
// question could ask for something the player cannot click.
describe("evidence viewers", () => {
  const all = TICKETS.flatMap((t) => t.evidence);

  it("tag exactly the parts pickTargets lists", () => {
    for (const ev of all) {
      const view = renderEvidence(ev);
      const shown = [...view.querySelectorAll<HTMLElement>("[data-pick]")].map((x) => x.dataset.pick);
      expect(shown, ev.id).toEqual(pickTargets(ev).map((p) => p.key));
      expect(view.dataset.ev).toBe(ev.id);
    }
  });

  it("leave out warning marks in plain mode", () => {
    for (const ev of all) {
      const view = renderEvidence(ev, { plain: true });
      expect(view.querySelectorAll(".tnode.bad, .tl.bad, .tl.warn").length, ev.id).toBe(0);
    }
  });
});
