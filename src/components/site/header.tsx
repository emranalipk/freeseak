"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogoSlot, Tagline, Wordmark } from "./logo";

const NAV = [
  { href: "#tools", label: "Tools" },
  { href: "#why", label: "Why FreeSeak" },
  { href: "#faq", label: "FAQ" },
];

export function SiteHeader() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/85 backdrop-blur-md">
      <div className="mx-auto flex h-[62px] w-full max-w-[1120px] items-center gap-3 px-4 sm:px-6">
        <a
          href="#top"
          aria-label="FreeSeak — home"
          className="flex items-center gap-3"
        >
          <LogoSlot />
          <span className="flex flex-col gap-[3px]">
            <Wordmark />
            <Tagline />
          </span>
        </a>

        <nav className="ml-auto flex items-center gap-1" aria-label="Main">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="hidden rounded-lg px-3 py-2 text-[13.5px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:inline-flex"
            >
              {n.label}
            </a>
          ))}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle dark mode"
            onClick={() =>
              setTheme(resolvedTheme === "dark" ? "light" : "dark")
            }
          >
            <Sun className="hidden size-[18px] dark:block" aria-hidden="true" />
            <Moon className="size-[18px] dark:hidden" aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </header>
  );
}
