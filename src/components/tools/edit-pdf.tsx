"use client";

/**
 * The registry entry for Edit PDF — the editor itself lives in
 * components/editor/ (engine in lib/editor/). This thin wrapper keeps
 * the registry one line per tool, like every other tool.
 */

export { EditorApp as EditPdf } from "@/components/editor/editor-app";
