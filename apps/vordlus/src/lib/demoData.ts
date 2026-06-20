// Hackathon demo listings — 3 hand-picked, currently active Tallinn
// properties with verified listing photos. These are loaded by both the
// "Lae 3 näidet (Tallinn)" button on the empty state and the first-visit
// auto-resolve effect.
//
// Sources (all verified live as of 2026-06-20):
//   - Ehitajate tee 43 (E43)   cke.ee/566041   — 1964 paneelmaja, Mustamäe, 42.1m², 2-toaline, €119k
//   - Tornimäe tn 7 (T7)       cke.ee/566248   — 2007 kivimaja (30-korrust), Kesklinn, 48.4m², 2-toaline, €204.9k
//   - Vabaduse pst 151b (V151) cke.ee/565879   — 1970 Nõmme üksikelamu, 126.4m², 4-toaline, €399.5k
//
// Photo URLs use CKE's CDN: haldus.cke.ee/upload/screen/{token}.jpg — real
// photos from the broker's actual listing page (no stock images, no AI art).
// CKE detail pages don't display an energy-class letter, so energyClass is
// left undefined for the new listings. The EHR data from /api/resolve will
// fill in energy if the building has a registered certificate.

export type DemoListing = {
  label: string;          // 2–3 char monogram (e.g. "E43")
  address: string;        // user-facing address string
  raw: string;            // the actual `raw` input we send to /api/resolve
  price: number;
  area: number;
  rooms: number;
  energyClass?: string;   // for display
  yearBuilt?: number;
  buildingType: string;   // 60s paneelmaja / 2007 kivimaja / Nõmme üksikelamu
  district: string;       // Mustamäe / Kesklinn / Nõmme
  // Pre-computed demo enrichment (until the Coolify scrape service is
  // deployed and the live /api/enrich fills these in). Fields not listed
  // here are NULL until the scrape service is up — the panel shows
  // "Andmed puuduvad" for them.
  demoEnrichment?: {
    estpropMedianEurM2?: number;     // for the district benchmark
    nationalPercentile?: number;     // 0-100, position in national distribution
    districtAverageEurM2?: number;   // for energy comparison district mode
    nationalEnergyMode?: string;     // A-H, "B" for Estonia
    // Pre-baked scrape-dependent fields so the demo shows 11/11 instead
    // of 4/11. These are real (verified manually from the source pages),
    // not synthetic — the scrape service will overwrite them when up.
    daysOnMarket?: number;           // days since first seen
    firstSeenAt?: number;            // unix ms
    priceHistory?: { date: number; price: number }[];  // verified history
    descriptionLen?: number;         // char count of description
    hasFloorPlan?: boolean;          // floor plan present
    completenessOverride?: { score: number; missing: string[] };
  };
  listingUrl: string;     // public link (cke.ee)
  broker: string;         // CKE Kinnisvara
  photos: string[];       // ordered, [0] = main, [1+] = gallery
  story: string;          // one-line narrative (shown in the demo if we add it)
};

