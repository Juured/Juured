"use client";

import { type CompareColumn } from "@/lib/compareStore";
import { SCORE_LABELS, type ScoreKey } from "@/lib/scores";
import { ageOf, fmtM2, fmtMoney, fmtYear } from "@/lib/estdata";
import { LifestyleMatrix } from "@/components/LifestyleMatrix";
import { AvmBar } from "@/components/AvmBar";
import { Monogram } from "@/components/Monogram";
import { RiskBadges } from "@/components/RiskBadges";
import { PlaneeringuRadar } from "@/components/PlaneeringuRadar";
import { EnrichmentPanel } from "@/components/EnrichmentPanel";

const Icon = ({ d, size = 14 }: { d: string; size?: number }) => (
  <svg
    className="inline-block align-[-2px] mr-1 text-current"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    aria-hidden="true"
  >
    <path d={d} />
  </svg>
);
const IconDoor = <Icon d="M3 22h18M5 22V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v18M14 12h.01" />;
const IconRuler = <Icon d="M21 16V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2zM7 10h.01M11 10h.01M15 10h.01M7 14h.01M11 14h.01M15 14h.01" />;
const IconSun = <Icon d="M12 3v1M12 20v1M3 12h1M20 12h1M5.6 5.6l.7.7M17.7 17.7l.7.7M5.6 18.4l.7-.7M17.7 6.3l.7-.7M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />;

function PhotoFor({ id, address, buildingType, index, overall, overallLabel, listingPhoto, onRemove }: {
  id: string;
  address: string;
  buildingType: string | null | undefined;
  index: number;
  overall: number;
  overallLabel: string;
  listingPhoto?: string | null;
  onRemove: () => void;
}) {
  return (
    <Monogram
      address={address}
      buildingType={buildingType}
      index={index}
      overallScore={overall}
      overallLabel={overallLabel}
      listingPhoto={listingPhoto}
      onClose={onRemove}
    />
  );
}

function EnergyPill({ k }: { k: string | null }) {
  if (!k) return <span className="text-muted">—</span>;
  const good = ["A", "B", "C"].includes(k);
  return (
    <span
      className={`inline-block min-w-[24px] text-center text-[11px] font-bold uppercase px-1.5 py-0.5 rounded-sm
                     ${good ? "bg-energyA text-white" : k === "D" || k === "E" ? "bg-energyC text-white" : "bg-ink text-paper"}`}
    >
      {k}
    </span>
  );
}

