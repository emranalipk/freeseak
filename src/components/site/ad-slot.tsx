export function AdSlot() {
  return (
    <section
      aria-label="Advertising space"
      className="px-4 py-7 sm:px-6"
    >
      <div className="mx-auto flex min-h-[110px] w-full max-w-[1120px] flex-col items-center justify-center gap-1.5 rounded-2xl border-[1.6px] border-dashed border-[#C6D0DE] bg-[repeating-linear-gradient(45deg,#FAFBFE,#FAFBFE_12px,#F5F8FC_12px,#F5F8FC_24px)] text-center dark:border-[#2A3B5C] dark:bg-[repeating-linear-gradient(45deg,#131E33,#131E33_12px,#16223A_12px,#16223A_24px)]">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground/70">
          Ad space — reserved
        </p>
        <p className="text-[12px] text-muted-foreground/70">
          The only ad slot on this page · below the fold · never inside a tool
          · only after approval
        </p>
      </div>
    </section>
  );
}