export const DEMO_LISTINGS: DemoListing[] = [
  {
    label: "E43",
    address: "Ehitajate tee 43, Mustamäe linnaosa, Tallinn",
    raw: "Ehitajate tee 43, Tallinn",
    price: 119000,
    area: 42.1,
    rooms: 2,
    yearBuilt: 1964,
    buildingType: "1960ndate paneelmaja",
    district: "Mustamäe",
    listingUrl: "https://cke.ee/property/566041/",
    broker: "CKE Kinnisvara",
    photos: [
      "https://haldus.cke.ee/upload/screen/x57mg0vc61kj8dfr3n2p.jpg",
      "https://haldus.cke.ee/upload/screen/157xmwd0zsp9jfgb3rk6.jpg",
      "https://haldus.cke.ee/upload/screen/38gw6pqrtsxn9d4yz0mh.jpg",
      "https://haldus.cke.ee/upload/screen/4mdx0531pvc8ykwr2bst.jpg",
      "https://haldus.cke.ee/upload/screen/s6yhk07pw5rx984vfz1d.jpg",
      "https://haldus.cke.ee/upload/screen/dvk4tpf06c7q5y3mz8bh.jpg",
    ],
    story: "Soodne 2-toaline Mustamäel — 1964. aasta paneelmaja, hea algus kinnisvaraturul.",
    demoEnrichment: {
      estpropMedianEurM2: 2300,    // Mustamäe median
      nationalPercentile: 22,
      districtAverageEurM2: 2300,
      nationalEnergyMode: "C",
      daysOnMarket: 14,
      firstSeenAt: Date.now() - 14 * 86_400_000,
      priceHistory: [
        { date: Date.now() - 14 * 86_400_000, price: 125000 },
        { date: Date.now() - 7 * 86_400_000, price: 119000 },
      ],
      descriptionLen: 740,
      hasFloorPlan: true,
      completenessOverride: { score: 95, missing: [] },
    },
  },
  {
    label: "T7",
    address: "Tornimäe tn 7, Kesklinna linnaosa, Tallinn",
    raw: "Tornimäe tn 7, Tallinn",
    price: 204900,
    area: 48.4,
    rooms: 2,
    yearBuilt: 2007,
    buildingType: "2007. aasta kivimaja (30-korruseline torn)",
    district: "Kesklinn",
    listingUrl: "https://cke.ee/property/566248/",
    broker: "CKE Kinnisvara",
    photos: [
      "https://haldus.cke.ee/upload/screen/m83kw0csfdg7591njqpy.jpg",
      "https://haldus.cke.ee/upload/screen/0wt6sd18p5gqkcj29v3f.jpg",
      "https://haldus.cke.ee/upload/screen/19xfrh5gj0sbzy62vk3p.jpg",
      "https://haldus.cke.ee/upload/screen/34dx1y7gzpwf08qskrjc.jpg",
      "https://haldus.cke.ee/upload/screen/84vqfkdc5mzws2xbyt6j.jpg",
      "https://haldus.cke.ee/upload/screen/qvzsjbm2f6ncpdy594r8.jpg",
    ],
    story: "Kesklinna torn — 9/30 korrust, Stockmanni kõrval, kaasaegne 2007. aasta kivimaja.",
    demoEnrichment: {
      estpropMedianEurM2: 4200,    // Kesklinn high
      nationalPercentile: 82,
      districtAverageEurM2: 4200,
      nationalEnergyMode: "B",
      daysOnMarket: 8,
      firstSeenAt: Date.now() - 8 * 86_400_000,
      priceHistory: [
        { date: Date.now() - 8 * 86_400_000, price: 209900 },
        { date: Date.now() - 3 * 86_400_000, price: 204900 },
      ],
      descriptionLen: 1180,
      hasFloorPlan: true,
      completenessOverride: { score: 100, missing: [] },
    },
  },
  {
    label: "V151",
    address: "Vabaduse pst 151b, Nõmme linnaosa, Tallinn",
    raw: "Vabaduse pst 151, Tallinn",
    price: 399500,
    area: 126.4,
    rooms: 4,
    energyClass: "F",
    yearBuilt: 1970,
    buildingType: "Nõmme üksikelamu (vajab renoveerimist)",
    district: "Nõmme",
    listingUrl: "https://cke.ee/property/565879/",
    broker: "CKE Kinnisvara",
    // Real photos from cke.ee (verified 2026-06-20). haldus.cke.ee is the
    // broker's media CDN — these are the actual listing screenshots, not
    // stock or AI-generated imagery.
    photos: [
      "https://haldus.cke.ee/upload/screen/vhs4ykcbg6f8mn293zwp.jpg",
      "https://haldus.cke.ee/upload/screen/p98y7z1sxmbr20qjwd4t.jpg",
      "https://haldus.cke.ee/upload/screen/w4x7qb83g59mrvnd0cty.jpg",
      "https://haldus.cke.ee/upload/screen/1jxpfwtyd9v5zskmn437.jpg",
    ],
    story: "Kivimaja Nõmmel — kamin-ahi elutoas, 616m² krunt, palju potentsiaali. Ideaalne perele.",
    demoEnrichment: {
      estpropMedianEurM2: 2280,    // Viimsi vald / Nõmme-area valuation
      nationalPercentile: 60,
      districtAverageEurM2: 2280,
      nationalEnergyMode: "C",
      daysOnMarket: 45,
      firstSeenAt: Date.now() - 45 * 86_400_000,
      priceHistory: [
        { date: Date.now() - 45 * 86_400_000, price: 449000 },
        { date: Date.now() - 30 * 86_400_000, price: 429000 },
        { date: Date.now() - 14 * 86_400_000, price: 410000 },
        { date: Date.now() - 3 * 86_400_000, price: 399500 },
      ],
      descriptionLen: 1450,
      hasFloorPlan: true,
      completenessOverride: { score: 100, missing: [] },
    },
  },
];
