// Parse user input — URL (kv.ee, city24.ee, kinnisvara24.ee), address,
// cadastral id, EHR code.
//
// All major Estonian real-estate portals are Cloudflare-gated and
// ToS-restrict scraping (kv.ee and city24.ee share the same owner:
// Baltic Classifieds Group). We DO NOT scrape them. Instead we extract
// the address hint from the URL slug, then resolve through the public
// Estonian open-data stack (In-AKS → EHR → cadastre).
//
// Recognized patterns:
//
//   kv.ee/12345
//   kv.ee/12345-tartu-mnt-47-nomme-tallinn
//   kv.ee/en/12345-tartu-mnt-47-nomme-tallinn
//   kinnisvara24.ee/<same>            (legacy kv.ee domain)
//   city24.ee/et/kinnisvara/<slug>/<city>/<id>
//   city24.ee/en/real-estate/<type>-for-<sale|rent>/<city>/<id>
//   78401:001:0215                    (cadastral id)
//   120221727                         (EHR building id)
//   "Viljandi mnt 47, Tallinn"        (free text)

export type ParsedInput =
  | {
      kind: "kv-url";
      portal: "kv.ee" | "city24.ee" | "kinnisvara24.ee";
      listingId: string;
      address: string | null; // null when URL has no slug
      raw: string;
    }
  | { kind: "address"; address: string; raw: string }
  | { kind: "tunnus"; tunnus: string; raw: string }
  | { kind: "ehr"; ehrCode: string; raw: string }
  | { kind: "empty" };

// Estonian slug → proper name lookup
// Both ASCII and accented forms of common district/city names appear in
// kv.ee slugs. We map them to the In-AKS-recognized form.
const NAME_FIXES: Record<string, string> = {
  // districts (linnaosa)
  nomme: "Nõmme",
  kesklinna: "Kesklinna",
  kristiine: "Kristiine",
  mustamae: "Mustamäe",
  pirita: "Pirita",
  haabneeme: "Haabneeme",
  lasnamae: "Lasnamäe",
  // counties
  harju: "Harju",
  tartu: "Tartu",
  parnu: "Pärnu",
  saare: "Saare",
  hiiu: "Hiiu",
  // settlements
  viimsi: "Viimsi",
  saue: "Saue",
  laagri: "Laagri",
  // city suffixes sometimes left in the slug
  tallinn: "Tallinn",
  // street suffix corrections
  mnt: "mnt",
  pst: "pst",
  tee: "tee",
  tn: "tn",
  sk: "sk",
};

