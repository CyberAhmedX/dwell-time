// Typed answers are compared loosely: case, spacing, quotes, a trailing dot and
// defanging ([.] and hxxp) do not matter, so the player is judged on what they
// found, not on how they typed it.
export function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\[\.\]|\(\.\)|\{\.\}/g, ".")
    .replace(/^hxxp/, "http")
    .replace(/\s+/g, " ")
    .replace(/\.$/, "");
}

export function answerMatches(given: string, accepted: readonly string[]): boolean {
  const g = normalizeAnswer(given);
  return g !== "" && accepted.some((a) => normalizeAnswer(a) === g);
}
