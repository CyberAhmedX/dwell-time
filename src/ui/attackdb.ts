import type { AttackDbEvidence } from "../engine/types";
import { el, mount } from "./dom";

// An offline ATT&CK lookup: type a word or an ID, see the matching techniques.
// Looking an ID up is the job; nobody remembers all of them.
//
// Each search fires a "tool-command" event, so the case can count them.

export function attackDbView(ev: AttackDbEvidence): HTMLElement {
  const input = el("input", {
    class: "pv-input",
    type: "text",
    "aria-label": `Search ${ev.label}`,
    placeholder: "A word like password or mailbox, or an ID like T1078",
    autocomplete: "off",
    autocapitalize: "off",
    spellcheck: "false",
    enterkeyhint: "search",
  }) as HTMLInputElement;
  const go = el("button", { class: "siem-go", type: "button", text: "Search" });
  const status = el("p", { class: "pv-status", role: "status" });
  const results = el("div", { class: "ak-results" });
  const body = el("div", { class: "pv" }, [el("div", { class: "siem-bar" }, [input, go]), status, results]);

  const show = (count: boolean): void => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = ev.techniques.filter((t) => {
      const hay = `${t.id} ${t.name} ${t.tactic} ${t.summary}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    status.textContent = words.length ? `${hits.length} technique${hits.length === 1 ? "" : "s"} match` : `${ev.techniques.length} techniques. Search to narrow them down.`;
    mount(
      results,
      ...hits.slice(0, words.length ? 12 : 0).map((t) =>
        el("div", { class: "ak-item" }, [
          el("div", { class: "ak-top" }, [el("span", { class: "ak-id mono", text: t.id }), el("span", { class: "ak-name", text: t.name }), el("span", { class: "ak-tactic", text: t.tactic })]),
          el("p", { class: "ak-sum", text: t.summary }),
        ]),
      ),
    );
    if (count && words.length) body.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "attackdb", evidence: ev.id, line: input.value } }));
  };
  go.addEventListener("click", () => show(true));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      show(true);
    }
  });
  show(false);
  return body;
}
