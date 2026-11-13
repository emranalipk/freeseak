import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

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
  title: "FreeSeak — Free Online Tools for PDF, Images & Everyday Tasks",
  description:
    "Smart, free tools that finish the job in your browser. No sign-up, no uploads — your files never leave your device. Seek & Done.",
  keywords: [
    "free online tools",
    "qr code generator",
    "word counter",
    "percentage calculator",
    "age calculator",
    "pdf tools",
    "image tools",
    "no upload",
  ],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "FreeSeak — Free Online Tools",
    description:
      "Smart, free tools that finish the job in your browser. No sign-up, no uploads.",
    siteName: "FreeSeak",
    type: "website",
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
          {children}
          <Toaster position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
