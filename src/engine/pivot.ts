// Passive DNS records for the intel pivot board: a history of which names
// pointed at which addresses, and when. Analysts use this to map out the rest
// of an actor's infrastructure from one known name, so it can all be blocked
// at once. Every name and address here is fictional.

export interface PassiveRecord {
  domain: string;
  ip: string;
  firstSeen: string; // YYYY-MM-DD
  lastSeen: string;
  note?: string; // what this name was used for, once it is known
}

export interface PivotDb {
  records: PassiveRecord[];
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/\[\.\]/g, ".").replace(/\.$/, "");

/** Is this a dotted quad rather than a name? */
export function looksLikeIp(term: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(norm(term));
}

/** Every record for a name or an address. Unknown terms give an empty list. */
export function lookup(db: PivotDb, term: string): PassiveRecord[] {
  const t = norm(term);
  if (!t) return [];
  const key = looksLikeIp(t) ? "ip" : "domain";
  return db.records.filter((r) => norm(r[key]) === t).sort((a, b) => a.firstSeen.localeCompare(b.firstSeen));
}

/** The distinct addresses a name has pointed at, oldest first. */
export function addressesOf(db: PivotDb, domain: string): string[] {
  return [...new Set(lookup(db, domain).map((r) => r.ip))];
}

/** The distinct names that have pointed at an address, oldest first. */
export function namesOn(db: PivotDb, ip: string): string[] {
  return [...new Set(lookup(db, ip).map((r) => r.domain))];
}
