"use client";

import { useMemo, useState } from "react";
import { Cake } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function diffAge(dob: Date, now: Date) {
  let years = now.getFullYear() - dob.getFullYear();
  let months = now.getMonth() - dob.getMonth();
  let days = now.getDate() - dob.getDate();
  if (days < 0) {
    months -= 1;
    // days in the previous month of "now"
    days += new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
}

function nextBirthday(dob: Date, now: Date) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
  const isLeapBirthday =
    dob.getMonth() === 1 && dob.getDate() === 29;
  if (isLeapBirthday && !isLeapYear(next.getFullYear())) {
    next = new Date(today.getFullYear(), 1, 28);
  }
  if (next < today) {
    next = new Date(today.getFullYear() + 1, dob.getMonth(), dob.getDate());
    if (isLeapBirthday && !isLeapYear(next.getFullYear())) {
      next = new Date(today.getFullYear() + 1, 1, 28);
    }
  }
  const days = Math.round((next.getTime() - today.getTime()) / 86400000);
  return { days, date: next };
}

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function AgeCalculator() {
  const [dob, setDob] = useState("");

  const result = useMemo(() => {
    if (!dob) return null;
    const birth = new Date(dob + "T00:00:00");
    if (Number.isNaN(birth.getTime())) return null;
    const now = new Date();
    if (birth > now) return { error: "That date is in the future — check the date of birth." };
    const age = diffAge(birth, now);
    const next = nextBirthday(birth, now);
    return {
      age,
      next,
      weekday: next.date.toLocaleDateString(undefined, { weekday: "long" }),
      dateLabel: next.date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  }, [dob]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex max-w-xs flex-col gap-1.5">
        <Label htmlFor="dob">Date of birth</Label>
        <Input
          id="dob"
          type="date"
          value={dob}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDob(e.target.value)}
        />
      </div>

      {result && "error" in result && result.error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] font-medium text-destructive">
          {result.error}
        </p>
      )}

      {result && !("error" in result) && (
        <>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: "Years", value: result.age.years },
              { label: "Months", value: result.age.months },
              { label: "Days", value: result.age.days },
            ].map((c) => (
              <div
                key={c.label}
                className="rounded-xl border border-border bg-card px-3.5 py-4 text-center"
              >
                <p className="font-display text-[26px] font-extrabold leading-none text-navy dark:text-[#8FB5F5]">
                  {c.value.toLocaleString()}
                </p>
                <p className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {c.label}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-mint/40 bg-mint/5 px-4 py-3.5">
            <Cake className="mt-0.5 size-[18px] shrink-0 text-mint-deep dark:text-mint" aria-hidden="true" />
            <p className="text-[13px] leading-relaxed text-foreground">
              {result.next.days === 0 ? (
                <>
                  <span className="font-bold text-mint-deep dark:text-mint">
                    Happy birthday!
                  </span>{" "}
                  Today is the big day.
                </>
              ) : (
                <>
                  Next birthday:{" "}
                  <span className="font-bold">{result.dateLabel}</span> (a{" "}
                  {result.weekday}) — in{" "}
                  <span className="font-bold">
                    {result.next.days.toLocaleString()}{" "}
                    {result.next.days === 1 ? "day" : "days"}
                  </span>
                  .
                </>
              )}
            </p>
          </div>
        </>
      )}

      {!result && (
        <div className="flex items-center justify-center rounded-xl border-[1.6px] border-dashed border-border px-6 py-8">
          <p className="text-center text-[13px] font-medium text-muted-foreground">
            Pick a date of birth and the exact age appears here instantly.
          </p>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-muted-foreground">
        Ages are computed with real calendar months — including leap years — so
        the numbers are precise enough for official forms.
      </p>
    </div>
  );
}
