// Indicators of compromise, and defanging them. A report that lists
// evil.example as evil[.]example, and http as hxxp, cannot be clicked by a
// reader or turned into a live link by a mail client or chat app. Block lists
// get refanged by the tool that loads them, never by hand.

const IP = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

/** Make an indicator safe to paste: dots become [.], http becomes hxxp. */
export function defang(text: string): string {
  return text
    .replace(/\bhttp(s?):\/\//gi, "hxxp$1://")
    .replace(/(?<!\[)\.(?!\])/g, "[.]");
}

/** Undo any common defanging, for comparing indicators. */
export function refang(text: string): string {
  return text
    .trim()
    .replace(/\[\.\]|\(\.\)|\{\.\}|\[dot\]/gi, ".")
    .replace(/^hxxp/i, "http")
    .replace(/\[:\]\/\//g, "://")
    .replace(/\.$/, "")
    .toLowerCase();
}

/**
 * Is this indicator safe to paste? The convention only needs the last dot of
 * the host broken (data.evil[.]example, 203.0.113[.]77) and no live http link.
 * Hashes have no dots and need nothing.
 */
export function isDefanged(text: string): boolean {
  const t = text.trim().replace(/\(\.\)|\{\.\}|\[dot\]/gi, "[.]");
  if (/^https?:/i.test(t)) return false;
  const host = t.replace(/^hxxps?(\[:\]|:)\/\//i, "").split("/")[0];
  const last = host.lastIndexOf("[.]");
  const tail = last === -1 ? host : host.slice(last + 3);
  return !tail.includes(".");
}

export function isIp(text: string): boolean {
  const m = IP.exec(refang(text));
  return !!m && m.slice(1).every((p) => Number(p) <= 255);
}

export interface IocGrade {
  ok: boolean;
  missing: string[]; // expected indicators not listed
  extra: string[]; // listed, but not expected
  live: string[]; // listed without defanging
}

/** Split a pasted list on new lines, commas and spaces. */
export function splitIocs(text: string): string[] {
  return text
    .split(/[\s,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Grade a pasted block list against the indicators that should be on it. */
export function gradeIocs(text: string, expected: readonly string[]): IocGrade {
  const given = splitIocs(text);
  const want = new Set(expected.map(refang));
  const have = new Set(given.map(refang));
  const missing = [...want].filter((x) => !have.has(x));
  const extra = [...have].filter((x) => !want.has(x));
  const live = given.filter((g) => !isDefanged(g));
  return { ok: missing.length === 0 && extra.length === 0 && live.length === 0 && given.length > 0, missing, extra, live };
}
