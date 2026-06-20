// Per-portal HTML → structured record. Regex-based; falls back to null on
// missing fields. Stable enough for current portal layouts; will need a
// re-pass if kv.ee or city24.ee redesigns.

const CITIES = new Set([
  "tallinn", "tartu", "parnu", "narva", "haapsalu", "rakvere", "viljandi",
  "kuressaare", "voru", "valga", "johvi", "paide", "rapla", "viimsi",
  "saue", "keila", "tap", "polva", "elva", "kunda", "kardla", "paldiski",
  "maardu", "turi", "kose", "tabasalu", "laagri", "saku", "harku",
  "joelachtme", "raasiku", "anija",
]);

const ESTONIAN_MAP = {
  tallinn: "tallinn", tartu: "tartu", parnu: "parnu", narva: "narva",
  haapsalu: "haapsalu", rakvere: "rakvere", viljandi: "viljandi",
  kuressaare: "kuressaare", voru: "voru", valga: "valga", johvi: "johvi",
  paide: "paide", rapla: "rapla", viimsi: "viimsi", saue: "saue", keila: "keila",
  nomme: "nomme", kesklinn: "kesklinn", kristiine: "kristiine", mustamae: "mustamae",
  pirita: "pirita", lasnamae: "lasnamae",
};

function stripDiacritics(s) {
  return s
    .replace(/[õöäüÕÖÄÜ]/g, (c) => ({ õ: "o", ö: "o", ä: "a", ü: "u", Õ: "o", Ö: "o", Ä: "a", Ü: "u" }[c] ?? c))
    .toLowerCase();
}

function normalizeAddress(addr) {
  if (!addr) return "";
  const tokens = stripDiacritics(addr)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => ESTONIAN_MAP[w] || w);
  if (tokens.length === 0) return "";
  // If last token is a known city, AND second-to-last is a non-numeric word
  // (i.e. a district), drop the second-to-last.
  let out = tokens;
  const last = out[out.length - 1];
  const second = out[out.length - 2];
  if (
    out.length >= 3 &&
    CITIES.has(last) &&
    second != null &&
    !/^\d+[a-z]?$/.test(second) &&
    !CITIES.has(second)
  ) {
    out = [...out.slice(0, -2), last];
  }
  return out.join("-");
}

function parsePriceEur(html) {
  const m = html.match(/(?:€\s*)?(\d{1,3}(?:[\s\u00a0]\d{3})+|\d{4,7})(?:\s*€)/);
  if (!m) return null;
  return parseInt(m[1].replace(/[\s\u00a0]/g, ""), 10);
}

function parseNumber(html, label) {
  const re = new RegExp(`${label}[^0-9]*([0-9]+(?:[.,][0-9]+)?)`, "i");
  const m = html.match(re);
  if (!m) return null;
  return parseFloat(m[1].replace(",", "."));
}

function parseKvListing(url, html) {
  if (!html || typeof html !== "string") return null;
  const m = url.match(/kv\.ee\/(\d+)/i);
  const listingId = m ? m[1] : "";
  const price = parsePriceEur(html);
  const addrM = html.match(/Aadress[\s\S]*?<dd[^>]*>([^<]+)<\/dd>/i);
  const address = addrM ? addrM[1].trim() : null;
  const rooms = parseNumber(html, "Tube");
  const areaM2 = parseNumber(html, "(?:Üldpind|pindala|netopind)");
  const energyM = html.match(/Energiamärgis[\s\S]*?<dd[^>]*>([A-H])<\/dd>/i);
  const energyClass = energyM ? energyM[1] : null;
  const yearM = html.match(/Ehitusaasta[\s\S]*?<dd[^>]*>(\d{4})<\/dd>/i);
  const buildYear = yearM ? parseInt(yearM[1], 10) : null;
  const photos = html.match(/<img[^>]*src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp))/gi) || [];
  const descM = html.match(/object-description[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  const description = descM ? descM[1].replace(/<[^>]+>/g, " ").trim() : "";
  const hasFloorPlan = /plaani|plaan\.|floor.?plan/i.test(html) ? 1 : 0;
  return {
    portal: "kv.ee",
    listing_id: listingId,
    url,
    address_display: address,
    address_norm: normalizeAddress(address),
    price_eur: price,
    area_m2: areaM2,
    rooms,
    energy_class: energyClass,
    build_year: buildYear,
    photo_count: photos.length,
    description_len: description.length,
    has_floor_plan: hasFloorPlan,
  };
}

function parseCity24Listing(url, html) {
  if (!html || typeof html !== "string") return null;
  // city24 URLs end with /<id> (numeric) — match the trailing segment with digits
  const m = url.match(/(\d{4,})/) || url.match(/city24\.ee\/[^/]+\/[^/]+\/([^/?#]+)/);
  const listingId = m ? m[1] : "";
  const price = parsePriceEur(html);
  const titleM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = titleM ? titleM[1].replace(/<[^>]+>/g, " ").trim() : "";
  const address = title.replace(/^\d+-toaline\s+\w+,?\s*/i, "").trim() || null;
  // Prefer the body "Tube: N" if present; fall back to title prefix.
  const bodyRooms = parseNumber(html, "Tube");
  const titleRoomsMatch = title.match(/^(\d+)-toaline/);
  const rooms = bodyRooms != null
    ? bodyRooms
    : (titleRoomsMatch ? parseInt(titleRoomsMatch[1], 10) : null);
  const areaM2 = parseNumber(html, "Pindala");
  const energyM = html.match(/Energiamärgis[:\s]*([A-H])/i);
  const energyClass = energyM ? energyM[1] : null;
  const yearM = html.match(/Ehitusaasta[:\s]*(\d{4})/i);
  const buildYear = yearM ? parseInt(yearM[1], 10) : null;
  const photos = html.match(/<img[^>]*src=["'](https:\/\/[^"']+\.(?:jpg|jpeg|png|webp))/gi) || [];
  const hasFloorPlan = /plaani|plaan\./i.test(html) ? 1 : 0;
  const ps = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((mm) => mm[1].replace(/<[^>]+>/g, " ").trim());
  const description = ps.sort((a, b) => b.length - a.length)[0] || "";
  return {
    portal: "city24.ee",
    listing_id: listingId,
    url,
    address_display: address,
    address_norm: normalizeAddress(address),
    price_eur: price,
    area_m2: areaM2,
    rooms,
    energy_class: energyClass,
    build_year: buildYear,
    photo_count: photos.length,
    description_len: description.length,
    has_floor_plan: hasFloorPlan,
  };
}

module.exports = { parseKvListing, parseCity24Listing, normalizeAddress };
