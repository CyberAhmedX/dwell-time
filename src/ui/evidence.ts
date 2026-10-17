import type { Evidence, TreeNode } from "../engine/types";
import { el } from "./dom";

// Render each evidence kind into its own little viewer. These are the "tools"
// the analyst reads: an email client, a log table, a chat, a flow summary, a
// process tree, a timeline, a sticky note.

export function renderEvidence(ev: Evidence): HTMLElement {
  switch (ev.kind) {
    case "email":
      return emailView(ev);
    case "log":
      return logView(ev);
    case "chat":
      return chatView(ev);
    case "flow":
      return flowView(ev);
    case "tree":
      return treeView(ev);
    case "timeline":
      return timelineView(ev);
    case "note":
      return noteView(ev);
  }
}

function shell(label: string, tag: string, body: HTMLElement): HTMLElement {
  return el("div", { class: "ev" }, [
    el("div", { class: "ev-head" }, [
      el("span", { class: "ev-tag", text: tag }),
      el("span", { class: "ev-label", text: label }),
    ]),
    body,
  ]);
}

function emailView(ev: Extract<Evidence, { kind: "email" }>): HTMLElement {
  const rows: HTMLElement[] = [
    row("From", ev.from),
    row("To", ev.to),
    row("Date", ev.date),
    row("Subject", ev.subject),
  ];
  if (ev.headers) {
    for (const [k, v] of Object.entries(ev.headers)) rows.push(row(k, v, true));
  }
  const body = el("div", { class: "mail" }, [
    el("div", { class: "mail-hdr" }, rows),
    el("div", { class: "mail-body" }, ev.body.map((p) => el("p", { text: p }))),
  ]);
  return shell(ev.label, "EMAIL", body);

  function row(k: string, v: string, mono = false): HTMLElement {
    return el("div", { class: "mail-row" }, [
      el("span", { class: "mail-k", text: k }),
      el("span", { class: mono ? "mail-v mono" : "mail-v", text: v }),
    ]);
  }
}

function logView(ev: Extract<Evidence, { kind: "log" }>): HTMLElement {
  const wrap = el("div", { class: "logwrap" });
  const input = el("input", { class: "log-filter", type: "text", placeholder: "Filter rows..." }) as HTMLInputElement;
  const table = el("table", { class: "log" });
  const thead = el("thead", {}, [el("tr", {}, ev.columns.map((c) => el("th", { text: c })))]);
  const tbody = el("tbody");
  const draw = (q: string): void => {
    tbody.replaceChildren();
    const ql = q.toLowerCase();
    for (const r of ev.rows) {
      if (ql && !r.join(" ").toLowerCase().includes(ql)) continue;
      const suspicious = r.join(" ").match(/rule created|203\.0\.113|unknown|tunnel|svc_|probe/i);
      tbody.append(el("tr", { class: suspicious ? "row-bad" : "" }, r.map((c) => el("td", { text: c }))));
    }
  };
  input.addEventListener("input", () => draw(input.value));
  draw("");
  table.append(thead, tbody);
  wrap.append(
    el("div", { class: "log-src", text: ev.source }),
    input,
    el("div", { class: "log-scroll" }, [table]),
  );
  return shell(ev.label, "LOG", wrap);
}

function chatView(ev: Extract<Evidence, { kind: "chat" }>): HTMLElement {
  const body = el(
    "div",
    { class: "chat" },
    ev.lines.map((l) =>
      el("div", { class: l.self ? "bubble me" : "bubble them" }, [
        el("span", { class: "who", text: l.who === "you" ? "You" : l.who.toUpperCase() }),
        el("span", { class: "msg", text: l.text }),
      ]),
    ),
  );
  return shell(ev.label, "CHAT", body);
}

function flowView(ev: Extract<Evidence, { kind: "flow" }>): HTMLElement {
  const rows = ev.rows.map((r) =>
    el("tr", { class: r.note && /huge|again|boundary|the same|growing|testing/i.test(r.note) ? "row-bad" : "" }, [
      el("td", { class: "mono", text: r.src }),
      el("td", { class: "arrow", text: "->" }),
      el("td", { class: "mono", text: r.dst }),
      el("td", { class: "mono", text: r.port }),
      el("td", { class: "mono", text: r.bytes }),
      el("td", { class: "note", text: r.note ?? "" }),
    ]),
  );
  const table = el("table", { class: "flow" }, [
    el("thead", {}, [el("tr", {}, ["Source", "", "Destination", "Port", "Volume", "Note"].map((h) => el("th", { text: h })))]),
    el("tbody", {}, rows),
  ]);
  const body = el("div", { class: "flowwrap" }, [
    ev.caption ? el("div", { class: "cap", text: ev.caption }) : el("span"),
    el("div", { class: "log-scroll" }, [table]),
  ]);
  return shell(ev.label, "FLOW", body);
}

function treeView(ev: Extract<Evidence, { kind: "tree" }>): HTMLElement {
  const body = el("div", { class: "tree" }, [
    ev.caption ? el("div", { class: "cap", text: ev.caption }) : el("span"),
    treeNode(ev.root, 0),
  ]);
  return shell(ev.label, "PROCESS", body);
}

function treeNode(n: TreeNode, depth: number): HTMLElement {
  const line = el("div", { class: n.suspicious ? "tnode bad" : "tnode", style: `margin-left:${depth * 16}px` }, [
    el("span", { class: "tglyph", text: depth === 0 ? "#" : "+-" }),
    el("span", { class: "tname mono", text: n.name }),
    n.detail ? el("span", { class: "tdetail", text: " " + n.detail }) : el("span"),
  ]);
  const wrap = el("div", {}, [line]);
  if (n.children) for (const c of n.children) wrap.append(treeNode(c, depth + 1));
  return wrap;
}

function timelineView(ev: Extract<Evidence, { kind: "timeline" }>): HTMLElement {
  const body = el(
    "div",
    { class: "timeline" },
    ev.events.map((e) =>
      el("div", { class: `tl ${e.mark ?? "info"}` }, [
        el("span", { class: "tl-dot" }),
        el("span", { class: "tl-time", text: e.time }),
        el("span", { class: "tl-text", text: e.text }),
      ]),
    ),
  );
  return shell(ev.label, "TIMELINE", body);
}

function noteView(ev: Extract<Evidence, { kind: "note" }>): HTMLElement {
  const body = el("div", { class: "note-paper" }, [
    el("div", { class: "note-title", text: ev.title }),
    ...ev.lines.map((l) => el("p", { class: "note-line", text: l })),
  ]);
  return shell(ev.label, "NOTE", body);
}