function fixName(token: string): string {
  const t = token.toLowerCase();
  if (NAME_FIXES[t]) return NAME_FIXES[t];
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Noise words that frequently appear in kv.ee / kinnisvara24 slugs
// but are NOT part of the actual address.
const SLUG_NOISE = new Set([
  "uus", "vana", "väike", "suur", // adjectives ("new", "old", "small", "big")
  "ja", "voi", "ning",            // conjunctions ("and", "or")
  "avalik", "era", "kinnisvara",  // sale types
  "muuk", "üür", "rent",          // transaction types
  "korter", "elamu", "maja", "eramaja", "ridaelamu", // building types
  "müüa", "osta", "müük",
]);

// Street-name suffixes that distinguish real street tokens
// from development-name noise like "hobemetsa".
const STREET_SUFFIXES = new Set([
  "mnt", "pst", "tee", "tn", "sk",
  "maantee", "puiestee", "tänav", "sokk",
]);

function slugToAddress(slug: string): string {
  const parts = slug.toLowerCase().split("-").filter(Boolean);
  if (parts.length === 0) return "";

  // Find the first number (the building number) — this is the address anchor.
  const numberIdx = parts.findIndex((p) => /^\d+[a-z]?$/.test(p));
  if (numberIdx === -1) {
    const tok = parts.find((p) => !SLUG_NOISE.has(p));
    if (!tok) return "";
    return fixName(tok);
  }

  // Walk back from the number to find the street name.
  // Rule: street = the token right before the number, PLUS any preceding
  // "city + suffix" compound. Tokens that are pure noise OR a stand-alone
  // development name (not a city, not a suffix) are dropped.
  const before = parts.slice(0, numberIdx);
  const cleaned = before.filter((p) => !SLUG_NOISE.has(p));
  const streetWords: string[] = [];
  if (cleaned.length >= 2) {
    const [penultimate, last] = cleaned.slice(-2);
    if (STREET_SUFFIXES.has(last) && (ESTONIAN_CITY_MAP[penultimate] || STREET_SUFFIXES.has(penultimate))) {
      streetWords.push(fixName(penultimate), fixName(last));
    } else {
      streetWords.push(fixName(last));
    }
  } else if (cleaned.length === 1) {
    streetWords.push(fixName(cleaned[0]));
  } else {
    return parts[numberIdx];
  }
  streetWords.push(parts[numberIdx]);
  const streetStr = streetWords.join(" ");

  // City = a known Estonian city that appears AFTER the number
  // (district may sit between the number and the city). If none,
  // fall back to scanning the whole slug for a city token that
  // wasn't already used in the street.
  for (let i = numberIdx + 1; i < parts.length; i++) {
    if (ESTONIAN_CITY_MAP[parts[i]]) {
      return `${streetStr}, ${ESTONIAN_CITY_MAP[parts[i]]}`;
    }
  }
  for (const p of parts) {
    if (ESTONIAN_CITY_MAP[p] && !cleaned.includes(p)) {
      return `${streetStr}, ${ESTONIAN_CITY_MAP[p]}`;
    }
  }
  return streetStr;
}

const KV_BARE_RE = /^(?:https?:\/\/)?(?:www\.)?(?:kv|kinnisvara24)\.ee\/(?:[a-z]{2}\/)?(\d+)\/?$/i;
const KV_SLUG_RE = /^(?:https?:\/\/)?(?:www\.)?(?:kv|kinnisvara24)\.ee\/(?:[a-z]{2}\/)?(\d+)-(.+?)\/?$/i;
// New kv.ee layout: /kinnisvara/<category>/<slug>-o-<id>
// e.g. ".../uusarendused/uus-hobemetsa-rehe-13-ja-rehe-poik-4-avalik-muuk-o-8089"
const KV_CATEGORY_RE = /^(?:https?:\/\/)?(?:www\.)?kv\.ee\/kinnisvara\/[a-z0-9-]+\/(.+)-o-(\d+)\/?$/i;
const CITY24_ET_RE = /^(?:https?:\/\/)?(?:www\.)?city24\.ee\/[a-z]{2}\/kinnisvara\/[a-z0-9-]+\/([a-z-]+)\/?(\d+)?\/?$/i;
const CITY24_EN_RE = /^(?:https?:\/\/)?(?:www\.)?city24\.ee\/[a-z]{2}\/real-estate\/[a-z-]+-for-[a-z]+\/([a-z-]+)\/?(\d+)?\/?$/i;
const TUNNUS_RE = /^\d{5}:\d{3}:\d{4}$/;
const EHR_RE = /^\d{8,12}$/;

const ESTONIAN_CITY_MAP: Record<string, string> = {
  tallinn: "Tallinn",
  tartu: "Tartu",
  parnu: "Pärnu",
  narva: "Narva",
  haapsalu: "Haapsalu",
  rakvere: "Rakvere",
  viljandi: "Viljandi",
  kuressaare: "Kuressaare",
  voru: "Võru",
  valga: "Valga",
  johvi: "Jõhvi",
  paide: "Paide",
  rapla: "Rapla",
  viimsi: "Viimsi",
  saue: "Saue",
  keila: "Keila",
  // extra
  tallinnalinn: "Tallinn",
};

export function parseUserInput(raw: string): ParsedInput {
  const text = raw.trim();
  if (!text) return { kind: "empty" };

  // kv.ee / kinnisvara24.ee URL with slug
  let m = text.match(KV_SLUG_RE);
  if (m) {
    return {
      kind: "kv-url",
      portal: text.toLowerCase().includes("kinnisvara24") ? "kinnisvara24.ee" : "kv.ee",
      listingId: m[1],
      address: slugToAddress(m[2]),
      raw: text,
    };
  }

  // New kv.ee layout: /kinnisvara/<category>/<slug>-o-<id>
  // e.g. ".../uusarendused/uus-hobemetsa-rehe-13-ja-rehe-poik-4-avalik-muuk-o-8089"
  m = text.match(KV_CATEGORY_RE);
  if (m) {
    return {
      kind: "kv-url",
      portal: "kv.ee",
      listingId: m[2],
      address: slugToAddress(m[1]),
      raw: text,
    };
  }

  // kv.ee / kinnisvara24.ee bare ID
  m = text.match(KV_BARE_RE);
  if (m) {
    return {
      kind: "kv-url",
      portal: text.toLowerCase().includes("kinnisvara24") ? "kinnisvara24.ee" : "kv.ee",
      listingId: m[1],
      address: null,
      raw: text,
    };
  }

  // city24.ee Estonian: /et/kinnisvara/<slug>/<city>/
  m = text.match(CITY24_ET_RE);
  if (m) {
    const city = ESTONIAN_CITY_MAP[m[1].toLowerCase()] ?? (m[1].charAt(0).toUpperCase() + m[1].slice(1));
    return { kind: "kv-url", portal: "city24.ee", listingId: m[2] ?? "", address: city, raw: text };
  }

  // city24.ee English: /en/real-estate/<type>-for-<sale|rent>/<city>/
  m = text.match(CITY24_EN_RE);
  if (m) {
    const city = ESTONIAN_CITY_MAP[m[1].toLowerCase()] ?? (m[1].charAt(0).toUpperCase() + m[1].slice(1));
    return { kind: "kv-url", portal: "city24.ee", listingId: m[2] ?? "", address: city, raw: text };
  }

  // tunnus
  if (TUNNUS_RE.test(text)) return { kind: "tunnus", tunnus: text, raw: text };

  // EHR
  if (EHR_RE.test(text) && /^\d+$/.test(text)) return { kind: "ehr", ehrCode: text, raw: text };

  // free text → address
  return { kind: "address", address: text, raw: text };
}

export function parsedLabel(p: ParsedInput): string {
  switch (p.kind) {
    case "kv-url":
      return p.address
        ? `${p.portal} · ${p.address}`
        : `${p.portal} · ID ${p.listingId} (aadress puudub URL-ist — kleesti aadress käsitsi)`;
    case "address":
      return p.address;
    case "tunnus":
      return `Katastri nr · ${p.tunnus}`;
    case "ehr":
      return `EHR kood · ${p.ehrCode}`;
    case "empty":
      return "";
  }
}
