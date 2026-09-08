import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ijra",
  description: "File it, the agent fixes it, the PR waits for your review.",
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  openGraph: {
    title: "ijra",
    description: "File it, the agent fixes it, the PR waits for your review.",
    siteName: "ijra",
    images: ["/opengraph-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ijra",
    description: "File it, the agent fixes it, the PR waits for your review.",
    images: ["/opengraph-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} dark`}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <main className="flex min-h-dvh w-full flex-col">{children}</main>
      </body>
    </html>
  );
}
