import Link from "next/link";

/**
 * v0.2 — a friendly branded 404 page. Static export prerenders it as
 * 404.html and Cloudflare serves it for any unknown address.
 */
export default function NotFound() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-20 sm:py-28">
      <div className="max-w-[440px] text-center">
        <p className="font-display text-[72px] font-extrabold leading-none text-navy dark:text-[#CFE0FB]">
          404
        </p>
        <h1 className="mt-3 font-display text-[20px] font-extrabold tracking-tight text-foreground">
          This page swam away
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          The address you typed does not exist — but every FreeSeak tool is
          still right where you left it.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-navy px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition hover:-translate-y-px dark:bg-[#22477F]"
        >
          Back to all tools
        </Link>
      </div>
    </div>
  );
}
