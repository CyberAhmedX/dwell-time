import type { SaveData } from "./state";

// Everything that outlives a single run: settings, the endings you have seen,
// achievements, every Field Note you have ever unlocked, and a snapshot of the
// save at the start of each chapter so a finished player can replay one.
// Kept apart from the run save, so "Play again" and "Erase save" leave it alone.

export interface Settings {
  music: number; // 0..1, soundtrack and rain
  effects: number; // 0..1, clicks, chimes and thunder
  muted: boolean;
  textScale: number; // 1 is the default size
  reducedMotion: boolean | null; // null follows the system setting
}

export interface MetaData {
  version: 1;
  endings: string[];
  achievements: string[];
  codexEver: string[];
  checkpoints: Partial<Record<number, SaveData>>; // chapter -> save at its start
  settings: Settings;
}

export const TEXT_SCALES = [0.9, 1, 1.15, 1.3] as const;

const META_KEY = "dwell-time.meta.v1";

export function freshMeta(): MetaData {
  return {
    version: 1,
    endings: [],
    achievements: [],
    codexEver: [],
    checkpoints: {},
    settings: { music: 0.7, effects: 0.7, muted: false, textScale: 1, reducedMotion: null },
  };
}

export function loadMeta(): MetaData {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return freshMeta();
    const data = JSON.parse(raw) as Partial<MetaData>;
    if (data.version !== 1) return freshMeta();
    const base = freshMeta();
    return { ...base, ...data, settings: { ...base.settings, ...data.settings } };
  } catch {
    return freshMeta();
  }
}

export function saveMeta(meta: MetaData): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // Same as the run save: no storage means no persistence, not a crash.
  }
}

export function wipeMeta(): void {
  try {
    localStorage.removeItem(META_KEY);
  } catch {
    // ignore
  }
}

function addOnce(list: string[], id: string): boolean {
  if (list.includes(id)) return false;
  list.push(id);
  return true;
}

export function recordEnding(meta: MetaData, id: string): boolean {
  return addOnce(meta.endings, id);
}

export function recordCodex(meta: MetaData, ids: readonly string[]): void {
  for (const id of ids) addOnce(meta.codexEver, id);
}

/** Store a copy of the save as it stands at the start of a chapter. */
export function recordCheckpoint(meta: MetaData, save: SaveData): void {
  meta.checkpoints[save.chapter] = JSON.parse(JSON.stringify(save)) as SaveData;
}

/** A fresh copy of a chapter checkpoint, safe to play from. */
export function checkpointCopy(meta: MetaData, chapter: number): SaveData | undefined {
  const cp = meta.checkpoints[chapter];
  return cp ? (JSON.parse(JSON.stringify(cp)) as SaveData) : undefined;
}

/** Chapter select opens once you have seen any ending. */
export function canSelectChapter(meta: MetaData): boolean {
  return meta.endings.length > 0 && Object.keys(meta.checkpoints).length > 0;
}
