"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { searchTools } from "@/lib/search";
import { CATEGORY_LABEL, READY_TOOLS } from "@/lib/tools";
import { useToolStore } from "@/lib/tool-store";
import { ToolIcon } from "./tool-icon";

export function CommandPalette() {
  const paletteOpen = useToolStore((s) => s.paletteOpen);
  const setPalette = useToolStore((s) => s.setPalette);
  const router = useRouter();
  const [query, setQuery] = useState("");

  const { results, close } = searchTools(query.trim());
  const items = query.trim() ? results : READY_TOOLS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuery("");
        setPalette(!paletteOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paletteOpen, setPalette]);

  const choose = (id: string) => {
    setQuery("");
    setPalette(false);
    router.push(`/tools/${id}`);
  };

  return (
    <Dialog open={paletteOpen} onOpenChange={setPalette}>
      <DialogContent
        className="top-[18%] max-w-[560px] translate-y-0 gap-0 overflow-hidden p-0"
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">Search FreeSeak tools</DialogTitle>
        <DialogDescription className="sr-only">
          Type to search all FreeSeak tools. Use the arrow keys and press Enter
          to open a tool.
        </DialogDescription>
        <Command shouldFilter={false} className="bg-card">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="What do you need to do today?"
          />
          <CommandList className="thin-scroll">
            {items.length === 0 ? (
              <CommandEmpty>
                <p>No tool for “{query.trim()}” yet.</p>
                <button
                  type="button"
                  className="mt-1 block w-full font-semibold text-primary hover:underline"
                  onClick={() => {
                    setPalette(false);
                    toast("Noted — requests shape the roadmap", {
                      description:
                        "The request-a-tool form ships with the full launch.",
                    });
                  }}
                >
                  Request a tool →
                </button>
              </CommandEmpty>
            ) : (
              <CommandGroup
                heading={
                  close
                    ? "No exact match — closest tools"
                    : query.trim()
                      ? "Tools"
                      : "All working tools"
                }
              >
                {items.map((t) =>
                  t.ready ? (
                    <CommandItem
                      key={t.id}
                      value={t.id}
                      onSelect={() => choose(t.id)}
                      className="gap-3"
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-secondary">
                        <ToolIcon
                          icon={t.icon}
                          className="size-4 text-primary"
                        />
                      </span>
                      <span className="flex-1">{t.name}</span>
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {CATEGORY_LABEL[t.category]}
                      </span>
                    </CommandItem>
                  ) : (
                    <CommandItem
                      key={t.id}
                      value={t.id}
                      disabled
                      className="gap-3 opacity-55"
                    >
                      <span className="flex size-8 items-center justify-center rounded-lg bg-muted">
                        <ToolIcon
                          icon={t.icon}
                          className="size-4 text-muted-foreground"
                        />
                      </span>
                      <span className="flex-1">{t.name}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                        Soon
                      </span>
                    </CommandItem>
                  ),
                )}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2.5 text-[11.5px] text-muted-foreground">
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-semibold">
                ↑↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-semibold">
                ↵
              </kbd>{" "}
              open
            </span>
            <span className="ml-auto">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-semibold">
                Esc
              </kbd>{" "}
              close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
