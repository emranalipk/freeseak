import { ADS_ENABLED } from "@/lib/site";

/**
 * v0.3: the reserved ad slot is hidden by default (ADS_ENABLED in
 * src/lib/site.ts). Flip it to true only when an ad network has
 * approved the site — visitors should never see an empty placeholder.
 */
export function AdSlot() {
  if (!ADS_ENABLED) return null;

  return (
    <section
      aria-label="Advertising space"
      className="px-4 py-7 sm:px-6"
    >
      <div className="mx-auto flex min-h-[110px] w-full max-w-[1120px] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.6px] border-dashed border-[#C6D0DE] bg-[repeating-linear-gradient(45deg,#FAFBFE,#FAFBFE_12px,#F5F8FC_12px,#F5F8FC_24px)] text-center dark:border-[#2A3B5C] dark:bg-[repeating-linear-gradient(45deg,#131E33,#131E33_12px,#16223A_12px,#16223A_24px)]">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
          Advertisement
        </p>
      </div>
    </section>
  );
}
