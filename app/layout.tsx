import type { Metadata, Viewport } from "next";
import { Fraunces, Geist } from "next/font/google";
import { SiteAnalytics } from "@/components/SiteAnalytics";
import { profile } from "@/lib/profile";
import "./globals.css";

const body = Geist({ variable: "--font-geist", subsets: ["latin"] });
const display = Fraunces({ variable: "--font-fraunces", subsets: ["latin"] });

const description = `${profile.name}, ${profile.headline} based in ${profile.location}. ${profile.summary}`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  title: { default: `${profile.name} | ${profile.headline}`, template: `%s | ${profile.name}` },
  description,
  openGraph: {
    type: "profile",
    title: `${profile.name} | ${profile.headline}`,
    description,
    siteName: `${profile.name} Portfolio`,
  },
  twitter: { card: "summary", title: profile.name, description },
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
