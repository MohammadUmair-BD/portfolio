/** Lowercase, drop punctuation (keeping things like "node.js", "c++", "c#", ".net"), collapse spaces. */
export function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .replace(/\.(?![a-z0-9])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const FILLER = new Set([
  "a", "an", "the", "please", "can", "could", "would", "you", "tell", "me", "i", "to", "of", "for",
  "does", "do", "did", "is", "are", "was", "were", "he", "she", "they", "him", "her", "his", "hers",
  "their", "them", "umair", "muhammad", "mohammad", "mr", "and", "or", "so", "just", "some", "about",
  "what", "whats", "which", "with", "in", "on", "at", "it", "its", "my", "your",
]);

export const contentTokens = (normalized: string) =>
  normalized.split(" ").filter((t) => t && !FILLER.has(t));

/** Optimal string alignment distance: Levenshtein that also counts a swap ("laravle") as one edit. */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

/** Exact match, a plural, or a one-letter typo on words of 5+ letters. */
export function wordMatches(token: string, word: string): boolean {
  if (token === word || token === `${word}s`) return true;
  return word.length >= 5 && token.length >= 5 && editDistance(token, word) <= 1;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function hasPhrase(normalized: string, phrase: string): boolean {
  return new RegExp(`(^| )${escapeRe(phrase)}( |$)`).test(normalized);
}
