import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";
import GlobalClientEffects from "@/components/GlobalClientEffects";

import "./globals.css";
import { PUBLISHING_FONTS_GOOGLE_CSS_URL } from "@/lib/publishing-fonts";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GenPuzzle",
  description: "GenPuzzle - Puzzle and worksheet generator",
  icons: [
    { rel: "icon", url: "/genpuzzle-icon.svg" },
    { rel: "shortcut icon", url: "/genpuzzle-icon.svg" },
    { rel: "apple-touch-icon", url: "/genpuzzle-icon.svg" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <>
      <header style={{display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px'}}>
        <a href="/" style={{display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit'}}>
          <img src="/genpuzzle-logo.svg" alt="GenPuzzle" style={{height: 40}} />
          <span style={{fontWeight: 700, fontSize: 18}}>GenPuzzle</span>
        </a>
      </header>
      {children}
      <GlobalClientEffects />
    </>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href={PUBLISHING_FONTS_GOOGLE_CSS_URL} />
        <link rel="icon" href="/genpuzzle-icon.svg" />
        <link rel="shortcut icon" href="/genpuzzle-icon.svg" />
        <link rel="apple-touch-icon" href="/genpuzzle-icon.svg" />
        <meta name="application-name" content="GenPuzzle" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased `}
      >
        <Toaster />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {content}
        </ThemeProvider>
      </body>
    </html>
  );
}
