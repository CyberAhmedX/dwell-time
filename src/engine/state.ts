import type { Chapter, Dept, Flag } from "./types";

export interface SaveData {
  version: 1;
  playerName: string;
  track: Dept | null;
  hired: boolean;
  chapter: Chapter;
  xp: number;
  integrity: number;
  flags: Flag[];
  done: string[]; // completed ticket / scene ids
  codex: string[]; // unlocked codex entry ids
  interviewScore: number;
}

export const RANK_TITLES = [
  "Applicant",
  "Probationary Analyst",
  "Analyst I",
  "Analyst II",
  "Senior Analyst",
  "Lead Analyst",
] as const;

export const RANK_THRESHOLDS = [0, 1, 120, 300, 560, 900] as const;

const SAVE_KEY = "dwell-time.save.v1";

export function freshSave(): SaveData {
  return {
    version: 1,
    playerName: "",
    track: null,
    hired: false,
    chapter: 0,
    xp: 0,
    integrity: 0,
    flags: [],
    done: [],
    codex: [],
    interviewScore: 0,
  };
}

/** Current rank index from xp. Index 0 is Applicant, 1 once hired, etc. */
export function rankIndex(save: SaveData): number {
  if (!save.hired) return 0;
  let idx = 1;
  for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
    if (save.xp >= RANK_THRESHOLDS[i]) idx = i;
  }
  return idx;
}

export function rankTitle(save: SaveData): string {
  return RANK_TITLES[rankIndex(save)];
}

/** XP progress toward the next rank, as {have, need} within the current band. */
export function rankProgress(save: SaveData): { have: number; need: number; max: boolean } {
  const idx = rankIndex(save);
  if (idx >= RANK_THRESHOLDS.length - 1) return { have: 1, need: 1, max: true };
  const base = RANK_THRESHOLDS[idx];
  const next = RANK_THRESHOLDS[idx + 1];
  return { have: save.xp - base, need: next - base, max: false };
}

export function hasFlag(save: SaveData, flag: Flag): boolean {
  return save.flags.includes(flag);
}

export function hasAll(save: SaveData, flags?: Flag[]): boolean {
  return !flags || flags.every((f) => save.flags.includes(f));
}

export function hasNone(save: SaveData, flags?: Flag[]): boolean {
  return !flags || !flags.some((f) => save.flags.includes(f));
}

export function setFlag(save: SaveData, flag: Flag): void {
  if (!save.flags.includes(flag)) save.flags.push(flag);
}

export function clearFlag(save: SaveData, flag: Flag): void {
  const i = save.flags.indexOf(flag);
  if (i >= 0) save.flags.splice(i, 1);
}

export function markDone(save: SaveData, id: string): void {
  if (!save.done.includes(id)) save.done.push(id);
}

export function isDone(save: SaveData, id: string): boolean {
  return save.done.includes(id);
}

export function unlockCodex(save: SaveData, id: string): void {
  if (!save.codex.includes(id)) save.codex.push(id);
}

export function load(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return freshSave();
    const data = JSON.parse(raw) as Partial<SaveData>;
    if (data.version !== 1) return freshSave();
    return { ...freshSave(), ...data };
  } catch {
    return freshSave();
  }
}

export function save(data: SaveData): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be blocked (private mode, disabled). The game still plays,
    // it just will not persist. That is acceptable, do not crash.
  }
}

export function wipe(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // ignore
  }
}
