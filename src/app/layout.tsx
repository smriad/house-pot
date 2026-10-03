import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import JsonLd from "@/components/JsonLd";
import { SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

const description =
  "House Pot plans dinner from your pantry with open-weight Gemma, remembers allergies in MongoDB, and reads recipes aloud only after your cook approves — built for Hacktoberfest Build for a Friend.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — Build for a Friend`,
    template: `%s · ${SITE_NAME}`,
  },
  description,
  keywords: [
    "open source AI",
    "Gemma",
    "meal planner",
    "Hacktoberfest",
    "human in the loop",
    "ElevenLabs",
    "MongoDB",
  ],
  authors: [{ name: "smriad", url: "https://github.com/smriad" }],
  creator: "smriad",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl(),
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Build for a Friend`,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — Build for a Friend`,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: { canonical: siteUrl() },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#3D5F58",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col">
        <JsonLd />
        {children}
      </body>
    </html>
  );
}
