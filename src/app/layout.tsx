import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from "@/components/ui/sonner";

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
  title: "GenPuzzle — Puzzle book maker",
  description: "Create and publish professional puzzle books with GenPuzzle.",
  icons: [
    { rel: "icon", url: "/favicon.svg", type: "image/svg+xml" },
    { rel: "shortcut icon", url: "/favicon.svg" },
    { rel: "apple-touch-icon", url: "/favicon.svg" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = children;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href={PUBLISHING_FONTS_GOOGLE_CSS_URL} />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
        <meta name="application-name" content="GenPuzzle" />
        <meta name="theme-color" content="#1a5a8c" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
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
