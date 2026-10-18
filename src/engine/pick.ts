import type { Evidence, TreeNode } from "./types";

// The parts of an evidence item a player can click for a spot question, with a
// stable key for each. The evidence viewers tag elements with the same keys.

export interface PickTarget {
  key: string;
  label: string; // short text shown back as "Your pick"
}

export function pickTargets(ev: Evidence): PickTarget[] {
  switch (ev.kind) {
    case "terminal":
    case "siem":
    case "firewall":
      return []; // you type into these, you do not point at them
    case "email": {
      const out: PickTarget[] = [
        { key: "h:From", label: `From: ${ev.from}` },
        { key: "h:To", label: `To: ${ev.to}` },
        { key: "h:Date", label: `Date: ${ev.date}` },
        { key: "h:Subject", label: `Subject: ${ev.subject}` },
      ];
      for (const [k, v] of Object.entries(ev.headers ?? {})) out.push({ key: `h:${k}`, label: `${k}: ${v}` });
      ev.body.forEach((p, i) => out.push({ key: `p${i}`, label: p }));
      return out;
    }
    case "log":
      return ev.rows.map((r, i) => ({ key: `r${i}`, label: r.join("  ") }));
    case "flow":
      return ev.rows.map((r, i) => ({ key: `r${i}`, label: `${r.src} -> ${r.dst} (${r.port}, ${r.bytes})` }));
    case "chat":
      return ev.lines.map((l, i) => ({ key: `c${i}`, label: l.text }));
    case "tree":
      return treeNodes(ev.root).map((n, i) => ({ key: `n${i}`, label: n.name }));
    case "timeline":
      return ev.events.map((e, i) => ({ key: `e${i}`, label: `${e.time}: ${e.text}` }));
    case "note":
      return ev.lines.map((l, i) => ({ key: `l${i}`, label: l }));
  }
}

/** Tree nodes in depth-first order, the order their keys are numbered in. */
export function treeNodes(root: TreeNode): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (n: TreeNode): void => {
    out.push(n);
    n.children?.forEach(walk);
  };
  walk(root);
  return out;
}
