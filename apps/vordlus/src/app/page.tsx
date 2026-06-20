"use client";

import { useEffect, useMemo, useState } from "react";
import FilterSidebar, { type Filters } from "@/components/FilterSidebar";
import CompareSlot from "@/components/CompareSlot";
import CompareColumnView from "@/components/CompareColumnView";
import { ComparisonTable } from "@/components/ComparisonTable";
import {
  decodeShareUrl,
  encodeShareUrl,
  defaultScores,
  loadCompare,
  makeId,
  saveCompare,
  type CompareColumn,
} from "@/lib/compareStore";
import { DEMO_LISTINGS } from "@/lib/demoData";
import { computeScores } from "@/lib/scores";
import { EMPTY_LIFESTYLE } from "@/lib/lifestyle";
import dynamic from "next/dynamic";

const PropertyMap = dynamic(() => import("@/components/PropertyMap"), {
  ssr: false,
});

const MAX_SLOTS = 5;

type ResolveResponse = {
  input: { raw: string; kind: string };
  picked: { viitepunkt_l: number; viitepunkt_b: number; pikkaadress: string } | null;
  cadastre: { pindala: number; tunnus: string } | null;
  ehr: { ehr_code: string; esmaneKasutus: string | null; energy: { energiaKlass: string | null }[] } | null;
  lifestyle?: { park: { stars: number; label: string; count: number }; school: { stars: number; label: string; count: number }; gym: { stars: number; label: string; count: number }; transit: { stars: number; label: string; count: number }; shop: { stars: number; label: string; count: number }; cafe: { stars: number; label: string; count: number }; restaurant: { stars: number; label: string; count: number } };
  transit?: { stopCount: number; frequency: number } | null;
  radon?: { class: "madal" | "keskmine" | "korge" } | null;
  flood?: { zone: "ei_ole_ohualas" | "100a_ohualas" | "1000a_ohualas" } | null;
  planeeringud?: { name: string; maxFloors: number }[] | null;
  listingPhoto?: string | null;
  errors: string[];
};

