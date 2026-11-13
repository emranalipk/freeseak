export function LogoSlot({
  size = 38,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div
      aria-label="FreeSeak logo"
      title="Logo slot — the final mark drops in here"
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-[10px] border-[1.6px] border-dashed border-[#B9C7DD] bg-card dark:border-[#31456B] ${className}`}
    >
      <span className="font-display text-[7.5px] font-bold uppercase tracking-[0.14em] text-[#8DA2C0] dark:text-[#5F739A]">
        Logo
      </span>
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-[21px] font-extrabold leading-none tracking-tight text-foreground ${className}`}
    >
      free<span className="text-primary">seak</span>
    </span>
  );
}

export function Tagline({ className = "" }: { className?: string }) {
  return (
    <span
      className={`text-[9.5px] font-semibold uppercase tracking-[0.16em] text-muted-foreground ${className}`}
    >
      Seek <span className="text-mint">&amp;</span> Done
    </span>
  );
}
