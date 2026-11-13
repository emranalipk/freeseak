"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function parse(v: string): number {
  return v.trim() === "" ? NaN : Number(v);
}

export function PercentageCalculator() {
  const [ofPct, setOfPct] = useState("25");
  const [ofNum, setOfNum] = useState("200");
  const [isPct, setIsPct] = useState("50");
  const [isNum, setIsNum] = useState("200");
  const [fromVal, setFromVal] = useState("80");
  const [toVal, setToVal] = useState("100");

  const pct = parse(ofPct);
  const num = parse(ofNum);
  const result1 = Number.isFinite(pct) && Number.isFinite(num) ? (pct / 100) * num : NaN;

  const isP = parse(isPct);
  const isN = parse(isNum);
  const result2 =
    Number.isFinite(isP) && Number.isFinite(isN) && isN !== 0 ? (isP / isN) * 100 : NaN;

  const from = parse(fromVal);
  const to = parse(toVal);
  const result3 =
    Number.isFinite(from) && Number.isFinite(to) && from !== 0 ? ((to - from) / Math.abs(from)) * 100 : NaN;

  return (
    <div className="flex flex-col gap-4">
      {/* card 1 */}
      <div className="rounded-2xl border border-border bg-card p-4.5 p-4">
        <p className="font-display text-[13.5px] font-bold text-foreground">
          What is X% of Y?
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <Input
              value={ofPct}
              onChange={(e) => setOfPct(e.target.value)}
              type="number"
              inputMode="decimal"
              aria-label="Percentage"
              className="w-24 text-right"
            />
            <span className="text-[15px] font-bold text-foreground">%</span>
          </div>
          <span className="text-[13.5px] font-medium text-muted-foreground">of</span>
          <Input
            value={ofNum}
            onChange={(e) => setOfNum(e.target.value)}
            type="number"
            inputMode="decimal"
            aria-label="Number"
            className="w-28 text-right"
          />
          <span className="text-[15px] font-bold text-muted-foreground">=</span>
          <span className="min-w-16 rounded-lg bg-secondary px-3 py-2 font-display text-[17px] font-extrabold text-secondary-foreground">
            {fmt(result1)}
          </span>
        </div>
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          Perfect for discounts: enter the discount % and the price to see what you save.
        </p>
      </div>

      {/* card 2 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-[13.5px] font-bold text-foreground">
          X is what percent of Y?
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <Input
            value={isPct}
            onChange={(e) => setIsPct(e.target.value)}
            type="number"
            inputMode="decimal"
            aria-label="Value"
            className="w-24 text-right"
          />
          <span className="text-[13.5px] font-medium text-muted-foreground">of</span>
          <Input
            value={isNum}
            onChange={(e) => setIsNum(e.target.value)}
            type="number"
            inputMode="decimal"
            aria-label="Total"
            className="w-28 text-right"
          />
          <span className="text-[15px] font-bold text-muted-foreground">=</span>
          <span className="min-w-16 rounded-lg bg-secondary px-3 py-2 font-display text-[17px] font-extrabold text-secondary-foreground">
            {Number.isFinite(result2) ? `${fmt(result2)}%` : "—"}
          </span>
        </div>
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          Great for marks, shares and “how much of the total is this?” questions.
        </p>
      </div>

      {/* card 3 */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="font-display text-[13.5px] font-bold text-foreground">
          Percentage change from X to Y
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-muted-foreground">from</span>
            <Input
              value={fromVal}
              onChange={(e) => setFromVal(e.target.value)}
              type="number"
              inputMode="decimal"
              aria-label="Original value"
              className="w-24 text-right"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-muted-foreground">to</span>
            <Input
              value={toVal}
              onChange={(e) => setToVal(e.target.value)}
              type="number"
              inputMode="decimal"
              aria-label="New value"
              className="w-24 text-right"
            />
          </div>
          <span className="text-[15px] font-bold text-muted-foreground">=</span>
          <span
            className={`min-w-16 rounded-lg px-3 py-2 font-display text-[17px] font-extrabold ${
              result3 > 0
                ? "bg-mint/10 text-mint-deep dark:text-mint"
                : result3 < 0
                  ? "bg-destructive/10 text-destructive"
                  : "bg-secondary text-secondary-foreground"
            }`}
          >
            {Number.isFinite(result3)
              ? `${result3 > 0 ? "+" : result3 < 0 ? "−" : ""}${fmt(Math.abs(result3))}%`
              : "—"}
          </span>
        </div>
        <p className="mt-2.5 text-[12px] text-muted-foreground">
          Mint means an increase, red a decrease. Ideal for prices, salaries and growth.
        </p>
      </div>
    </div>
  );
}
