"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { useSyncExternalStore } from "react";

/**
 * Visit counts via Vercel Web Analytics: no cookies, no personal data, nothing
 * about individual visitors. Skipped on localhost, where there is no Vercel
 * endpoint to send to.
 */
function beforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  if (url.pathname.startsWith("/admin")) return null; // don't count the owner's own admin visits
  url.search = ""; // record the page path only
  return { ...event, url: url.toString() };
}

const subscribe = () => () => {};
const isDeployed = () => !["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);

export function SiteAnalytics() {
  const deployed = useSyncExternalStore(subscribe, isDeployed, () => false);
  return deployed ? <Analytics beforeSend={beforeSend} /> : null;
}
