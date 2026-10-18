import type { FirewallEvidence } from "../engine/types";
import { replay, RuleError } from "../engine/firewall";
import { el, mount } from "./dom";

// The firewall screen: the zones, an editable rule list, and a replay of test
// traffic that shows what each flow hits and whether that is what the policy
// wants. It replays once on arrival, so you see what is broken before you start.
//
// Each replay fires a "tool-command" event, so the case can count them.

export function firewallView(ev: FirewallEvidence): HTMLElement {
  const zones = el(
    "dl",
    { class: "fw-zones" },
    Object.entries(ev.zones).flatMap(([name, specs]) => [
      el("dt", { text: name }),
      el("dd", { text: specs.map((s) => (s.startsWith("!") ? `not ${s.slice(1)}` : s)).join(", ") }),
    ]),
  );
  const editor = el("textarea", {
    class: "fw-rules",
    rows: Math.max(5, ev.rules.split("\n").length + 2),
    spellcheck: "false",
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": `Rules for ${ev.label}`,
  }) as HTMLTextAreaElement;
  editor.value = ev.rules;
  const run = el("button", { class: "btn primary small", type: "button", text: "Replay traffic" });
  const reset = el("button", { class: "btn ghost small", type: "button", text: "Reset rules" });
  const status = el("p", { class: "fw-status", role: "status" });
  const results = el("div", { class: "fw-results" });
  const body = el("div", { class: "fw" }, [
    el("p", { class: "fw-help", text: "Rules are checked top to bottom; the first match wins, and anything unmatched is blocked." }),
    zones,
    editor,
    el("div", { class: "btn-row" }, [run, reset]),
    status,
    results,
  ]);

  const show = (count: boolean): void => {
    let verdicts;
    try {
      verdicts = replay(editor.value, ev.flows, ev.zones);
    } catch (e) {
      if (!(e instanceof RuleError)) throw e;
      status.className = "fw-status err";
      status.textContent = `Rule error, ${e.message}`;
      results.replaceChildren();
      return;
    }
    const good = verdicts.filter((v) => v.ok).length;
    status.className = good === ev.flows.length ? "fw-status good" : "fw-status";
    status.textContent = `${good} of ${ev.flows.length} flows behave the way the policy wants.`;
    const rows = ev.flows.map((f, i) => {
      const v = verdicts[i];
      // result and verdict first, so they stay in view on a narrow screen
      return el("tr", { class: v.ok ? "fw-ok" : "fw-bad" }, [
        el("td", { class: "fw-act", text: v.action === "allow" ? "ALLOWED" : "BLOCKED" }),
        el("td", { class: "fw-verdict", text: v.ok ? "Right" : `Should be ${f.want === "allow" ? "allowed" : "blocked"}` }),
        el("td", {}, [
          el("div", { text: f.what }),
          el("div", { class: "fw-flow mono", text: `${f.src} -> ${f.dst}:${f.port}/${f.proto}, ${v.rule ? `line ${v.rule.line}` : "no rule matched"}` }),
        ]),
      ]);
    });
    mount(
      results,
      el("div", { class: "log-scroll" }, [
        el("table", { class: "log fw-table" }, [
          el("thead", {}, [el("tr", {}, ["Result", "Policy", "Traffic"].map((h) => el("th", { text: h })))]),
          el("tbody", {}, rows),
        ]),
      ]),
    );
    if (count) body.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "firewall", evidence: ev.id, line: editor.value } }));
  };

  run.addEventListener("click", () => show(true));
  reset.addEventListener("click", () => {
    editor.value = ev.rules;
    show(false);
  });
  show(false);
  return body;
}
