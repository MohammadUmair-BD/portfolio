import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { profile } from "@/lib/profile";
import { KEYWORDS, siteUrl } from "@/lib/site";
import "./globals.css";

const body = Geist({ variable: "--font-geist", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

// Search results show roughly 155 characters of the description, so the key facts come first.
const title = `${profile.name}: Laravel & PHP Developer in Peshawar, Pakistan`;
const description = `${profile.name}, ${profile.headline} in ${profile.location}. Laravel, Filament and React/Inertia.js platforms for UAE clients. Available for remote and on-site roles.`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: title, template: `%s | ${profile.name}, Laravel Developer` },
  description,
  keywords: KEYWORDS,
  authors: [{ name: profile.name, url: siteUrl() }],
  creator: profile.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "profile",
    url: "/",
    title,
    description,
    siteName: `${profile.name} Portfolio`,
    locale: "en_US",
    firstName: profile.name.split(" ")[0],
    lastName: profile.name.split(" ").slice(1).join(" "),
  },
  twitter: { card: "summary_large_image", title, description },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  // Google Search Console "HTML tag" verification: paste only the content="…" value into this env var.
  ...(process.env.GOOGLE_SITE_VERIFICATION ? { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } } : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f1e8" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1714" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <SiteAnalytics />
      </body>
    </html>
  );
}
