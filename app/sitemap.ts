import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = process.env.SITE_URL ?? "http://localhost:3000";
  return ["/", "/quick", "/explore"].map((path) => ({ url: `${site}${path}`, changeFrequency: "monthly", priority: path === "/quick" ? 1 : 0.8 }));
}
