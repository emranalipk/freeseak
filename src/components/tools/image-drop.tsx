"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useHandoff } from "@/lib/file-handoff";

/**
 * Shared input surface for the image tools: drag-and-drop, click-to-browse
 * and clipboard paste, all feeding the same onFiles callback.
 * `compact` is the slimmer "add more" strip shown once a queue exists.
 */
export function ImageDropZone({
  onFiles,
  compact = false,
}: {
  onFiles: (_files: File[]) => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  /* v0.9.3: an image handed over from the homepage router opens here
     automatically — the visitor drops once, never twice */
  useHandoff((f) => {
    if (f.type.startsWith("image/")) onFiles([f]);
  });

  /* pasted screenshots arrive straight from the clipboard */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) onFiles(Array.from(files));
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFiles]);

  const openPicker = useCallback(() => inputRef.current?.click(), []);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Add images"
      onClick={openPicker}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openPicker();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (e.dataTransfer.files.length > 0) onFiles(Array.from(e.dataTransfer.files));
      }}
      className={`flex cursor-pointer select-none flex-col items-center justify-center rounded-2xl border-[1.6px] border-dashed text-center transition-colors ${
        dragging
          ? "border-primary bg-secondary"
          : "border-border bg-card hover:border-primary/60 hover:bg-secondary/40"
      } ${compact ? "gap-1 px-4 py-4" : "gap-2 px-6 py-10"}`}
    >
      <div className="pointer-events-none flex flex-col items-center gap-1.5">
        <ImagePlus
          className={compact ? "size-5 text-primary" : "size-8 text-primary"}
          aria-hidden="true"
        />
        <p className="font-display text-[13.5px] font-bold text-foreground">
          {compact ? "Add more images" : "Drop images here, or click to browse"}
        </p>
        {!compact && (
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            You can also paste from the clipboard (Ctrl / Cmd + V) —
            JPG · PNG · WebP · GIF · BMP · AVIF
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFiles(Array.from(e.target.files));
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}
