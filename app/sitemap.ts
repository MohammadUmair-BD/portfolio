import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = siteUrl();
  const now = new Date();
  return [
    { url: `${site}/`, lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${site}/quick`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${site}/explore`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}
