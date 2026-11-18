import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CommandPalette } from "@/components/site/command-palette";
import { CF_ANALYTICS_TOKEN, IS_PREVIEW, SITE_NAME, SITE_URL } from "@/lib/site";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  /* v0.3: SITE_URL (freeseak.com) is the single source — see src/lib/site.ts */
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Free Private Online Tools — No Uploads, No Sign-Up | FreeSeak",
    template: "%s | FreeSeak",
  },
  description:
    "Free, privacy-first tools that run entirely in your browser. Compress images, generate QR codes, and more — no files uploaded, no account needed. Built by Bluefrog.",
  /* v1.0.3: preview builds (workers.dev / localhost) are noindexed from the
     layout down — launch day flips SITE_MODE=production and this disappears
     (docs/LAUNCH_CHECKLIST.md). The meta-keywords tag was removed: no search
     engine has read it in years. */
  robots: IS_PREVIEW ? { index: false, follow: false } : undefined,
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    title: "FreeSeak — Free Private Online Tools, No Uploads",
    description:
      "Free, privacy-first tools that run entirely in your browser. No files uploaded, no account needed. Built by Bluefrog.",
    siteName: SITE_NAME,
    type: "website",
    url: SITE_URL,
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "FreeSeak — free online tools that run in your browser",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreeSeak — Free Private Online Tools, No Uploads",
    description:
      "Free, privacy-first tools that run entirely in your browser. No files uploaded, no account needed.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  /* media-scoped so the phone/browser chrome follows the dark theme too */
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F3F6FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0E1626" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} font-sans antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* v0.2: header, footer and the Ctrl+K palette moved here so
              they wrap EVERY page — tool pages included */}
          <div id="top" className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <CommandPalette />
          <Toaster position="bottom-center" />
        </ThemeProvider>

        {/* v0.3: Cloudflare Web Analytics — cookieless, so it fits the
            privacy promise. Rendered only when a token is set in
            src/lib/site.ts. */}
        {CF_ANALYTICS_TOKEN ? (
          <Script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            strategy="afterInteractive"
            data-cf-beacon={JSON.stringify({ token: CF_ANALYTICS_TOKEN })}
          />
        ) : null}
      </body>
    </html>
  );
}
