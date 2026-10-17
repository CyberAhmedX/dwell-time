// Generated case files: logs too long to read by eye, built from a fixed seed so
// every player (and every test) sees exactly the same lines. Only documentation
// and private addresses, and only .example / .test domains, as everywhere else.

/** Small seeded random generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n: number): string => String(n).padStart(2, "0");
const clock = (secs: number): string => `${pad(Math.floor(secs / 3600) % 24)}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`;

// ------------------------------------------------------------------ school DNS

const SCHOOL_DOMAINS = [
  "mail.halden-schools.example",
  "learn.halden-schools.example",
  "updates.halden-schools.example",
  "time.halden-schools.example",
  "cdn.reading-portal.example",
  "www.reading-portal.example",
  "video.lesson-hub.example",
  "api.lesson-hub.example",
  "fonts.web-assets.example",
  "maps.town-guide.example",
];

export interface SchoolDns {
  log: string;
  tunnelDomain: string;
  tunnelCount: number;
}

/**
 * Twenty minutes of the school resolver's log. Twelve lab PCs browse normally;
 * lab-pc-07 also sends a steady stream of TXT lookups for random names under
 * data.sync-telemetry.example, which is the tunnel.
 */
export function schoolDnsLog(): SchoolDns {
  const r = rng(20260314);
  const rows: { t: number; line: string }[] = [];
  const start = 13 * 3600;
  for (let pc = 1; pc <= 12; pc++) {
    const host = `lab-pc-${pad(pc)}`;
    const ip = `10.40.7.${100 + pc}`;
    const n = 45 + Math.floor(r() * 40);
    for (let i = 0; i < n; i++) {
      const t = start + Math.floor(r() * 1200);
      const q = SCHOOL_DOMAINS[Math.floor(r() * SCHOOL_DOMAINS.length)];
      rows.push({ t, line: `${clock(t)}\t${host}\t${ip}\t${q}\t${r() < 0.85 ? "A" : "AAAA"}\tNOERROR` });
    }
  }
  const tunnelDomain = "sync-telemetry.example";
  let tunnelCount = 0;
  for (let t = start + 7; t < start + 1200; t += 2 + Math.floor(r() * 2)) {
    const label = Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(r() * 36)]).join("");
    rows.push({ t, line: `${clock(t)}\tlab-pc-07\t10.40.7.107\t${label}.data.${tunnelDomain}\tTXT\tNOERROR` });
    tunnelCount++;
  }
  rows.sort((a, b) => a.t - b.t);
  const header = "#fields\ttime\thost\tsrc_ip\tquery\tqtype\trcode";
  return { log: [header, ...rows.map((x) => x.line)].join("\n") + "\n", tunnelDomain, tunnelCount };
}
