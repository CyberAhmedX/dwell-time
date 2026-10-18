// Timeline building: logs from different systems, each stamped by its own
// clock, merged onto one UTC timeline. Getting a source's time zone wrong is
// the classic way to put an effect before its cause.

export interface TimelineSource {
  id: string;
  name: string;
  note: string; // what the source says about its own clock
  offset: number; // the right offset from UTC, in hours (e.g. 1 for UTC+1)
  events: { time: string; text: string }[]; // times as HH:MM:SS on the source's clock
}

export interface MergedEvent {
  utc: string; // HH:MM:SS
  seconds: number;
  source: TimelineSource;
  text: string;
}

export const OFFSETS = [-3, -2, -1, 0, 1, 2, 3] as const;

export function offsetLabel(h: number): string {
  return h === 0 ? "UTC" : `UTC${h > 0 ? "+" : "-"}${Math.abs(h)}`;
}

function secs(t: string): number {
  const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(t);
  if (!m) throw new Error(`bad time ${t}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

const pad = (n: number): string => String(n).padStart(2, "0");

function clock(s: number): string {
  const day = 86400;
  const v = ((s % day) + day) % day;
  const tag = s < 0 ? " (day before)" : s >= day ? " (next day)" : "";
  return `${pad(Math.floor(v / 3600))}:${pad(Math.floor(v / 60) % 60)}:${pad(v % 60)}${tag}`;
}

/** Merge every source onto UTC with the chosen offsets, earliest first. */
export function mergeTimeline(sources: readonly TimelineSource[], offsets: Readonly<Record<string, number>>): MergedEvent[] {
  return sources
    .flatMap((src) =>
      src.events.map((e) => {
        const seconds = secs(e.time) - (offsets[src.id] ?? 0) * 3600;
        return { utc: clock(seconds), seconds, source: src, text: e.text };
      }),
    )
    .sort((a, b) => a.seconds - b.seconds);
}

export function offsetsRight(sources: readonly TimelineSource[], offsets: Readonly<Record<string, number>>): boolean {
  return sources.every((s) => (offsets[s.id] ?? 0) === s.offset);
}