function Stars({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <span className="inline-flex gap-px">
      {Array.from({ length: max }).map((_, i) => (
        <svg
          key={i}
          className={`w-3 h-3 ${i < value ? "text-ink" : "text-rule2"}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M10 1l2.5 6 6.5.6-5 4.5 1.5 6.4L10 15l-5.5 3.5L6 12 1 7.6 7.5 7z" />
        </svg>
      ))}
    </span>
  );
}

type Props = {
  column: CompareColumn;
  index: number;
  medianPriceM2: number | null;
  onRemove: () => void;
};

export default function CompareColumnView({ column, index, medianPriceM2, onRemove }: Props) {
  const c = column.cadastre;
  const e = column.ehr;
  const addr = c?.tais_aadress || e?.taisaadress || column.input.raw;
  const county = (addr?.match(/,\s*([A-ZÜÖÄÕ][^,]*maakond)/) || [])[1] ?? "";
  const city = (addr?.match(/,\s*([^,]+linn(?:osa)?)/) || [])[1] ?? "";

  // ── Building type detection ───────────────────────────────────────
  // EHR kasutusotstarve (ehitiseKasutusotstarbed.kasutusotstarve.kaosIdTxt)
  // is the most reliable signal. üksikelamu/büroohoone/etc.
  const nimetus = e?.nimetus?.toLowerCase() ?? "";
  const isSingleUnit =
    nimetus.includes("üksikelamu") ||
    nimetus.includes("elamu") && !nimetus.includes("korter") ||
    nimetus.includes("büroohoone") ||
    nimetus.includes("ärihoone") ||
    nimetus.includes("tootmis") ||
    nimetus.includes("laohoone") ||
    nimetus.includes("suvila");
  const isMultiUnit =
    nimetus.includes("korterelamu") ||
    nimetus.includes("korter") ||
    nimetus.includes("elamu") && nimetus.includes("mitme") ||
    (e?.tubadeArv != null && e.tubadeArv > 5);
  // If the building has many rooms AND has apartment-level keywords, treat as
  // multi-unit. Fall back to "single" if ambiguous.
  const unitKind: "single" | "multi" | "unknown" = isMultiUnit
    ? "multi"
    : isSingleUnit
      ? "single"
      : "unknown";

  // ── Price: ONLY user-entered. NEVER fall back to maks_hind (that's the
  //    2022 Maa-amet tax assessment, not the listing price).
  const price = column.input.manualPrice ?? null;

  // ── Area: prefer manual; otherwise use building's net area only if
  //    it's plausibly the user's unit (single family or small building).
  const hasManualArea = column.input.manualArea != null;
  const areaM2 = hasManualArea
    ? column.input.manualArea
    : unitKind === "multi"
      ? null
      : e?.suletud_netopind ?? null;

  // ── Rooms: prefer manual; otherwise use building's room count only for
  //    single-unit or small buildings. Hide for apartment buildings.
  const hasManualRooms = column.input.manualRooms != null;
  const rooms = hasManualRooms
    ? column.input.manualRooms
    : unitKind === "multi"
      ? null
      : e?.tubadeArv ?? null;

  const terraceM2 = null; // not derivable from public APIs

  const pricePerM2 = price != null && areaM2 ? Math.round(price / areaM2) : null;
  const diffVsMedian =
    pricePerM2 != null && medianPriceM2 != null && medianPriceM2 > 0
      ? (pricePerM2 - medianPriceM2) / medianPriceM2
      : null;
  const priceColor =
    diffVsMedian == null
      ? undefined
      : diffVsMedian > 0.05
        ? "#9A1B1B"
        : diffVsMedian < -0.05
          ? "#166534"
          : undefined;

  // Whether the user still owes us data
  const needsManual = price == null || (!hasManualArea && unitKind !== "single");

  // Build the 5 scores
  const { fairValue, tco, appreciation, lifestyle, greenMortgage, overall, overallLabel } = column.scores;
  const scoreRows: { key: ScoreKey; value: number; reason: string; tone: "good" | "warn" | "bad" | "neutral" }[] = [
    { key: "fairValue", value: fairValue.score, reason: fairValue.reason, tone: fairValue.score >= 4 ? "good" : fairValue.score <= 2 ? "bad" : "neutral" },
    { key: "tco", value: tco.score, reason: tco.reason, tone: tco.score >= 4 ? "good" : tco.score <= 2 ? "bad" : "neutral" },
    { key: "appreciation", value: appreciation.score, reason: appreciation.reason, tone: appreciation.score >= 4 ? "good" : appreciation.score <= 2 ? "bad" : "neutral" },
    { key: "lifestyle", value: lifestyle.score, reason: lifestyle.reason, tone: lifestyle.score >= 4 ? "good" : lifestyle.score <= 2 ? "bad" : "neutral" },
    { key: "greenMortgage", value: greenMortgage.score, reason: greenMortgage.reason, tone: greenMortgage.tone },
  ];

  return (
    <div className="bg-white border border-rule overflow-hidden flex flex-col">
      {/* Monogram (typographic identity for the property) */}
      <div className="relative">
        <PhotoFor
          id={column.id}
          address={addr}
          buildingType={e?.nimetus}
          index={index}
          overall={overall}
          overallLabel={overallLabel}
          listingPhoto={column.listingPhoto ?? null}
          onRemove={onRemove}
        />
      </div>

      {/* Name + location */}
      <div className="px-4 pt-3.5 pb-3">
        <p className="display-tight text-[16px] text-ink leading-[1.2] line-clamp-2 min-h-[2.6em]">
          {addr}
        </p>
        <p className="mt-1 text-[11.5px] text-muted">
          {city}
          {county ? ` · ${county}` : ""}
          {e?.nimetus && (
            <>
              {" · "}
              <span className="italic">{e.nimetus}</span>
            </>
          )}
        </p>
        {unitKind === "multi" && (
          <p className="mt-1.5 text-[10.5px] text-warn leading-snug">
            Korterelamu — sisesta oma korteri andmed lahtris #{String(index + 1).padStart(2, "0")}.
          </p>
        )}
        {/* Listing link (kv.ee / city24 / kinnisvara24 / cke.ee) — shown
            when the raw input is a URL OR the demo button set a manual
            listingUrl (e.g. the 3 demo listings have manualListingUrl
            pointing to kv.ee even though raw is the address). */}
        {(column.input.manualListingUrl || /^https?:\/\//i.test(column.input.raw)) && (
          <a
            href={column.input.manualListingUrl ?? column.input.raw}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-[10.5px] text-ink underline underline-offset-2 hover:opacity-70"
          >
            Vaata kuulutust ↗
          </a>
        )}
      </div>

      <PlaneeringuRadar plans={column.planeeringud} />

      {/* Key metrics */}
      <div className="px-4 pb-3 grid grid-cols-3 gap-2 text-[11px] text-muted">
        <div title="Toad">
          {IconDoor}
          <span className="text-ink font-semibold tabnum">{rooms ?? "—"}</span>
        </div>
        <div title="Pindala">
          {IconRuler}
          <span className="text-ink font-semibold tabnum">{areaM2 ? `${areaM2} m²` : "—"}</span>
        </div>
        <div title="Ehitis">
          {IconSun}
          <span className="text-ink font-semibold tabnum">
            {e?.esmaneKasutus ? e.esmaneKasutus.slice(0, 4) : "—"}
          </span>
        </div>
      </div>

      {/* Price */}
      <div className="px-4 pt-3 pb-4 border-t border-rule">
        <p className="display text-[26px] leading-none tabnum" style={{ color: priceColor }}>
          {price != null ? fmtMoney(price) : "—"}
        </p>
        <p className="mt-1.5 text-[11px] text-muted">
          {pricePerM2 != null ? (
            <>
              <span className="tabnum">{fmtMoney(pricePerM2)}</span> / m²
            </>
          ) : price != null ? (
            <span className="text-warn">Sisesta pindala, et näha €/m²</span>
          ) : (
            <span className="text-warn">Sisesta hind</span>
          )}
          {diffVsMedian != null && (
            <span className="ml-2" style={{ color: priceColor }}>
              ({diffVsMedian > 0 ? "+" : ""}
              {(diffVsMedian * 100).toFixed(1)}%)
            </span>
          )}
        </p>
        {price != null && areaM2 && (
          <AvmBar
            pricePerM2={pricePerM2}
            baseline={column.scores.fairValue.baseline}
            baselineSource={column.scores.fairValue.baselineSource}
          />
        )}
        {price == null && (
          <p className="mt-1 text-[10px] text-faint">
            Klõpsa lahtrile #{String(index + 1).padStart(2, "0")} ja sisesta kuulutuse hind
          </p>
        )}
        {price != null && c?.maks_hind != null && c.maks_hind > 0 && (
          <p className="mt-1 text-[9.5px] text-faint">
            Maa-amet 2022 maksustamisväärtus: {fmtMoney(c.maks_hind)}
          </p>
        )}
      </div>

      {/* The 5 scores — the comparison core */}
      <div className="px-4 pb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted mb-2.5">Skoorid</p>
        <ul className="space-y-2">
          {scoreRows.map((s) => {
            const l = SCORE_LABELS[s.key];
            const tone =
              s.tone === "good" ? "bg-emerald-50" :
              s.tone === "bad" ? "bg-red-50" :
              "bg-paper";
            return (
              <li key={s.key} className={`rounded ${tone} px-2.5 py-1.5`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[11.5px] font-semibold text-ink">{l.title}</span>
                  <Stars value={s.value} />
                </div>
                <p className="mt-0.5 text-[10.5px] text-muted leading-snug">{s.reason}</p>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Lifestyle matrix — 7 categories */}
      <LifestyleMatrix lifestyle={column.lifestyle} />

      {/* Data table — just the key facts */}
      <div className="border-t border-rule">
        <table className="w-full text-[11.5px]">
          <tbody>
            <Row label="Ehitise liik" value={e?.nimetus ?? "—"} />
            <Row label="Esmakasutus" value={fmtYear(e?.esmaneKasutus)} />
            <Row label="Energiamärgis" value={<EnergyPill k={e?.energy[0]?.energiaKlass ?? null} />} />
            <Row
              label="Korruseid"
              value={e?.maxKorrusteArv != null ? `${e.maxKorrusteArv}` : "—"}
            />
            <Row
              label="Hoone netopind"
              value={e?.suletud_netopind != null ? `${e.suletud_netopind.toLocaleString("et-EE")} m²` : "—"}
              hint={unitKind === "multi" ? "kogu hoone" : undefined}
            />
            <Row
              label="Küte"
              value={e?.energy[0]?.kytteTyypTxt ?? "—"}
            />
            <Row label="Omandivorm" value={c?.omvorm ?? "—"} />
            <Row
              label="Maksustamisväärtus"
              value={c?.maks_hind != null ? fmtMoney(c.maks_hind) : "—"}
              hint="Maa-amet 2022"
            />
            <Row label="Katastri nr" value={c?.tunnus ?? "—"} mono />
            <Row label="EHR kood" value={e?.ehr_code ?? "—"} mono />
          </tbody>
        </table>
      </div>

      <RiskBadges radon={column.radon} flood={column.flood} />
      <EnrichmentPanel data={column.enrichment} />
    </div>
  );
}

function Row({ label, value, mono = false, hint }: { label: string; value: React.ReactNode; mono?: boolean; hint?: string }) {
  return (
    <tr className="border-b border-rule last:border-b-0">
      <td className="px-4 py-2.5 text-muted align-top whitespace-nowrap">
        {label}
        {hint && <p className="text-[9.5px] text-faint mt-0.5">{hint}</p>}
      </td>
      <td className={`px-4 py-2.5 text-right text-ink align-top ${mono ? "font-mono text-[11px]" : ""}`}>{value}</td>
    </tr>
  );
}
