import type { Metadata } from "next";
import { Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const title = "ijra";
const description = "File it, fix it";
const ogImage = {
  url: "/opengraph-image.png",
  width: 1200,
  height: 630,
  alt: "File it, fix it",
};

export const metadata: Metadata = {
  title,
  description,
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  openGraph: {
    title,
    description,
    siteName: "ijra",
    images: [ogImage],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [ogImage],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${display.variable} dark`}>
      <body className="min-h-dvh bg-background text-foreground">
        <main className="flex min-h-dvh w-full flex-col">{children}</main>
      </body>
    </html>
  );
}
