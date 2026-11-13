"use client";

import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { getTool } from "@/lib/tools";
import { useToolStore } from "@/lib/tool-store";
import { ToolShell } from "./tool-shell";
import { TOOL_COMPONENTS } from "./tool-registry";

export function ToolOverlay() {
  const openId = useToolStore((s) => s.openId);
  const closeTool = useToolStore((s) => s.closeTool);

  const tool = openId ? getTool(openId) : undefined;
  const ToolComponent = tool ? TOOL_COMPONENTS[tool.id] : undefined;

  return (
    <Dialog
      open={!!tool}
      onOpenChange={(o) => {
        if (!o) closeTool();
      }}
    >
      <DialogContent className="thin-scroll max-h-[88vh] max-w-3xl gap-0 overflow-y-auto rounded-2xl p-0">
        {tool && (
          <>
            <DialogDescription className="sr-only">
              {tool.short}
            </DialogDescription>
            <ToolShell tool={tool}>
              {ToolComponent ? <ToolComponent /> : null}
            </ToolShell>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
