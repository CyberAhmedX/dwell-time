import type { TerminalEvidence } from "../engine/types";
import { runLine, complete } from "../engine/shell";
import { el } from "./dom";

// The in-game terminal. It looks and behaves like a shell: a prompt, history
// on the arrow keys, Tab to complete, and the output of each command under it.
// A row of keys helps on phones, where | and quotes are buried.
//
// Each command run fires a "tool-command" event, so the case can count them.

const PROMPT = "analyst@lanternhouse:~/case$";
const KEYS = ["|", "grep ", "sort ", "uniq -c ", "head ", "wc -l ", "cut -f", "'"];

export function terminalView(ev: TerminalEvidence): HTMLElement {
  const screen = el("pre", { class: "term-out", role: "log", "aria-live": "polite", "aria-label": `${ev.label} output` });
  const input = el("input", {
    class: "term-input",
    type: "text",
    "aria-label": `Command for ${ev.label}`,
    autocomplete: "off",
    autocapitalize: "off",
    autocorrect: "off",
    spellcheck: "false",
    enterkeyhint: "go",
  }) as HTMLInputElement;
  const line = el("div", { class: "term-line" }, [el("span", { class: "term-prompt", text: PROMPT }), input]);
  const keys = el(
    "div",
    { class: "term-keys", "aria-label": "Insert" },
    KEYS.map((k) => {
      const b = el("button", { class: "term-key", type: "button", text: k.trim() });
      b.addEventListener("click", () => insert(k === "|" ? " | " : k));
      return b;
    }),
  );
  const body = el("div", { class: "term" }, [screen, line, keys]);

  const history: string[] = [];
  let back = 0; // how far up the history we are

  const print = (text: string, cls?: string): void => {
    if (!text) return;
    const span = el("span", { class: cls ?? "", text: text + "\n" });
    screen.append(span);
    screen.scrollTop = screen.scrollHeight;
  };

  const insert = (text: string): void => {
    const at = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, at) + text + input.value.slice(input.selectionEnd ?? at);
    input.focus();
    input.setSelectionRange(at + text.length, at + text.length);
  };

  const run = (): void => {
    const cmd = input.value;
    input.value = "";
    back = 0;
    print(`${PROMPT} ${cmd}`, "term-echo");
    if (!cmd.trim()) return;
    history.push(cmd);
    const r = runLine(cmd, ev.files, history);
    if (r.clear) screen.replaceChildren();
    else print(r.out, r.error ? "term-err" : undefined);
    body.dispatchEvent(new CustomEvent("tool-command", { bubbles: true, detail: { kind: "terminal", evidence: ev.id, line: cmd } }));
  };

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      back = Math.max(0, Math.min(history.length, back + (e.key === "ArrowUp" ? 1 : -1)));
      input.value = back ? history[history.length - back] : "";
    } else if (e.key === "Tab") {
      e.preventDefault();
      const options = complete(input.value, ev.files);
      if (options.length === 1) {
        const words = input.value.split(/(\s+)/);
        words[words.length - 1] = options[0];
        input.value = words.join("") + " ";
      } else if (options.length > 1) {
        print(`${PROMPT} ${input.value}`, "term-echo");
        print(options.join("  "));
      }
    } else if (e.key === "l" && e.ctrlKey) {
      e.preventDefault();
      screen.replaceChildren();
    }
  });
  // a click anywhere on the screen goes to the prompt, unless text is being selected
  screen.addEventListener("click", () => {
    if (!window.getSelection()?.toString()) input.focus({ preventScroll: true });
  });

  print("Read-only copies of the case files. Type help for the commands, or start with ls.", "term-note");
  print(`${PROMPT} ls`, "term-echo");
  print(runLine("ls", ev.files).out);

  return body;
}
