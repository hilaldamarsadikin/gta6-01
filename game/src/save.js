// TELUK EMAS — persistence: Raka's money and mission progress live in
// localStorage, so closing the tab and coming back resumes the story.
// A missing, corrupt or blocked store is never fatal: the game just starts
// fresh, and every write is guarded the same way. missionIndex is clamped
// to the story's length on load, so a finished story (index 5) reads as
// finished and a tampered value can never point past the last job.

import { SAVE_KEY, MONEY, MISSIONS } from './config.js';

export const SAVE_VERSION = 1;

export function defaultSave() {
  return { version: SAVE_VERSION, money: MONEY.start, missionIndex: 0, best: 0, muted: false };
}

export function loadSave() {
  const clean = defaultSave();
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return clean;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return clean;
    if (typeof data.money === 'number' && Number.isFinite(data.money)) {
      clean.money = Math.max(0, Math.floor(data.money));
    }
    if (typeof data.missionIndex === 'number' && Number.isFinite(data.missionIndex)) {
      // clamp to the story's length: missionIndex == MISSIONS.length means
      // the story is finished ("Cerita tamat"), anything past it is junk
      // from an older or tampered save.
      clean.missionIndex = Math.max(0, Math.min(MISSIONS.length, Math.floor(data.missionIndex)));
    }
    if (typeof data.best === 'number' && Number.isFinite(data.best)) {
      clean.best = Math.max(0, Math.floor(data.best));
    }
    if (typeof data.muted === 'boolean') clean.muted = data.muted;
    return clean;
  } catch {
    return clean;
  }
}

export function writeSave(save) {
  try {
    const record = { ...save, version: SAVE_VERSION };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(record));
  } catch {
    // private windows, full disks, blocked storage: the session simply
    // does not persist, and the game carries on without it.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // nothing to do: the store is already unreachable.
  }
}

// Wipe the stored progress and hand back a fresh save: the "new game"
// path on the title screen uses this instead of clearing the key and
// then loading it again, so there is never a half-cleared record.
// The returned object is a plain default save, safe to write straight
// back if the caller wants the fresh start persisted at once.
export function resetProgress() {
  clearSave();
  return defaultSave();
}

// True when a save exists at all, corrupt or not: the title screen uses
// this to decide whether to offer a continuation.
export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

// True when the stored story is finished: the title screen shows the
// "Cerita tamat" line instead of a next-job number. A save that was
// written before this helper existed still works — it only reads the
// mission index, never the shape of the record.
export function isStoryFinished(save) {
  return save && typeof save.missionIndex === 'number' && save.missionIndex >= MISSIONS.length;
}
