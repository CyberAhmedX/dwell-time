import type { PivotEvidence } from "../engine/types";
import { lookup } from "../engine/pivot";
import { el, mount } from "./dom";

// The pivot board: search a name or an address, see every record for it, and
// click any result to pivot to that side. The trail along the top shows the
// path you took, which is how an intel analyst maps out infrastructure.
//
// Each search fires a "tool-command" event, so the case can count them.

export function pivotView(ev: PivotEvidence): HTMLElement {
  const input = el("input", {
    class: "pv-input",
    type: "text",
    "aria-label": `Search ${ev.label}`,
    placeholder: "A domain or an address",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    enterkeyhint: "search",
  }) as HTMLInputElement;
  const go = el("button", { class: "siem-go", type: "button", text: "Look up" });
  const trail = el("div", { class: "pv-trail", "aria-label": "Your trail" });
  const status = el("p", { class: "pv-status", role: "status" });
  const results = el("div", { class: "pv-results" });
  const body = el("div", { class: "pv" }, [
    ev.caption ? el("p", { class: "pv-caption", text: ev.caption }) : el("span"),
    el("div", { class: "siem-bar" }, [input, go]),
    trail,
    status,
    results,
  ]);

  const seen: string[] = [];

  const show = (term: string, count: boolean): void => {
    const t = term.trim();
    if (!t) return;
    input.value = t;
    const hits = lookup(ev.db, t);
    if (!seen.includes(t.toLowerCase())) seen.push(t.toLowerCase());
    mount(
      trail,
      ...seen.map((s) => {
        const b = el("button", { class: "pv-crumb", type: "button", text: s });
        b.addEventListener("click", () => show(s, true));
        return b;
      }),
    );
    status.textContent = hits.length
      ? `${hits.length} record${hits.length === 1 ? "" : "s"} for ${t}`
      : `Nothing on record for ${t}. Check the spelling, or pivot from something you have.`;
    if (!hits.length) {
      results.replaceChildren();
      return;
    }
    const cell = (value: string): HTMLElement => {
      const b = el("button", { class: "pv-link", type: "button", text: value, title: `Look up ${value}` });
      b.addEventListener("click", () => show(value, true));
      return el("td", {}, [b]);
    };
    const rows = hits.map((r) =>
      el("tr", {}, [
        cell(r.domain),
        cell(r.ip),
        el("td", { class: "mono pv-dates", text: `${r.firstSeen} to ${r.lastSeen}` }),
        el("td", { text: r.note ?? "" }),
      ]),
    );
    mount(
      results,
      el("div", { class: "log-scroll" }, [
        el("table", { class: "log pv-table" }, [
          el("thead", {}, [el("tr", {}, ["Name", "Address", "Seen", "Note"].map((h) => el("th", { text: h })))]),
          el("tbody", {}, rows),
        ]),
      ]),
    );
    if (count) body.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "pivot", evidence: ev.id, line: t } }));
  };

  const run = (): void => show(input.value, true);
  go.addEventListener("click", run);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
  });

  show(ev.start, false);
  return body;
}
