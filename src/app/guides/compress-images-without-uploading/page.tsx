import type { Metadata } from "next";
import Link from "next/link";
import { PageSection, StaticPage } from "@/components/site/static-page";
import {
  OPERATOR_EXPERIENCE,
  OPERATOR_NAME,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

export const metadata: Metadata = {
  title: "How to Compress Images Without Uploading Them — Free & Private",
  description:
    "Shrink JPG, PNG and WebP files without sending them to a server. Why upload-based compressors are a privacy risk, how in-browser compression works, and how to hit an exact size like 100 KB.",
  alternates: { canonical: "/guides/compress-images-without-uploading" },
  openGraph: {
    title: "How to Compress Images Without Uploading Them — FreeSeak",
    description:
      "Why upload-based compressors are a privacy risk, how in-browser compression works, and how to hit an exact size like 100 KB.",
    url: "/guides/compress-images-without-uploading",
    type: "article",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} — how to compress images without uploading them`,
      },
    ],
  },
};

/* v0.4: Article structured data — content pages get the same SEO
   care as tool pages (see Rule 4). */
const articleJsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "How to Compress Images Without Uploading Them",
  description:
    "Why upload-based compressors are a privacy risk, how in-browser compression works, and how to hit an exact size like 100 KB.",
  author: { "@type": "Organization", name: OPERATOR_NAME },
  publisher: { "@type": "Organization", name: OPERATOR_NAME },
  datePublished: "2026-11-14",
  mainEntityOfPage: `${SITE_URL}/guides/compress-images-without-uploading`,
  image: `${SITE_URL}/og-image.png`,
};

export default function CompressImagesGuidePage() {
  return (
    <>
      <StaticPage
        title="How to Compress Images Without Uploading Them"
        intro="A photo from a modern phone often weighs 3–8 MB — too big for an email attachment, a job-application form or a fast-loading web page. The usual fix is an online compressor, but almost all of them work the same way: your file is uploaded to their server first. This guide shows a different approach, one where the image never leaves your device at all."
      >
        <PageSection heading="Why image files are so big">
          <p>
            Modern smartphones shoot 12–48 megapixel photos, and every pixel
            costs bytes; a single picture can easily weigh 5 MB. Email
            providers commonly cap attachments at 20–25 MB in total, and plenty
            of web forms — visa applications, job portals, marketplaces — set
            per-file limits as low as 1 MB or even 100 KB. Meanwhile, a web
            page that loads five full-size photos can keep a visitor on mobile
            data waiting for many seconds. Compression is not a nice-to-have;
            it is basic digital hygiene.
          </p>
        </PageSection>

        <PageSection heading="The hidden cost of free online compressors">
          <p>
            Most compressor websites advertise free, fast, no-sign-up — and
            they are, because the real price is your file. The moment you
            press Upload, your photo or scan travels to a server you know
            nothing about: who runs it, where it is located, how long the file
            is kept, who else can access it. Privacy policies usually promise
            that files are deleted after a few hours, but you have to take
            that on trust.
          </p>
          <p>
            Now think about what people actually compress: passport scans,
            medical documents, contract photos, family pictures. A breach, a
            misconfigured storage bucket or a chatty logging system can expose
            all of it — and once a copy exists on someone else&apos;s server,
            you cannot delete it. Uploading also costs time and mobile
            bandwidth, and it fails completely when you are offline.
          </p>
        </PageSection>

        <PageSection heading="How in-browser compression works">
          <p>
            A browser can already do everything a compression server does.
            When you drop an image into a client-side tool, the browser decodes
            it into memory, re-encodes it at the quality level you choose, and
            hands you the new file — all on your device, in a fraction of a
            second for typical photos.
          </p>
          <p>
            The quality slider controls how much detail the encoder keeps: at
            75–90 the difference is usually invisible, at 40–60 you can start
            to see it. Target-size mode goes one step further — the tool
            compresses at several quality levels automatically and returns the
            highest quality that fits under your limit, such as 100 KB. You
            can watch the network tab while it works: nothing is transmitted,
            and the tool keeps working with your internet connection switched
            off.
          </p>
        </PageSection>

        <PageSection heading="Step by step: shrink an image privately">
          <p>
            The{" "}
            <Link
              href="/tools/compress-image"
              className="font-semibold text-primary hover:underline"
            >
              FreeSeak Image Compressor
            </Link>{" "}
            does all of the above, free and without an account. The whole job
            takes under a minute:
          </p>
          <ol className="ml-4 list-decimal space-y-1.5">
            <li>
              <Link
                href="/tools/compress-image"
                className="font-semibold text-primary hover:underline"
              >
                Open the Image Compressor
              </Link>
              .
            </li>
            <li>
              Drop your images onto the page, click to browse, or paste them
              straight from the clipboard.
            </li>
            <li>
              Choose how much to compress: a quality slider, an exact target
              size (tap the 100 KB chip if a form demands it), or a preset
              such as Web &amp; email.
            </li>
            <li>
              Optionally cap the longest edge (1920 px is a good default for
              photos) or convert the output format.
            </li>
            <li>
              Press Compress, check the before → after sizes, and download
              your images — one by one or all at once.
            </li>
          </ol>
        </PageSection>

        <PageSection heading="Choosing the right settings">
          <p>
            A few rules of thumb cover most situations. Photos are usually
            JPG or WebP: quality 75–85 shrinks them dramatically with no
            visible difference. PNG files — screenshots, logos, line art — are
            lossless, so re-encoding alone barely helps; cap the longest edge
            or convert them to JPG or WebP for real savings. When a form
            enforces a hard limit, switch to target-size mode and type the
            number it demands. And if your goal is dimensions rather than
            bytes, the{" "}
            <Link
              href="/tools/resize-image"
              className="font-semibold text-primary hover:underline"
            >
              Image Resizer
            </Link>{" "}
            is the better tool.
          </p>
        </PageSection>

        <PageSection heading="The takeaway">
          <p>
            Compressing an image does not require handing it to a
            stranger&apos;s server. A modern browser has everything needed to
            do it locally: instantly, privately, offline. The next time a form
            refuses your 6 MB photo, you know what to do — open the
            compressor, keep the file on your device, and be done in a minute.
          </p>
        </PageSection>

        {/* byline (plan §4.1): reference the operator exactly once */}
        <p className="text-center text-[12px] font-semibold text-muted-foreground/70">
          Built by {OPERATOR_NAME} — {OPERATOR_EXPERIENCE}.
        </p>
      </StaticPage>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
    </>
  );
}
