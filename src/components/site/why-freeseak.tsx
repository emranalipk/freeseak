import { BadgeCheck, MonitorSmartphone, ShieldCheck, Zap } from "lucide-react";

const WHY = [
  {
    icon: BadgeCheck,
    title: "Free forever",
    text: "Every tool, every day. No accounts, no watermarks, no surprise paywalls.",
  },
  {
    icon: ShieldCheck,
    title: "Processed on your device",
    text: "Your files never leave your browser. Privacy by architecture — not by promise.",
  },
  {
    icon: Zap,
    title: "Fast everywhere",
    text: "Lightweight pages on a global network. Loads in a blink on any connection.",
  },
  {
    icon: MonitorSmartphone,
    title: "Works on any device",
    text: "Phone, tablet or desktop — every tool is built mobile-first from day one.",
  },
];

export function WhyFreeseak() {
  return (
    <section id="why" className="scroll-mt-20 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[1120px]">
        <h2 className="mb-4 font-display text-[21px] font-extrabold tracking-tight text-navy dark:text-[#CFE0FB]">
          Why FreeSeak?
        </h2>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w) => (
            <div
              key={w.title}
              className="rounded-2xl border border-border bg-card p-5 shadow-sm"
            >
              <w.icon
                className="mb-3 size-6 text-navy dark:text-[#8FB5F5]"
                aria-hidden="true"
              />
              <h3 className="font-display text-[14.5px] font-bold text-foreground">
                {w.title}
              </h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                {w.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
