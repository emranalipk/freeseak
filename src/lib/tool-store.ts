"use client";

import { create } from "zustand";
import { getTool } from "./tools";

const RECENT_KEY = "freeseak_recent_tools";
const RECENT_EVENT = "freeseak:recent";
const RECENT_MAX = 6;

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const ids = JSON.parse(raw);
    return Array.isArray(ids)
      ? ids.filter((id) => typeof id === "string" && getTool(id)?.ready)
      : [];
  } catch {
    return [];
  }
}

function writeRecent(ids: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(ids));
    window.dispatchEvent(new Event(RECENT_EVENT));
  } catch {
    /* storage unavailable — recent tools are a bonus, never a blocker */
  }
}

/** read once on mount (hydration-safe) */
export function getRecent(): string[] {
  return readRecent();
}

function pushRecent(id: string) {
  const ids = readRecent().filter((x) => x !== id);
  ids.unshift(id);
  writeRecent(ids.slice(0, RECENT_MAX));
}

/** v0.2: tool PAGES call this so the recent-tools chips stay accurate */
export function recordVisit(id: string) {
  if (getTool(id)?.ready) pushRecent(id);
}

/* v0.3: the v0.1 popup-overlay state (openId / openTool / closeTool) was
   removed — tools are real pages now. The store is palette-only. */
interface ToolStore {
  paletteOpen: boolean;
  setPalette: (_open: boolean) => void;
}

export const useToolStore = create<ToolStore>((set) => ({
  paletteOpen: false,
  setPalette: (paletteOpen) => set({ paletteOpen }),
}));
