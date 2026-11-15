import {
  BadgeCheck,
  MonitorSmartphone,
  ShieldCheck,
  Zap,
} from "lucide-react";

/**
 * v0.9.1 — the manifesto band: the privacy promise as the headline,
 * the pull-the-plug proof steps, the four benefits (folded in from the
 * old why-freeseak section) and the "$0.00" receipt — the honest bill.
 */

const STEPS = [
  "Open any tool",
  "Switch off Wi-Fi",
  "It still works",
];

const BENEFITS = [
  {
    icon: BadgeCheck,
    title: "Free forever",
    text: "No accounts, no watermarks, no surprise paywalls.",
  },
  {
    icon: ShieldCheck,
    title: "On your device",
    text: "Privacy by architecture — not by promise.",
  },
  {
    icon: Zap,
    title: "Fast everywhere",
    text: "Lightweight pages on a global network.",
  },
  {
    icon: MonitorSmartphone,
    title: "Any device",
    text: "Phone, tablet or desktop — mobile-first from day one.",
  },
];

const RECEIPT_ROWS: [string, string][] = [
  ["Files uploaded", "0"],
  ["Accounts created", "0"],
  ["Emails collected", "0"],
  ["Watermarks added", "0"],
  ["Ads shown", "0"],
  ["Size limits", "your RAM"],
];

export function ManifestoBand() {
  return (
    <section
      id="why"
      className="scroll-mt-20 bg-[#173B70] text-white dark:bg-[#0A1220]"
    >
      <div className="mx-auto grid w-full max-w-[1120px] items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_390px] lg:py-20">
        <div>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#9DBCF5]">
            <span
              className="mr-2.5 inline-block size-[9px] rounded-[3px] bg-mint align-middle"
              aria-hidden="true"
            />
            Rule 001
          </span>
          <p className="mt-5 max-w-[21ch] font-display text-[clamp(27px,3.6vw,44px)] font-extrabold leading-[1.12] tracking-[-0.03em]">
            Files never leave your device.{" "}
            <span className="opacity-60">
              Nothing is uploaded, nothing is stored, nothing is sold.
              It’s not a feature — it’s the whole point.
            </span>
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className="inline-flex items-center gap-2.5 rounded-full border border-white/25 px-4 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.09em] text-[#DCE7FA]"
              >
                <span className="grid size-5 place-items-center rounded-full bg-mint text-[10.5px] font-extrabold text-[#0B2B23]">
                  {i + 1}
                </span>
                {s}
              </span>
            ))}
          </div>
          <p className="mt-4 font-mono text-[11.5px] tracking-[0.06em] text-[#9DBCF5]">
            Don’t trust us — pull the plug and try it.
          </p>

          <div className="mt-9 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="flex items-start gap-3 rounded-xl border border-white/20 bg-white/[0.04] p-3.5"
              >
                <b.icon
                  className="mt-0.5 size-[18px] shrink-0 text-mint"
                  aria-hidden="true"
                />
                <div>
                  <b className="block text-[13.5px] font-bold">{b.title}</b>
                  <span className="text-[12px] leading-snug text-[#B9CBE8]">
                    {b.text}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* the honest bill — always paper white, in both themes */}
        <div
          className="receipt-tear mx-auto w-full max-w-[390px] rotate-[1.6deg] rounded-t-[3px] bg-white px-6 pb-9 pt-6 font-mono text-[13px] text-[#173B70] shadow-[0_22px_48px_-14px_rgba(3,15,35,0.55)] lg:rotate-[1.6deg]"
          role="img"
          aria-label="A receipt showing the true cost of using FreeSeak: zero dollars, zero uploads, zero accounts."
        >
          <h4 className="text-center text-[13px] font-extrabold tracking-[0.2em]">
            FREESEAK
          </h4>
          <p className="mb-4 mt-1 text-center text-[10.5px] tracking-[0.08em] text-[#5B7396]">
            ORDER #0000 · PAID IN FULL
          </p>
          {RECEIPT_ROWS.map(([k, v]) => (
            <p
              key={k}
              className="flex justify-between gap-3 border-b border-dashed border-[#C9D6EA] py-[7px]"
            >
              <span>{k}</span>
              <b className="font-bold">{v}</b>
            </p>
          ))}
          <p className="mt-3.5 flex justify-between border-t-2 border-[#173B70] pt-3 text-[15px] font-extrabold">
            <span>TOTAL</span>
            <span className="text-[#0E8A73]">$0.00</span>
          </p>
          <p className="mt-4 text-center text-[10px] tracking-[0.1em] text-[#5B7396]">
            THANK YOU · COME BACK ANYTIME
          </p>
        </div>
      </div>
    </section>
  );
}
