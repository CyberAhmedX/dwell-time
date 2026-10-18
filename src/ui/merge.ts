import type { MergeEvidence } from "../engine/types";
import { mergeTimeline, OFFSETS, offsetLabel } from "../engine/timeline";
import { el, mount } from "./dom";

// The timeline builder: one card per log source with its clock setting, and
// the merged timeline underneath, re-sorted on UTC every time a clock changes.
//
// Each change fires a "tool-command" event, so the case can count them.

const offsetsByView = new WeakMap<HTMLElement, Record<string, number>>();

/** The clock settings currently chosen in a builder, for the question that grades it. */
export function mergeOffsetsOf(view: HTMLElement): Record<string, number> | undefined {
  const body = view.matches(".tlb") ? view : view.querySelector<HTMLElement>(".tlb");
  return body ? offsetsByView.get(body) : undefined;
}

export function mergeView(ev: MergeEvidence): HTMLElement {
  const offsets: Record<string, number> = Object.fromEntries(ev.sources.map((s) => [s.id, 0]));
  const merged = el("div", { class: "tlb-merged" });
  const sources = el(
    "div",
    { class: "tlb-sources" },
    ev.sources.map((src) => {
      const sel = el("select", { class: "tlb-offset", "data-source": src.id, "aria-label": `Clock for ${src.name}` }) as HTMLSelectElement;
      for (const h of OFFSETS) {
        const o = el("option", { value: String(h), text: h === 0 ? "UTC (not adjusted)" : offsetLabel(h) }) as HTMLOptionElement;
        o.selected = h === 0;
        sel.append(o);
      }
      sel.addEventListener("change", () => {
        offsets[src.id] = Number(sel.value);
        draw();
        body.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "merge", evidence: ev.id, line: `${src.id}=${sel.value}` } }));
      });
      return el("div", { class: "tlb-src" }, [
        el("div", { class: "tlb-src-name", text: src.name }),
        el("p", { class: "tlb-src-note", text: src.note }),
        el("label", { class: "tlb-src-clock" }, [el("span", { text: "This log's clock is" }), sel]),
      ]);
    }),
  );
  const body = el("div", { class: "tlb" }, [
    ev.caption ? el("p", { class: "tlb-caption", text: ev.caption }) : el("span"),
    sources,
    el("div", { class: "tlb-merged-head", text: "Merged timeline, in UTC" }),
    merged,
  ]);
  offsetsByView.set(body, offsets);

  const draw = (): void => {
    const rows = mergeTimeline(ev.sources, offsets).map((e) =>
      el("tr", {}, [el("td", { class: "mono", text: e.utc }), el("td", { class: "tlb-tag", text: e.source.name }), el("td", { text: e.text })]),
    );
    mount(
      merged,
      el("div", { class: "log-scroll" }, [
        el("table", { class: "log tlb-table" }, [
          el("thead", {}, [el("tr", {}, ["UTC", "Source", "Event"].map((h) => el("th", { text: h })))]),
          el("tbody", {}, rows),
        ]),
      ]),
    );
  };
  draw();
  return body;
}
