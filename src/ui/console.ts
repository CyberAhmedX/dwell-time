import type { ConsoleEvidence } from "../engine/types";
import { initConsole, act, MFA_LABEL, type ConsoleAction, type ConsoleState, type MfaMethod } from "../engine/console";
import { el, mount } from "./dom";

// The admin console screen: the organisation's users on one side, the chosen
// user's sessions, mailbox rules, password and MFA on the other, and an
// activity log of everything you did. Destructive buttons ask twice.
//
// Each action fires a "tool-command" event, so the case can count them.

const states = new WeakMap<HTMLElement, ConsoleState>();

/** The live state behind a console view, for the question that grades it. */
export function consoleStateOf(view: HTMLElement): ConsoleState | undefined {
  const body = view.matches(".adm") ? view : view.querySelector<HTMLElement>(".adm");
  return body ? states.get(body) : undefined;
}

export function consoleView(ev: ConsoleEvidence): HTMLElement {
  const state = initConsole(ev.users);
  const list = el("div", { class: "adm-users", role: "list", "aria-label": "Users" });
  const panel = el("div", { class: "adm-panel" });
  const log = el("ol", { class: "adm-log", "aria-label": "Activity" });
  const body = el("div", { class: "adm" }, [
    el("div", { class: "adm-tenant", text: `${ev.tenant} · Admin center` }),
    el("div", { class: "adm-main" }, [list, panel]),
    el("div", { class: "adm-log-head", text: "Activity" }),
    log,
  ]);
  states.set(body, state);
  let selected = ev.users[0]?.upn ?? "";

  const doAct = (a: ConsoleAction): void => {
    act(state, a, ev.intruder);
    body.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "console", evidence: ev.id, line: a.type } }));
    draw();
  };

  const twice = (label: string, sure: string, onConfirm: () => void, attrs: Record<string, string> = {}): HTMLElement => {
    const b = el("button", { class: "btn danger small", type: "button", text: label, ...attrs });
    let armed = false;
    b.addEventListener("click", () => {
      if (!armed) {
        armed = true;
        b.textContent = sure;
        return;
      }
      onConfirm();
    });
    return b;
  };

  const draw = (): void => {
    // user list
    mount(
      list,
      ...state.users.map((u) => {
        const b = el("button", { class: `adm-user${u.upn === selected ? " sel" : ""}${u.deleted ? " gone" : ""}`, type: "button", "data-upn": u.upn, role: "listitem" }, [
          el("span", { class: "adm-user-name", text: u.name }),
          el("span", { class: "adm-user-upn", text: u.upn }),
          el("span", { class: "adm-user-role", text: u.deleted ? "Deleted" : u.blocked ? `${u.role} · blocked` : u.role }),
        ]);
        b.addEventListener("click", () => {
          selected = u.upn;
          draw();
        });
        return b;
      }),
    );

    // the chosen user
    const u = state.users.find((x) => x.upn === selected);
    if (!u) {
      mount(panel, el("p", { class: "muted", text: "Pick a user." }));
    } else if (u.deleted) {
      mount(panel, el("h4", { class: "adm-name", text: u.name }), el("p", { class: "muted", text: "This account has been deleted." }));
    } else {
      const sessions = u.sessions.length
        ? el("div", { class: "log-scroll" }, [
            el("table", { class: "log adm-table" }, [
              el("thead", {}, [el("tr", {}, ["Device", "Address", "Location", "Since"].map((h) => el("th", { text: h })))]),
              el("tbody", {}, u.sessions.map((s) => el("tr", {}, [s.device, s.ip, s.place, s.since].map((c) => el("td", { text: c }))))),
            ]),
          ])
        : el("p", { class: "muted", text: "No active sessions." });
      const revoke = el("button", { class: "btn ghost small", type: "button", text: "Revoke all sessions", "data-act": "revoke" });
      revoke.addEventListener("click", () => doAct({ type: "revoke", upn: u.upn }));

      const rules = u.rules.length
        ? el(
            "ul",
            { class: "adm-rules" },
            u.rules.map((r) => {
              const del = el("button", { class: "btn ghost small", type: "button", text: "Delete", "data-act": "delete-rule", "data-rule": r.id, "aria-label": `Delete rule ${r.name}` });
              del.addEventListener("click", () => doAct({ type: "delete-rule", upn: u.upn, rule: r.id }));
              return el("li", {}, [el("div", {}, [el("span", { class: "adm-rule-name", text: `Rule "${r.name}"` }), el("span", { class: "adm-rule-sum", text: r.summary })]), del]);
            }),
          )
        : el("p", { class: "muted", text: "No mailbox rules." });

      const reset = el("button", { class: "btn ghost small", type: "button", text: u.passwordReset ? "Reset password again" : "Reset password", "data-act": "reset" });
      reset.addEventListener("click", () => doAct({ type: "reset", upn: u.upn }));

      const mfa = el("select", { class: "adm-mfa", "aria-label": "MFA method", "data-act": "mfa" }) as HTMLSelectElement;
      for (const m of Object.keys(MFA_LABEL) as MfaMethod[]) {
        const o = el("option", { value: m, text: MFA_LABEL[m] }) as HTMLOptionElement;
        o.selected = m === u.mfa;
        mfa.append(o);
      }
      const saveMfa = el("button", { class: "btn ghost small", type: "button", text: "Save MFA", "data-act": "save-mfa" });
      saveMfa.addEventListener("click", () => doAct({ type: "mfa", upn: u.upn, method: mfa.value as MfaMethod }));

      const block = u.blocked
        ? el("button", { class: "btn ghost small", type: "button", text: "Allow sign-in", "data-act": "unblock" })
        : twice("Block sign-in", "Block this account? Tap again", () => doAct({ type: "block", upn: u.upn, on: true }), { "data-act": "block" });
      if (u.blocked) block.addEventListener("click", () => doAct({ type: "block", upn: u.upn, on: false }));
      const remove = twice("Delete user", "Delete the account and mailbox? Tap again", () => doAct({ type: "delete-user", upn: u.upn }), { "data-act": "delete-user" });

      mount(
        panel,
        el("h4", { class: "adm-name", text: u.name }),
        el("p", { class: "adm-sub", text: `${u.upn} · ${u.role}${u.blocked ? " · sign-in blocked" : ""}${u.passwordReset ? " · password reset" : ""}` }),
        el("div", { class: "adm-sec" }, [el("div", { class: "adm-sec-head", text: "Sign-in sessions" }), sessions, revoke]),
        el("div", { class: "adm-sec" }, [el("div", { class: "adm-sec-head", text: "Mailbox rules" }), rules]),
        el("div", { class: "adm-sec" }, [
          el("div", { class: "adm-sec-head", text: "Password and MFA" }),
          el("div", { class: "btn-row" }, [reset]),
          el("div", { class: "btn-row" }, [mfa, saveMfa]),
        ]),
        el("div", { class: "adm-sec danger-zone" }, [el("div", { class: "adm-sec-head", text: "Account" }), el("div", { class: "btn-row" }, [block, remove])]),
      );
    }

    // activity
    mount(
      log,
      ...(state.log.length ? state.log.map((l) => el("li", { class: l.warn ? "warn" : "", text: l.note })) : [el("li", { class: "muted", text: "Nothing done yet." })]),
    );
  };

  draw();
  return body;
}
