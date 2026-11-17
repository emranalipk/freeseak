import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TOOLS } from "@/lib/tools";

export const HOME_FAQ = [
  {
    q: "Is FreeSeak really free?",
    a: "Yes — completely. No sign-up, no watermarks on your files, no daily limits. FreeSeak stays free to run because every tool processes files in your own browser instead of on our servers, and modest, clearly-placed advertising covers the rest once the site grows.",
  },
  {
    q: "Are my files uploaded to a server?",
    a: "No. When a tool works on your file, the work happens on your device, inside your browser. Your file is never transmitted, stored or seen by anyone — close the tab and it is gone. Only the pages themselves (never your files) are served over the internet.",
  },
  {
    q: "Do I need to create an account?",
    a: "Never. There is nothing to sign up for — arrive, pick a tool, done. That is the whole idea.",
  },
  {
    q: "Which tools are coming next?",
    a: `${TOOLS.length} tools are live today: the complete PDF suite (Edit PDF, merge, split, organize, page numbers, watermark, PDF↔images, text extraction, metadata, compress), six image tools (compress, resize, enhance, convert, crop & rotate, favicon), the bilingual Punjab Registry Estimator (English & اردو), plus the quick utilities — QR codes, word counting, percentages and age. Rather than promise a long roadmap, FreeSeak ships a tool when it is genuinely finished — missing something? Request it, and requests help decide what gets built.`,
  },
];

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 px-4 py-8 sm:px-6">
      <div className="mx-auto w-full max-w-[760px]">
        <h2 className="mb-4 font-display text-[21px] font-extrabold tracking-tight text-navy dark:text-[#CFE0FB]">
          Frequently asked questions
        </h2>
        <Accordion type="single" collapsible className="gap-2.5">
          {HOME_FAQ.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`q-${i}`}
              className="rounded-xl border border-border bg-card px-4 shadow-sm"
            >
              <AccordionTrigger className="py-4 text-left font-display text-[14px] font-bold hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="pb-4 text-[13.5px] leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
