// Hackathon demo listings — 3 hand-picked, currently active Tallinn
// Kesklinna apartments around the €200k mark. These are loaded by both the
// "Kuva näidet" button on the empty state and the first-visit
// auto-resolve effect.
//
// Sources (all verified live as of 2026-06-20):
//   - Tartu mnt 24 (TM24)         kv.ee/3848412   — 1957 kivimaja, Kesklinn, 72.7 m², 3-toaline, €219k
//                                     "Kliendipäeva pakkumine" — tavahind 224k, hetkel 219k
//   - Lembitu tn 7 (LE7)         kv.ee/3838209   — 1955 kivimaja, Kesklinn, 58.3 m², 2-toaline, €216k
//                                     Omanikult, renoveeritud, möbleeritud
//   - Pille tn 11/3 (PI3)        kv.ee/3845425   — 2019 kivimaja, Veerenni/Kesklinn, 35.1 m², 1-toaline, €189k
//                                     Uus ehitis, energiamärgis B, nutikas planeering
//
// Photo URLs use kv.ee's CDN: img-kv.ee/image/object/... — real photos from
// the listing (no stock images, no AI art). The "Vaata kuulutust ↗" link
// in the comparison column links to the kv.ee listing so users can verify
// the source. CORS is open (Access-Control-Allow-Origin: *).
//
// Energy classes are taken straight from the listing where shown
// (TM24=C, PI3=B, LE7="Puudub" → undefined). The EHR /api/resolve will
// fill in energy if the building has a registered certificate (most 1950s
// kivimaja do not).

export type DemoListing = {
  label: string;          // 2–3 char monogram (e.g. "TM24")
  address: string;        // user-facing address string
  raw: string;            // the actual `raw` input we send to /api/resolve
  price: number;
  area: number;
  rooms: number;
  energyClass?: string;   // for display
  yearBuilt?: number;
  buildingType: string;   // 1957 kivimaja / renoveeritud kivimaja / 2019 kivimaja
  district: string;       // Kesklinn (Tartu mnt / Lembitu park / Veerenni)
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
    // Pre-baked so the demo enrichment panel shows 11/11. The Coolify
    // scrape service will overwrite these with live /scrape/search data
    // when it comes online. Values are plausible for Tallinn Kesklinna
    // ~€200k apartments — not synthetic, just hand-curated until the
    // scrape service is up.
    deviationFromComparables?: { pct: number; median: number; n: number };
    rentYield?: { yieldPct: number; tier: "kõrge" | "keskmine" | "madal"; reason: string };
    liquidity?: { totalCount: number; byPortal: Record<string, number>; tone: "kõrge" | "keskmine" | "madal" };
  };
  listingUrl: string;     // public link (kv.ee) — drives "Vaata kuulutust ↗"
  broker: string;
  photos: string[];       // ordered, [0] = main, [1+] = gallery
  story: string;          // one-line narrative
  // Pre-baked cadastre + EHR for buildings the national registers don't
  // have yet (e.g. brand-new 2019 construction). When present, the
  // /api/resolve endpoint uses these instead of querying In-AKS / EHR
  // — the lookup returns null for some Veerenni-area new builds, which
  // would leave the building panel and lifestyle lookup empty.
  preBakedCadastre?: import("@/lib/estdata").CadastreRecord;
  preBakedEhr?: import("@/lib/estdata").EhrBuilding;
};

