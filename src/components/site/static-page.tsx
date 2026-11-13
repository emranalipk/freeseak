/**
 * v0.3: shared shell for the static pages (About, Privacy Policy,
 * Terms, Disclaimer) — same card language as the rest of the site.
 */

export function StaticPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  updated?: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[760px] px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-[26px] font-extrabold tracking-tight text-navy dark:text-[#CFE0FB] sm:text-[30px]">
        {title}
      </h1>
      {updated && (
        <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
          Last updated: {updated}
        </p>
      )}
      {intro && (
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          {intro}
        </p>
      )}
      <div className="mt-6 flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function PageSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-[15px] font-bold text-foreground">
        {heading}
      </h2>
      <div className="mt-2.5 flex flex-col gap-2.5 text-[13.5px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