export default function Home() {
  const [columns, setColumns] = useState<CompareColumn[]>([]);
  const [filters, setFilters] = useState<Filters>({});
  const [ready, setReady] = useState(false);

  // Load from localStorage + URL share
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const shared = params.get("c");
      if (shared) {
      const inputs = decodeShareUrl(shared);
      if (inputs.length > 0) {
        const initial: CompareColumn[] = inputs.slice(0, MAX_SLOTS).map((s) => ({
          id: makeId(),
          input: {
            raw: s.raw,
            manualPrice: s.price ?? null,
            manualArea: s.area ?? null,
            manualRooms: s.rooms ?? null,
            manualListingPhoto: s.listingPhoto ?? null,
            manualListingUrl: s.listingUrl ?? null,
            manualEnergyClass: s.energyClass ?? null,
          },
          cadastre: null,
          ehr: null,
          lifestyle: EMPTY_LIFESTYLE,
          transit: null,
          radon: null,
          flood: null,
          planeeringud: null,
          listingPhoto: s.listingPhoto ?? null,
          enrichment: null,
          scores: defaultScores(),
          fetchedAt: 0,
          errors: [],
        }));
        setColumns(initial);
        setReady(true);
        // Strip ?c= from the URL so reloads don't re-fetch the share.
        // Then kick off resolveSlot for each loaded input so the
        // recipient gets the same public data (EHR, lifestyle, etc.)
        // that the sender had.
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete("c");
          window.history.replaceState({}, "", clean.toString());
        } catch {}
        for (const col of initial) {
          void resolveSlot(col.input.raw, {
            price: col.input.manualPrice ?? undefined,
            area: col.input.manualArea ?? undefined,
            rooms: col.input.manualRooms ?? undefined,
            listingPhoto: col.input.manualListingPhoto ?? undefined,
            listingUrl: col.input.manualListingUrl ?? undefined,
            ehrEnergyClass: col.input.manualEnergyClass ?? undefined,
          });
        }
        return;
      }
    }
    setColumns(loadCompare());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveCompare(columns);
  }, [columns, ready]);

  // Price per m² helper — only from manualPrice + manualArea
  const pricePerM2Of = (col: CompareColumn): number | null => {
    if (col.input.manualPrice != null && col.input.manualArea != null && col.input.manualArea > 0) {
      return col.input.manualPrice / col.input.manualArea;
    }
    return null;
  };

  // Filtered set — pre-compute price/area for filtering
  const filtered = useMemo(() => {
    return columns.filter((col) => {
      const c = col.cadastre;
      const e = col.ehr;
      // For filtering we want the user's input if available, otherwise
      // building-level data (single-unit only).
      const nimetus = e?.nimetus?.toLowerCase() ?? "";
      const isMulti = nimetus.includes("korterelamu") || nimetus.includes("korter");
      const price = col.input.manualPrice ?? null;
      const area = col.input.manualArea ?? (isMulti ? null : e?.suletud_netopind ?? null);
      const rooms = col.input.manualRooms ?? (isMulti ? null : e?.tubadeArv ?? null);
      const energy = e?.energy[0]?.energiaKlass ?? null;
      if (filters.priceMin != null && price != null && price < filters.priceMin) return false;
      if (filters.priceMax != null && price != null && price > filters.priceMax) return false;
      if (filters.areaMin != null && area != null && area < filters.areaMin) return false;
      if (filters.areaMax != null && area != null && area > filters.areaMax) return false;
      if (filters.roomsMin != null && rooms != null && rooms < filters.roomsMin) return false;
      if (filters.energy?.length) {
        if (!energy || !filters.energy.includes(energy)) return false;
      }
      if (filters.minOverall && col.scores.overall > 0) {
        if (col.scores.overall < filters.minOverall) return false;
      }
      if (filters.greenMortgageOnly && col.scores.greenMortgage.score < 4) return false;
      if (filters.minParkStars != null && filters.minParkStars > 0 && col.lifestyle.park.stars < filters.minParkStars) return false;
      if (filters.minSchoolStars != null && filters.minSchoolStars > 0 && col.lifestyle.school.stars < filters.minSchoolStars) return false;
      if (filters.minTransitStars != null && filters.minTransitStars > 0 && col.lifestyle.transit.stars < filters.minTransitStars) return false;
      return true;
    });
  }, [columns, filters]);

  // Batch median €/m² for Fair Value scoring
  const medianPriceM2 = useMemo(() => {
    const pps: number[] = [];
    for (const col of filtered) {
      const v = pricePerM2Of(col);
      if (v != null) pps.push(v);
    }
    if (pps.length === 0) return null;
    pps.sort((a, b) => a - b);
    return pps[Math.floor(pps.length / 2)];
  }, [filtered]);

  // Augment each filtered column with live scores that depend on the
  // batch median. The stored `scores` is the fallback (no median).
  const filteredWithScores = useMemo(() => {
    return filtered.map((col) => {
      const liveScores = computeScores({
        c: col.cadastre,
        e: col.ehr,
        lifestyle: col.lifestyle,
        marketMedian: medianPriceM2,
        pricePerM2Override: pricePerM2Of(col),
        unitArea: col.input.manualArea ?? null,
      });
      return { ...col, scores: liveScores };
    });
  }, [filtered, medianPriceM2]);

  async function resolveSlot(
    raw: string,
    manual?: {
      price?: number | null; area?: number | null; rooms?: number | null;
      listingPhoto?: string | null; listingUrl?: string | null;
      prePopulatedEnrichment?: CompareColumn["enrichment"];
      // Demo-specific: override energy class on the EHR. Useful when the
      // real EHR has no energy certificate (older buildings) but we
      // know it from the listing. Without this, TCO and Rohelaen scores
      // would show "andmed puuduvad".
      ehrEnergyClass?: string | null;
    },
  ): Promise<{ ok: boolean; error?: string }> {
    if (!raw.trim()) return { ok: false, error: "Sisesta aadress või ID" };
    try {
      const r = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw, manual }),
      });
      if (!r.ok) return { ok: false, error: `Server viga: ${r.status}` };
      const j: ResolveResponse = await r.json();
      const cad = (j.cadastre as CompareColumn["cadastre"]) ?? null;
      let e = (j.ehr as CompareColumn["ehr"]) ?? null;
      // Demo override: patch the energy class if the EHR has none but
      // the caller (demo button) supplied one from the listing.
      if (manual?.ehrEnergyClass && (!e?.energy?.[0]?.energiaKlass)) {
        const patchedEnergy = {
          energiaKlass: manual.ehrEnergyClass,
          energiaValjastKp: null,
          energiaKehtibKuniKp: null,
          energiaKaalKasutus: null,
          tarnEn: null,
          tarnEnKK: null,
          // kytteTyypTxt is needed for green mortgage scoring. Default to
          // "Kaugküte" (district heating) — Estonia's most common heating
          // type for 1950s–1990s korterelamu.
          kytteTyypTxt: e?.energy?.[0]?.kytteTyypTxt ?? "Kaugküte",
        };
        e = e ? { ...e, energy: [patchedEnergy, ...(e.energy?.slice(1) ?? [])] } : null;
      }
      const lifestyle = (j.lifestyle as CompareColumn["lifestyle"]) ?? EMPTY_LIFESTYLE;
      const newCol: CompareColumn = {
        id: makeId(),
        input: {
          raw,
          manualPrice: manual?.price ?? null,
          manualArea: manual?.area ?? null,
          manualRooms: manual?.rooms ?? null,
          manualListingPhoto: manual?.listingPhoto ?? null,
          manualListingUrl: manual?.listingUrl ?? null,
        },
        cadastre: cad,
        ehr: e,
        lifestyle,
        transit: j.transit ?? null,
        radon: j.radon ?? null,
        flood: j.flood ?? null,
        planeeringud: j.planeeringud ?? null,
        // For the hackathon demo we accept a pre-baked listing photo
        // (real kv.ee CDN URL) so the Monogram shows the real image.
        // Otherwise fall back to whatever /api/resolve produced.
        listingPhoto: manual?.listingPhoto ?? j.listingPhoto ?? null,
        // Demo listings pass pre-computed enrichment (price/m², district
        // benchmark, renovation, energy comparison) so the panel shows
        // real data immediately. /api/enrich runs in the background and
        // may overwrite with live scrape data once the Coolify service
        // is deployed.
        enrichment: manual?.prePopulatedEnrichment ?? null,
        // Stored scores are best-effort (no median yet)
        scores: computeScores({
          c: cad,
          e,
          lifestyle,
          marketMedian: null,
          pricePerM2Override: null,
          unitArea: manual?.area ?? null,
        }),
        fetchedAt: Date.now(),
        errors: j.errors,
      };
      setColumns((prev) => {
        const idx = prev.findIndex((c) => c.input.raw === raw);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = newCol;
          return next.slice(0, MAX_SLOTS);
        }
        return [...prev, newCol].slice(0, MAX_SLOTS);
      });
      // Fire-and-forget enrichment fetch
      void fetchEnrichmentFor(newCol);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  }

  function updateSlot(index: number, col: CompareColumn | null) {
    setColumns((prev) => {
      const next = [...prev];
      if (col) next[index] = col;
      else next.splice(index, 1);
      return next;
    });
  }

  async function fetchEnrichmentFor(col: CompareColumn) {
    const addressDisplay = col.cadastre?.tais_aadress || col.ehr?.taisaadress || col.input.raw;
    const addressNorm = addressDisplay
      .toLowerCase()
      .replace(/[^a-z0-9õöäü]+/g, "-")
      .replace(/^-|-$/g, "");
    const buildYear = col.ehr?.esmaneKasutus ? parseInt(col.ehr.esmaneKasutus, 10) : null;
    const energyClass = col.ehr?.energy?.[0]?.energiaKlass ?? null;
    try {
      const r = await fetch("/api/enrich", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          raw: col.input.raw,
          addressDisplay,
          addressNorm,
          wgs84: null,
          manualPrice: col.input.manualPrice,
          manualArea: col.input.manualArea,
          manualRooms: col.input.manualRooms,
          energyClass,
          buildYear,
          estpropMedian: col.cadastre?.estprop_median_eur_m2 ?? null,
        }),
      });
      if (!r.ok) return;
      const j = await r.json();
      // Merge: keep any pre-populated demo fields, only fill in nulls
      // with whatever the live API returns. The Coolify scrape service
      // may be down, in which case j.data has nulls for priceHistory,
      // daysOnMarket, etc. — but the demo pre-populated values for
      // pricePerM2, districtBenchmark, renovation must survive.
      setColumns((prev) =>
        prev.map((c) => {
          if (c.id !== col.id) return c;
          const live = j.data ?? {};
          const base: CompareColumn["enrichment"] = c.enrichment ?? {
            pricePerM2: null,
            deviationFromComparables: null,
            priceHistory: null,
            daysOnMarket: null,
            duplicates: null,
            completeness: null,
            districtBenchmark: null,
            energyComparison: null,
            renovation: null,
            rentYield: null,
            liquidity: null,
          };
          return {
            ...c,
            enrichment: {
              pricePerM2: base.pricePerM2 ?? live.pricePerM2 ?? null,
              deviationFromComparables: base.deviationFromComparables ?? live.deviationFromComparables ?? null,
              priceHistory: base.priceHistory ?? live.priceHistory ?? null,
              daysOnMarket: base.daysOnMarket ?? live.daysOnMarket ?? null,
              duplicates: base.duplicates ?? live.duplicates ?? null,
              completeness: base.completeness ?? live.completeness ?? null,
              districtBenchmark: base.districtBenchmark ?? live.districtBenchmark ?? null,
              energyComparison: base.energyComparison ?? live.energyComparison ?? null,
              renovation: base.renovation ?? live.renovation ?? null,
              rentYield: base.rentYield ?? live.rentYield ?? null,
              liquidity: base.liquidity ?? live.liquidity ?? null,
            },
          };
        }),
      );
    } catch {
      /* swallow — enrichment is best-effort */
    }
  }

  // Build a pre-populated EnrichmentData object from a DemoListing. Used
  // by the "Lae 3 näidet" button so the enrichment panel shows real
  // values immediately, without waiting for the Coolify scrape service
  // to come online. /api/enrich will still fire in the background and
  // fill in the remaining scrape-dependent blocks (rent yield, liquidity,
  // deviation from comparables) once the service is up.
  function buildDemoEnrichment(ex: typeof DEMO_LISTINGS[number]): CompareColumn["enrichment"] {
    const d = ex.demoEnrichment;
    const pricePerM2 = Math.round(ex.price / ex.area);
    // Days-on-market with the same roheline/kollane/punane bins as live.
    const domTone = d?.daysOnMarket == null
      ? "puudub"
      : d.daysOnMarket < 30 ? "roheline" : d.daysOnMarket <= 90 ? "kollane" : "punane";
    return {
      pricePerM2,
      // 1. Price per m² — always populated
      // 2. District benchmark — pre-baked from the demo
      districtBenchmark: d?.estpropMedianEurM2 != null
        ? {
            districtMedian: d.estpropMedianEurM2,
            districtName: ex.district,
            nationalPercentile: d.nationalPercentile ?? 50,
          }
        : null,
      // 3. Price history — pre-baked (verified dates/prices)
      priceHistory: d?.priceHistory ?? null,
      // 4. Days on market — pre-baked
      daysOnMarket: d?.daysOnMarket != null
        ? { days: d.daysOnMarket, tone: domTone as "roheline" | "kollane" | "punane" | "puudub" }
        : null,
      // 5. Duplicates — none in the demo set (all 3 are different addresses)
      duplicates: [],
      // 6. Listing completeness — pre-baked override
      completeness: d?.completenessOverride
        ?? (ex.photos.length > 0
              ? { score: Math.min(100, 25 + (ex.photos.length >= 5 ? 25 : 12) + 10 + 10 + 10 + 5 + 5), missing: ex.photos.length < 5 ? ["photos"] : [] }
              : null),
      // 7. Renovation verdict — computed from yearBuilt + energyClass
      renovation: (() => {
        if (ex.yearBuilt == null && !ex.energyClass) return { label: "Andmed puuduvad", signals: [] };
        const eff = ["A", "B", "C"].includes(ex.energyClass ?? "");
        const ineff = ["F", "G", "H"].includes(ex.energyClass ?? "");
        let label = "";
        const signals: string[] = [];
        if (ex.yearBuilt != null && ex.yearBuilt < 1980) {
          label = eff
            ? "Renoveeritud (energia­märgis A-C, ehitatud enne 1980)"
            : "Algne, ei viita renoveerimisele";
        } else if (ex.yearBuilt != null && ex.yearBuilt < 2000) {
          label = eff ? "Renoveeritud 90ndate hoone" : "Keskmine vanus, energiamärgis viitab renoveerimisvajadusele";
        } else if (ex.yearBuilt != null) {
          label = eff ? "Kaasaegne, energiatõhus" : ineff ? "Kaasaegne, kuid energiakulukas" : "Kaasaegne";
        }
        if (ex.energyClass && ["A", "B"].includes(ex.energyClass)) signals.push("Energiamärgis A/B");
        if (ex.yearBuilt != null && ex.yearBuilt >= 2010) signals.push("Uus ehitis");
        if (ex.yearBuilt != null && ex.yearBuilt < 1960) signals.push("Ajalooline hoone");
        return { label: label || "Andmed puuduvad", signals };
      })(),
      // 8. Energy class comparison
      energyComparison: ex.energyClass
        ? { thisClass: ex.energyClass, districtMode: d?.districtAverageEurM2 ? "C" : null, nationalMode: d?.nationalEnergyMode ?? "C" }
        : null,
      // 9. Deviation from comparables — needs /scrape/search
      deviationFromComparables: null,
      // 10. Rent vs sale yield — needs /scrape/search?type=rent
      rentYield: null,
      // 11. Liquidity — needs /scrape/search
      liquidity: null,
    };
  }

  function removeColumn(id: string) {
    setColumns((prev) => prev.filter((c) => c.id !== id));
  }

  function clearAll() {
    if (!confirm("Eemaldada kõik võrdlused?")) return;
    setColumns([]);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("c");
      window.history.replaceState({}, "", url.toString());
    }
  }

  async function shareUrl() {
    const b64 = encodeShareUrl(columns);
    if (!b64) return;
    const url = new URL(window.location.href);
    url.searchParams.set("c", b64);
    await navigator.clipboard.writeText(url.toString());
    alert("Link kopeeritud!");
  }

  // Add a column by replacing the empty slot when user clicks a slot button.
  function setColumnAt(idx: number, col: CompareColumn) {
    setColumns((prev) => {
      const next = [...prev];
      next[idx] = col;
      return next;
    });
  }

  return (
    <>
      {/* ============== TOP BAR ============== */}
      <header className="border-b border-rule bg-paper sticky top-0 z-30">
        <div className="max-w-compare mx-auto px-5 sm:px-8 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5">
            <span aria-hidden="true" className="grid place-items-center w-7 h-7 bg-ink text-paper font-display text-[19px] leading-none">
              v
            </span>
            <span className="font-display text-[20px] text-ink tracking-tight">võrdlus</span>
            <span className="hidden sm:inline text-[12px] text-muted ml-2">· Kinnisvara võrdlus</span>
          </a>
          <nav className="flex items-center gap-5 text-[13px] text-ink">
            <button
              onClick={shareUrl}
              disabled={columns.length === 0}
              className="hidden sm:flex items-center gap-1.5 hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" />
              </svg>
              Jaga
            </button>
            <button
              onClick={clearAll}
              disabled={columns.length === 0}
              className="flex items-center gap-1.5 hover:text-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
              Tühjenda
            </button>
          </nav>
        </div>
      </header>

      {/* ============== MASTHEAD ============== */}
      <section className="border-b border-rule">
        <div className="max-w-compare mx-auto px-5 sm:px-8 py-10 sm:py-14">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Kinnisvara võrdlus</p>
          <h1 className="display mt-3 text-ink text-balance max-w-[44ch]">
            Võrdle kuni viit kinnisvaraobjekti
            <span className="text-faint"> kõrvuti.</span>
          </h1>
          <p className="mt-4 text-muted max-w-prose text-[15px]">
            Sisesta kuni viis aadressi, kv.ee linki või katastri numbrit. Meie koostame
            kinnistu, ehitise ja energiamärgise andmed kõrvuti ning anname viis skoori:
            Fair Value (hind vs turu mediaan), TCO (elamiskulud), Appreciation
            (tuleviku väärtus), Elustiil (naabruskond) ja Rohelaen (rohelaenu sobivus).
          </p>
        </div>
      </section>

      {/* ============== GRID ============== */}
      <section className="max-w-compare mx-auto px-5 sm:px-8 py-8 lg:py-12">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
          <FilterSidebar
            filters={filters}
            onChange={setFilters}
            matchCount={filteredWithScores.length}
            totalCount={columns.length}
          />

          <div className="flex-1 min-w-0 w-full">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
              {Array.from({ length: MAX_SLOTS }).map((_, i) => (
                <CompareSlot
                  key={i}
                  index={i}
                  column={columns[i] ?? null}
                  onChange={(c) => updateSlot(i, c)}
                  onResolve={resolveSlot}
                />
              ))}
            </div>

            {filteredWithScores.length === 0 ? (
              <EmptyState onTryExample={async () => {
                // Three real, hand-picked Tallinn listings with verified
                // kv.ee CDN photos. The story: 3 distinct building types,
                // 3 districts, 3 price points — shows the comparison axis
                // doing real work. See src/lib/demoData.ts for sources.
                for (const ex of DEMO_LISTINGS) {
                  await resolveSlot(ex.raw, {
                    price: ex.price,
                    area: ex.area,
                    rooms: ex.rooms,
                    listingPhoto: ex.photos[0] ?? null,
                    listingUrl: ex.listingUrl,
                    prePopulatedEnrichment: buildDemoEnrichment(ex),
                    ehrEnergyClass: ex.energyClass ?? null,
                  });
                }
              }} />
            ) : (
              <>
                <div className="flex items-baseline justify-between mb-4">
                  <h2 className="display-tight text-[22px] text-ink">
                    Võrdlus · <span className="text-faint">{filteredWithScores.length} objekti</span>
                  </h2>
                  {medianPriceM2 != null && (
                    <p className="text-[11px] text-muted hidden sm:block">
                      Turu mediaan: <span className="text-ink font-mono">€{Math.round(medianPriceM2).toLocaleString("et-EE")}</span> / m²
                    </p>
                  )}
                </div>
                <div className="overflow-x-auto no-scrollbar -mx-5 sm:-mx-8 px-5 sm:px-8 pb-2">
                  <div
                    className="grid gap-3"
                    style={{ gridTemplateColumns: `repeat(${filteredWithScores.length}, minmax(240px, 1fr))` }}
                  >
                    {filteredWithScores.map((col, i) => (
                      <CompareColumnView
                        key={col.id}
                        column={col}
                        index={i}
                        medianPriceM2={medianPriceM2}
                        onRemove={() => removeColumn(col.id)}
                      />
                    ))}
                  </div>
                </div>
               <ComparisonTable columns={filteredWithScores} />

<div className="mt-8">
  <PropertyMap />
</div>

</>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-rule mt-12">
        <div className="max-w-compare mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-baseline gap-2 justify-between text-[12px] text-muted">
          <p>
            <span className="font-display text-ink">võrdlus</span> · Ehitatud vabade Eesti
            avalike andmete peale (In-AKS, Maa-amet X-tee, Ehitisregister, OpenStreetMap). Mitte
            õigus- ega finantsnõustamine.
          </p>
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-faint">v2.0 · 2026</p>
        </div>
      </footer>
    </>
  );
}

function EmptyState({ onTryExample }: { onTryExample: () => void }) {
  return (
    <div className="rounded-lg border border-rule bg-white p-8 sm:p-12 text-center">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">Alusta võrdlust</p>
      <h3 className="display mt-2 text-[28px] text-ink max-w-prose mx-auto">
        Sisesta esimene aadress või klõpsa näidet.
      </h3>
      <p className="mt-3 text-muted max-w-prose mx-auto text-[14.5px]">
        Iga objekt saab viis skoori: <strong>Fair Value</strong> (hind vs turu mediaan),
        <strong> Elamiskulud</strong> (igakuised kulud küte + elekter), <strong>Väärtuse kasv</strong> (tuleviku väärtus),
        <strong> Elustiil</strong> (park, kool, transport 1 km raadiuses) ja
        <strong> Rohelaen</strong> (rohelaenu sobivus 4+).
      </p>
      <button
        onClick={onTryExample}
        className="mt-6 bg-ink text-paper text-[12px] font-semibold tracking-wider uppercase
                   px-5 py-3 hover:bg-ink/85 transition-colors"
      >
        Lae 3 näidet (Tallinn)
      </button>
      <p className="mt-4 text-[11.5px] text-faint">
        Või kleebi oma kv.ee / city24.ee link — meie otsime aadressi URL-ist ja
        In-AKS-ist.
      </p>
    </div>
  );
}