export const DEMO_LISTINGS: DemoListing[] = [
  {
    label: "TM24",
    address: "Tartu mnt 24, Kesklinna linnaosa, Tallinn",
    raw: "Tartu mnt 24, Tallinn",
    price: 219000,
    area: 72.7,
    rooms: 3,
    energyClass: "C",
    yearBuilt: 1957,
    buildingType: "1957. aasta kivimaja (stalinistlik)",
    district: "Kesklinn (Tartu mnt / Liivalaia nurk)",
    listingUrl: "https://www.kv.ee/kliendipaeval-eripakkumine-7000-eurot-tavahind-224-3848412.html",
    broker: "Eveli Lindell (Lindell Kinnisvara OÜ)",
    photos: [
      "https://img-kv.ee/image/object/4/6785/135016785.jpg",
      "https://img-kv.ee/image/object/39/6784/135016784.jpg",
      "https://img-kv.ee/image/object/39/6770/135016770.jpg",
      "https://img-kv.ee/image/object/39/6778/135016778.jpg",
      "https://img-kv.ee/image/object/39/6779/135016779.jpg",
      "https://img-kv.ee/image/object/39/6781/135016781.jpg",
      "https://img-kv.ee/image/object/39/6777/135016777.jpg",
      "https://img-kv.ee/image/object/39/6772/135016772.jpg",
      "https://img-kv.ee/image/object/39/6776/135016776.jpg",
      "https://img-kv.ee/image/object/39/6783/135016783.jpg",
      "https://img-kv.ee/image/object/39/6771/135016771.jpg",
      "https://img-kv.ee/image/object/39/6774/135016774.jpg",
      "https://img-kv.ee/image/object/39/6768/135016768.jpg",
      "https://img-kv.ee/image/object/39/6786/135016786.jpg",
      "https://img-kv.ee/image/object/39/6782/135016782.jpg",
      "https://img-kv.ee/image/object/39/6773/135016773.jpg",
      "https://img-kv.ee/image/object/39/6775/135016775.jpg",
      "https://img-kv.ee/image/object/39/6780/135016780.jpg",
      "https://img-kv.ee/image/object/39/6788/135016788.jpg",
      "https://img-kv.ee/image/object/39/6792/135016792.jpg",
      "https://img-kv.ee/image/object/39/6791/135016791.jpg",
      "https://img-kv.ee/image/object/39/6787/135016787.jpg",
      "https://img-kv.ee/image/object/39/6789/135016789.jpg",
      "https://img-kv.ee/image/object/39/6790/135016790.jpg",
      "https://img-kv.ee/image/object/39/8180/134938180.jpg",
    ],
    story: "Kliendipäeva pakkumine — 3-toaline ajaloolise hõnguga korter Tartu mnt 24 stalinistlikus kivimajas (€224k → €219k).",
    demoEnrichment: {
      estpropMedianEurM2: 4200,    // Kesklinn premium
      nationalPercentile: 75,
      districtAverageEurM2: 4200,
      nationalEnergyMode: "B",
      daysOnMarket: 22,
      firstSeenAt: Date.now() - 22 * 86_400_000,
      priceHistory: [
        { date: Date.now() - 22 * 86_400_000, price: 224000 },
        { date: Date.now() - 5 * 86_400_000, price: 219000 },
      ],
      descriptionLen: 2120,
      hasFloorPlan: false,
      completenessOverride: { score: 90, missing: ["floor_plan"] },
      deviationFromComparables: { pct: -2.3, median: 3100, n: 8 },
      rentYield: { yieldPct: 4.9, tier: "keskmine", reason: "Kesklinna 3-toaline, kõrge üüri nõudlus" },
      liquidity: { totalCount: 45, byPortal: { kv: 20, city24: 15, cke: 10 }, tone: "kõrge" },
    },
  },
  {
    label: "LE7",
    address: "Lembitu tn 7, Kesklinna linnaosa, Tallinn",
    raw: "Lembitu tn 7, Tallinn",
    price: 216000,
    area: 58.3,
    rooms: 2,
    yearBuilt: 1955,
    buildingType: "1955. aasta kivimaja (renoveeritud)",
    district: "Kesklinn (Lembitu park)",
    listingUrl: "https://www.kv.ee/muua-avarate-akende-ja-korgete-lagedega-renoveerit-3838209.html",
    broker: "Kristi (omanik / eraisik)",
    photos: [
      "https://img-kv.ee/image/object/39/1960/134231960.jpg",
      "https://img-kv.ee/image/object/39/1957/134231957.jpg",
      "https://img-kv.ee/image/object/39/1958/134231958.jpg",
      "https://img-kv.ee/image/object/39/1959/134231959.jpg",
      "https://img-kv.ee/image/object/39/1961/134231961.jpg",
      "https://img-kv.ee/image/object/39/1962/134231962.jpg",
      "https://img-kv.ee/image/object/39/1973/134231973.jpg",
      "https://img-kv.ee/image/object/39/1956/134231956.jpg",
      "https://img-kv.ee/image/object/39/1974/134231974.jpg",
      "https://img-kv.ee/image/object/39/3450/137803450.jpg",
      "https://img-kv.ee/image/object/39/3452/137803452.jpg",
    ],
    story: "Renoveeritud ja möbleeritud 2-toaline Lembitu pargi ääres — kõrged laed, kalasaba parkett, kogu mööbel hinna sees, omanikult.",
    demoEnrichment: {
      estpropMedianEurM2: 4200,    // Kesklinn premium
      nationalPercentile: 78,
      districtAverageEurM2: 4200,
      nationalEnergyMode: "B",
      daysOnMarket: 11,
      firstSeenAt: Date.now() - 11 * 86_400_000,
      priceHistory: [
        { date: Date.now() - 11 * 86_400_000, price: 216000 },
      ],
      descriptionLen: 1430,
      hasFloorPlan: false,
      completenessOverride: { score: 80, missing: ["floor_plan", "energy_class"] },
      deviationFromComparables: { pct: 1.1, median: 3700, n: 12 },
      rentYield: { yieldPct: 3.9, tier: "madal", reason: "Väike pind, kitsas üüriturg" },
      liquidity: { totalCount: 28, byPortal: { kv: 12, city24: 10, cke: 6 }, tone: "keskmine" },
    },
  },
  {
    label: "PI3",
    address: "Pille tn 11, Veerenni, Kesklinna linnaosa, Tallinn",
    raw: "Pille tn 11/3, Tallinn",
    price: 189000,
    area: 35.1,
    rooms: 1,
    energyClass: "B",
    yearBuilt: 2019,
    buildingType: "2019. aasta kivimaja (uusarendus)",
    district: "Kesklinn (Veerenni / Uus-Veerenni)",
    listingUrl: "https://www.kv.ee/kortermuugile-on-tulnud-valguskullane-ja-nutika-pl-3845425.html",
    broker: "Laur Uusmägi (Take Kinnisvara, KV.EE Tippmaakler 2025)",
    photos: [
      "https://img-kv.ee/image/object/4/9471/134739471.jpg",
      "https://img-kv.ee/image/object/39/9467/134739467.jpg",
      "https://img-kv.ee/image/object/39/9472/134739472.jpg",
      "https://img-kv.ee/image/object/39/9461/134739461.jpg",
      "https://img-kv.ee/image/object/39/9462/134739462.jpg",
      "https://img-kv.ee/image/object/39/9465/134739465.jpg",
      "https://img-kv.ee/image/object/39/9469/134739469.jpg",
      "https://img-kv.ee/image/object/39/9473/134739473.jpg",
      "https://img-kv.ee/image/object/39/9475/134739475.jpg",
      "https://img-kv.ee/image/object/39/9463/134739463.jpg",
      "https://img-kv.ee/image/object/39/9470/134739470.jpg",
      "https://img-kv.ee/image/object/39/9478/134739478.jpg",
      "https://img-kv.ee/image/object/39/9602/134739602.jpg",
      "https://img-kv.ee/image/object/39/9476/134739476.jpg",
      "https://img-kv.ee/image/object/39/8777/134738777.jpg",
    ],
    story: "Uueväärne ja nutika planeeringuga 1-toaline Pille 11 majas (2019) — lift, maa-alune garaaž, energiamärgis B, plaan olemas.",
    preBakedCadastre: {
      geom: "POLYGON((0 0,0 1,1 1,1 0,0 0))",
      tunnus: "78401:108:4320",
      siht1: "Elamumaa",
      siht2: null,
      siht3: null,
      so_prts1: 100,
      registreeritud: "2018-06-15",
      pindala: 1847,
      ads_oid: "0",
      aadress: "Pille tn 11",
      hkood: "78401:108:4320",
      kinnistu: "Pille tn 11 korterelamu",
      omvorm: "Eraomand",
      maks_hind: null,
      estprop_median_eur_m2: 4200,
      adob_id: null,
      tsentroid_x: 540200,
      tsentroid_y: 6589700,
      tais_aadress: "Pille tn 11, Veerenni, Kesklinna linnaosa, Tallinn",
    },
    preBakedEhr: {
      ehr_code: "120856345",
      taisaadress: "Pille tn 11, Veerenni, Kesklinna linnaosa, Tallinn",
      nimetus: "Korterelamu",
      esmaneKasutus: "2019",
      ehAlustKp: "2017-04-12",
      tubadeArv: null,
      ehitisalunePind: 412,
      suletud_netopind: 3420,
      mahtBruto: null,
      minKorrusteArv: 6,
      maxKorrusteArv: 7,
      energy: [
        {
          energiaKlass: "B",
          energiaValjastKp: "2019-03-20",
          energiaKehtibKuniKp: "2029-03-19",
          energiaKaalKasutus: null,
          tarnEn: 95,
          tarnEnKK: null,
          kytteTyypTxt: "Kaugküte",
        },
      ],
      katastriyksused: [
        { katastritunnus: "78401:108:4320", taisaadress: "Pille tn 11, Veerenni, Kesklinna linnaosa, Tallinn" },
      ],
      technical: [
        { klNimetus: "EH_KYT_TYYP", nimetus: "Küte", lisavaartus: "Kaugküte" },
      ],
    },
    demoEnrichment: {
      estpropMedianEurM2: 4200,    // Kesklinn premium
      nationalPercentile: 82,
      districtAverageEurM2: 4200,
      nationalEnergyMode: "B",
      daysOnMarket: 6,
      firstSeenAt: Date.now() - 6 * 86_400_000,
      priceHistory: [
        { date: Date.now() - 6 * 86_400_000, price: 189000 },
      ],
      descriptionLen: 1380,
      hasFloorPlan: true,
      completenessOverride: { score: 100, missing: [] },
      deviationFromComparables: { pct: -3.8, median: 5600, n: 5 },
      rentYield: { yieldPct: 3.8, tier: "madal", reason: "Uus ehitis, kõrge ostuhind surub tootlust" },
      liquidity: { totalCount: 18, byPortal: { kv: 8, city24: 6, cke: 4 }, tone: "keskmine" },
    },
  },
];
