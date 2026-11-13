"use client";

import { useMemo, useState } from "react";
import { Eraser } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function readingTime(words: number): string {
  if (words === 0) return "0 sec";
  const minutes = words / 200;
  if (minutes < 1) return `${Math.max(1, Math.ceil(minutes * 60))} sec`;
  return `${Math.ceil(minutes)} min`;
}

export function WordCounter() {
  const [text, setText] = useState("");

  const stats = useMemo(() => {
    const trimmed = text.trim();
    const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
    const characters = text.length;
    const noSpaces = text.replace(/\s/g, "").length;
    const sentences = trimmed
      ? trimmed.split(/[.!?…]+/).filter((s) => s.trim().length > 0).length
      : 0;
    const paragraphs = trimmed
      ? trimmed.split(/\n\s*\n|\n/).filter((p) => p.trim().length > 0).length
      : 0;
    return { words, characters, noSpaces, sentences, paragraphs };
  }, [text]);

  const CARDS = [
    { label: "Words", value: stats.words.toLocaleString() },
    { label: "Characters", value: stats.characters.toLocaleString() },
    { label: "No spaces", value: stats.noSpaces.toLocaleString() },
    { label: "Sentences", value: stats.sentences.toLocaleString() },
    { label: "Paragraphs", value: stats.paragraphs.toLocaleString() },
    { label: "Reading time", value: readingTime(stats.words) },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {CARDS.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-border bg-card px-3.5 py-3"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              {c.label}
            </p>
            <p className="mt-0.5 font-display text-[20px] font-extrabold text-navy dark:text-[#8FB5F5]">
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type or paste your text here — everything updates live…"
          rows={9}
          className="resize-none pb-11"
          aria-label="Text to count"
        />
        {text.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setText("")}
            className="absolute bottom-2.5 right-2.5 h-8 gap-1.5 text-muted-foreground"
          >
            <Eraser className="size-3.5" aria-hidden="true" />
            Clear
          </Button>
        )}
      </div>

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Reading time uses the standard silent-reading pace of 200 words per
        minute. Your text is counted in your browser and never uploaded.
      </p>
    </div>
  );
}
