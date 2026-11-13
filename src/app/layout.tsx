import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { CommandPalette } from "@/components/site/command-palette";
import { CF_ANALYTICS_TOKEN, SITE_NAME, SITE_URL } from "@/lib/site";

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
    default: "Free Online Tools — No Sign-Up, Nothing Uploaded | FreeSeak",
    template: "%s | FreeSeak",
  },
  description:
    "Free tools that run in your browser: QR generator, word counter, percentage and age calculators. No sign-up, no uploads — your files never leave your device.",
  keywords: [
    "free online tools",
    "qr code generator",
    "word counter",
    "percentage calculator",
    "age calculator",
    "compress pdf online",
    "merge pdf",
    "resize image",
    "invoice generator",
    "no sign up tools",
  ],
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "FreeSeak — Free Online Tools",
    description:
      "Smart, free tools that finish the job in your browser. No sign-up, no uploads — your files never leave your device.",
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
    title: "FreeSeak — Free Online Tools",
    description:
      "Smart, free tools that finish the job in your browser. No sign-up, no uploads.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#F3F6FA",
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
