// Tiny DOM helpers. No framework: the game is small enough to build by hand,
// and that keeps the single-file bundle lean.

type Attrs = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k === "class") node.className = String(v);
    else if (k === "text") node.textContent = String(v);
    else if (k === "html") node.innerHTML = String(v);
    else if (k.startsWith("data-") || k === "role" || k === "aria-label" || k === "type" || k === "id" || k === "for" || k === "value" || k === "placeholder" || k === "maxlength" || k === "min" || k === "max" || k === "step")
      node.setAttribute(k, String(v));
    else if (v === true) node.setAttribute(k, "");
    else node.setAttribute(k, String(v));
  }
  for (const c of children) node.append(c);
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(parent: HTMLElement, ...nodes: (Node | string)[]): void {
  clear(parent);
  for (const n of nodes) parent.append(n);
}

/** Shuffle a copy of an array (Fisher-Yates). Used for ordering questions. */
export function shuffled<T>(arr: readonly T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
