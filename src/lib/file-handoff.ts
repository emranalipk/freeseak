"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { create } from "zustand";

/**
 * v0.9.3 — the homepage "Which tool do I need?" router hands the
 * dropped file over: the visitor drops once, clicks a suggested
 * tool, and the tool page opens with the file already loaded (no
 * second drop). The File object lives in this client-side store
 * only — it never leaves the browser — and survives the
 * client-side navigation from the homepage to the tool page. It is
 * a one-way trip: consumed on arrival, always delivered (even if the
 * navigation took longer than expected — the visitor dropped it for
 * this tool on purpose, and a silent empty tool helps nobody).
 */

interface FileHandoffState {
  file: File | null;
  forTool: string;
  at: number;
  handOff: (_file: File, _forTool: string) => void;
  /** returns and clears the file if it was handed off for this tool */
  takeFor: (_toolId: string) => File | null;
}

export const useFileHandoff = create<FileHandoffState>((set, get) => ({
  file: null,
  forTool: "",
  at: 0,
  handOff: (file, forTool) => set({ file, forTool, at: Date.now() }),
  takeFor: (toolId) => {
    const { file, forTool } = get();
    if (!file || forTool !== toolId) return null;
    set({ file: null, forTool: "", at: 0 });
    /* hand the file over even when the 2-minute TTL lapsed — the visitor
       dropped it for THIS tool on purpose; a silent empty tool is worse
       than a slightly-stale file */
    return file;
  },
}));

/** the tool id from a /tools/<id> path ("" anywhere else) */
export function toolIdFromPath(pathname: string): string {
  const m = /^\/tools\/([^/]+)/.exec(pathname);
  return m ? m[1]! : "";
}

/**
 * Mount-effect for tool intake surfaces: if the homepage router
 * handed a file over for the tool at the current URL, feed it to
 * `onFile` once. One-shot by design — `takeFor` clears the store —
 * so re-renders (and strict-mode double effects) can never
 * double-add the file.
 */
export function useHandoff(onFile: (_file: File) => void): void {
  const pathname = usePathname();
  useEffect(() => {
    const file = useFileHandoff.getState().takeFor(toolIdFromPath(pathname));
    if (file) onFile(file);
  }, [pathname, onFile]);
}
