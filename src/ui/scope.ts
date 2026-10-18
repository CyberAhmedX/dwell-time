import type { ScopeEvidence } from "../engine/types";
import { checkScope, rangeInfo, ScopeError } from "../engine/scope";
import { el } from "./dom";

// The scope checker: the engagement's in and out lists, and a box that answers
// "may I touch this?" for an address, or spells out what a range covers.
//
// Each check fires a "tool-command" event, so the case can count them.

export function scopeView(ev: ScopeEvidence): HTMLElement {
  const input = el("input", {
    class: "pv-input sc-input",
    type: "text",
    "aria-label": "Address or range to check",
    placeholder: "An address, or a range",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    enterkeyhint: "go",
  }) as HTMLInputElement;
  const go = el("button", { class: "siem-go", type: "button", text: "Check" });
  const out = el("div", { class: "sc-out", role: "log", "aria-live": "polite" });
  const list = (title: string, items: string[], cls: string): HTMLElement =>
    el("div", { class: `sc-list ${cls}` }, [el("div", { class: "sc-list-head", text: title }), ...items.map((x) => el("div", { class: "mono", text: x }))]);
  const body = el("div", { class: "sc" }, [
    ev.note ? el("p", { class: "pv-caption", text: ev.note }) : el("span"),
    el("div", { class: "sc-lists" }, [list("In scope", ev.inScope, "in"), list("Out of scope", ev.outOfScope, "out")]),
    el("div", { class: "siem-bar" }, [input, go]),
    out,
  ]);

  const say = (text: string, cls: string): void => {
    out.prepend(el("p", { class: `sc-line ${cls}`, text }));
    while (out.children.length > 8) out.lastElementChild?.remove();
  };
  const run = (): void => {
    const q = input.value.trim();
    if (!q) return;
    try {
      if (q.includes("/")) {
        const r = rangeInfo(q);
        say(`${q}: ${r.size} addresses, ${r.network} to ${r.broadcast}. Hosts ${r.first} to ${r.last}.`, "info");
      } else {
        const v = checkScope(ev, q);
        say(`${q}: ${v.inScope ? "IN SCOPE" : "OUT OF SCOPE"}, ${v.reason}.`, v.inScope ? "in" : "out");
      }
    } catch (e) {
      if (!(e instanceof ScopeError)) throw e;
      say(e.message, "err");
      return;
    }
    input.select();
    body.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "scope", evidence: ev.id, line: q } }));
  };
  go.addEventListener("click", run);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    }
  });
  return body;
}
