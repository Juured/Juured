// Normalize Estonian addresses for clustering and DB lookup.
// MUST match the scrape-side normalizeAddress in scrape/parsers.js.

const ESTONIAN_MAP: Record<string, string> = {
  tallinn: "tallinn", tartu: "tartu", parnu: "parnu", narva: "narva",
  haapsalu: "haapsalu", rakvere: "rakvere", viljandi: "viljandi",
  kuressaare: "kuressaare", voru: "voru", valga: "valga", johvi: "johvi",
  paide: "paide", rapla: "rapla", viimsi: "viimsi", saue: "saue", keila: "keila",
  nomme: "nomme", kesklinn: "kesklinn", kristiine: "kristiine", mustamae: "mustamae",
  pirita: "pirita", lasnamae: "lasnamae",
};

const CITIES = new Set<string>([
  "tallinn", "tartu", "parnu", "narva", "haapsalu", "rakvere", "viljandi",
  "kuressaare", "voru", "valga", "johvi", "paide", "rapla", "viimsi",
  "saue", "keila", "tap", "polva", "elva", "kunda", "kardla", "paldiski",
  "maardu", "turi", "kose", "tabasalu", "laagri", "saku", "harku",
  "joelachtme", "raasiku", "anija",
]);

function stripDiacritics(s: string): string {
  return s
    .replace(/[õöäüÕÖÄÜ]/g, (c) => ({ õ: "o", ö: "o", ä: "a", ü: "u", Õ: "o", Ö: "o", Ä: "a", Ü: "u" }[c] ?? c))
    .toLowerCase();
}

export function normalizeAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  const tokens = stripDiacritics(addr)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ESTONIAN_MAP[w] ?? w);
  if (tokens.length === 0) return "";
  const last = tokens[tokens.length - 1];
  const second = tokens[tokens.length - 2];
  if (
    tokens.length >= 3 &&
    CITIES.has(last) &&
    second != null &&
    !/^\d+[a-z]?$/.test(second) &&
    !CITIES.has(second)
  ) {
    return [...tokens.slice(0, -2), last].join("-");
  }
  return tokens.join("-");
}

// Cluster: keep only street name + house number + city (drop district).
// Two normalized addresses with the same cluster are the same building.
export function similarAddressCluster(norm: string): string {
  if (!norm) return "";
  const parts = norm.split("-");
  if (parts.length < 3) return norm;
  const city = parts[parts.length - 1];
  const street = parts[0];
  const numPart = parts.find((p) => /^\d+[a-z]?$/.test(p)) ?? "";
  return [street, numPart, city].filter(Boolean).join("-");
}
