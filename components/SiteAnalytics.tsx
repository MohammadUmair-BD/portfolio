"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

/**
 * Visit counts via Vercel Web Analytics: no cookies, no personal data, nothing
 * about individual visitors. Only active once the site is deployed on Vercel.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith("/admin")) return null; // don't count the owner's own admin visits
  url.search = ""; // record the page path only
  return { ...event, url: url.toString() };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={beforeSend} />;
}
