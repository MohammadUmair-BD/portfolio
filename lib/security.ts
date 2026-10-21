/**
 * Input handling shared by every API route. React already escapes everything it
 * renders, and all SQL is parameterised; these checks reject hostile input at
 * the door so it is never stored or echoed anywhere.
 */

/** HTML tags, script URLs and encoded variants of them. Plain prose (including "<3" or "a < b") passes. */
const MARKUP = [
  /<\/?[a-z!?]/i, // <script>, </div, <!--, <?php, <img src=x ... (browsers ignore "< x")
  /(?:java|vb)script\s*:/i, // javascript: / vbscript: URLs
  /data\s*:\s*text\/html/i, // data:text/html payloads
  /&#x?[0-9a-f]+;?/i, // HTML numeric entities (&#60; &#x3c;) used to smuggle tags
  /%3c|%3e/i, // URL-encoded < and >
  /\\u003c|\\x3c/i, // JS-escaped <
];

export function containsMarkup(value: string): boolean {
  return MARKUP.some((re) => re.test(value));
}

/** Normalise lookalike characters and drop invisible control characters (keeping newlines and tabs). */
export function clean(value: unknown, { multiline = false } = {}): string {
  if (typeof value !== "string") return "";
  const normalised = value.normalize("NFKC").replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, "");
  const stripped = multiline
    ? normalised.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").replace(/\r\n?/g, "\n")
    : normalised.replace(/[\u0000-\u001F\u007F]/g, " ");
  return stripped.trim();
}

const json = (body: unknown, status: number) => Response.json(body, { status });

/**
 * Refuses requests made from other websites (cross-site form posts / fetches).
 * Requests without browser origin headers (curl, server-to-server, tests) are allowed;
 * they can't carry a visitor's credentials anyway, because the site uses no cookies.
 */
export function rejectCrossSite(request: Request): Response | null {
  const site = request.headers.get("sec-fetch-site");
  if (site && !["same-origin", "same-site", "none"].includes(site)) return json({ error: "Cross-site requests are not allowed." }, 403);
  const origin = request.headers.get("origin");
  if (origin) {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {
      // Malformed Origin header.
    }
    if (originHost !== host) return json({ error: "Cross-site requests are not allowed." }, 403);
  }
  return null;
}

/** Reads a small JSON body, or returns the error response to send instead. */
export async function readJson(request: Request, maxBytes: number): Promise<{ data: Record<string, unknown> } | { error: Response }> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return { error: json({ error: "Send the request as JSON." }, 415) };
  }
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) return { error: json({ error: "Request is too large." }, 413) };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { error: json({ error: "Request is too large." }, 413) };
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    return { data };
  } catch {
    return { error: json({ error: "Invalid request." }, 400) };
  }
}

/** Only links that are safe to put in an href: web, email, phone, or a path on this site. */
export function isSafeHref(href: string): boolean {
  return /^(https?:\/\/|mailto:|tel:|\/(?!\/))/i.test(href.trim());
}

/** JSON for an inline <script type="application/ld+json">, unable to close the script tag. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
