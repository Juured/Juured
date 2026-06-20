"use client";

import { useState } from "react";
import type { EnrichmentData } from "@/app/api/enrich/route";
import { Tooltip } from "@/components/Tooltip";
import { fmtMoney } from "@/lib/estdata";

type Props = {
  data: EnrichmentData | null;
  defaultOpen?: boolean;
};

function fmtPct(n: number | null | undefined, withSign = true): string {
  if (n == null) return "—";
  const sign = withSign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function fmtDaysAgo(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "täna";
  if (days === 1) return "1 päev tagasi";
  if (days < 30) return `${days} päeva tagasi`;
  if (days < 365) return `${Math.floor(days / 30)} kuud tagasi`;
  return `${Math.floor(days / 365)} a tagasi`;
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 120;
  const h = 28;
  const stepX = w / (points.length - 1);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${(i * stepX).toFixed(1)},${(h - ((p - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="text-ink" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EnrichmentPanel({ data, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  if (!data) {
    return (
      <div className="border-t border-rule px-4 py-3 text-[11px] text-faint">
        Rikastused pole saadaval.
      </div>
    );
  }
  const blockCount = [
    data.pricePerM2, data.deviationFromComparables, data.priceHistory, data.daysOnMarket,
    data.duplicates, data.completeness, data.districtBenchmark, data.energyComparison,
    data.renovation, data.rentYield, data.liquidity,
  ].filter((x) => x !== null && x !== undefined).length;
  const anyBlock = blockCount > 0;

  return (
    <div className="border-t border-rule">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-baseline justify-between text-left hover:bg-paper transition-colors"
        aria-expanded={open}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink">
          Rikastused {anyBlock ? `· ${blockCount}/11` : ""}
        </span>
        <span className="text-[11px] text-muted">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-[11.5px]">
          {!anyBlock && (
            <p className="text-faint leading-relaxed">
              Rikastused vajavad kv.ee / city24.ee linki. Sisesta portaali URL, et näha hinnalugu, päevi turul, duplikaate ja likviidsust.
            </p>
          )}

          <Block label="Hind ruutmeetri kohta" tip="Hind jagatud pindalaga. Võrdle sama linnaosa varasemate tehingutega — see on kõige täpsem võrreldav suurus.">
            <span className="font-mono text-ink">{data.pricePerM2 != null ? `${fmtMoney(data.pricePerM2)} / m²` : "—"}</span>
          </Block>

          {data.deviationFromComparables && (
            <Block label="Erinevus võrreldavatest" tip="Hinna erinevus sarnaste piirkonna kuulutuste mediaanist. Üle +10% → omanik ootab turust kõrgemat hinda.">
              <span className="font-mono text-ink">
                {fmtPct(data.deviationFromComparables.pct)} vs {data.deviationFromComparables.n} sarnast
              </span>
            </Block>
          )}

          {data.priceHistory && data.priceHistory.length > 0 && (
            <Block label="Hinna ajalugu" tip="Kuulutuse hinnamuutused alates esmakordsest fikseerimisest. Sagedased langused → omanik on paindlik, võib pakkuda alla.">
              <div className="flex items-center gap-3">
                <Sparkline points={data.priceHistory.map((p) => p.price)} />
                <ul className="text-[10.5px] text-muted space-y-0.5">
                  {data.priceHistory.slice(-3).reverse().map((p, i, arr) => {
                    const prev = arr[i + 1]?.price;
                    const delta = prev ? p.price - prev : null;
                    return (
                      <li key={p.date}>
                        {fmtDaysAgo(p.date)}: {fmtMoney(p.price)}
                        {delta != null && delta !== 0 && (
                          <span className={delta < 0 ? "text-emerald-700" : "text-red-700"}>
                            {" "}({delta > 0 ? "+" : ""}{fmtMoney(delta)})
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Block>
          )}

          {data.daysOnMarket && (
            <Block label="Turul olnud" tip="Mitu päeva on see kuulutus portaalis olnud. Alla 7 = kiirustage, üle 90 = omanik on tõenäoliselt valmis läbirääkimisteks.">
              <span className={`font-mono ${data.daysOnMarket.tone === "roheline" ? "text-emerald-700" : data.daysOnMarket.tone === "kollane" ? "text-amber-700" : "text-red-700"}`}>
                {data.daysOnMarket.days} päeva
              </span>
            </Block>
          )}

          {data.duplicates && data.duplicates.length > 0 && (
            <Block label="Duplikaatkuulutused" tip="Sama korter võib olla üleval mitmes portaalis. Odavaim on tavaliselt tõde. Kui hinnad erinevad, küsitle müüjat.">
              <ul className="text-[10.5px] text-muted space-y-0.5">
                {data.duplicates.slice(0, 3).map((d) => (
                  <li key={d.url}>
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline">
                      {d.portal}
                    </a>
                    {" — "}{fmtMoney(d.price)}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {data.completeness && (
            <Block label="Kuulutuse täielikkus" tip="Mitu võtmevälja on kuulutuses täidetud. Rohkem välju = usaldusväärsem, sageli parem hind.">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 border border-rule relative">
                  <div className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${data.completeness.score}%` }} />
                </div>
                <span className="font-mono text-ink">{data.completeness.score}%</span>
              </div>
              {data.completeness.missing.length > 0 && (
                <p className="text-[10px] text-faint mt-1">Puudub: {data.completeness.missing.join(", ")}</p>
              )}
            </Block>
          )}

          {data.districtBenchmark && data.districtBenchmark.districtMedian != null && (
            <Block label="Linnaosa võrdlus" tip="Sinu kinnisvara positsioon Eesti omavalitsuste mediaanide edetabelis. 75% = sinu linnaosa on Eesti 75. protsentiilis (kõrgem pool).">
              <span className="font-mono text-ink">
                {data.districtBenchmark.nationalPercentile ?? 50}. protsentiil Eestis · mediaan {fmtMoney(data.districtBenchmark.districtMedian)}/m²
              </span>
            </Block>
          )}

          {data.energyComparison && (
            <Block label="Energiamärgise võrdlus" tip="Energiamärgise võrdlus. A-C on rohelaenuks sobiv, D on tingimuslik, E-H on kõrge energiakuluga.">
              <span className="font-mono text-ink">
                {data.energyComparison.thisClass ?? "—"} · linnaosa: {data.energyComparison.districtMode ?? "—"} · Eesti: {data.energyComparison.nationalMode}
              </span>
            </Block>
          )}

          {data.renovation && (
            <Block label="Seisukorra märgid" tip="Renoveerimis- ja seisukorra märgid EHR andmetest. Täpseks hinnanguks vaata üle ise või kutsu ekspert.">
              <p className="text-ink">{data.renovation.label}</p>
              {data.renovation.signals.length > 0 && (
                <p className="text-[10.5px] text-muted mt-0.5">{data.renovation.signals.join(" · ")}</p>
              )}
            </Block>
          )}

          {data.rentYield && data.rentYield.yieldPct != null && (
            <Block label="Üüri tootlus" tip="Aastane üüritulu jagatud müügihinnaga. 4-7% on Eestis tavaline. Üle 8% on hea, alla 4% on madal.">
              <span className={`font-mono ${data.rentYield.tier === "kõrge" ? "text-emerald-700" : data.rentYield.tier === "madal" ? "text-red-700" : "text-ink"}`}>
                {data.rentYield.yieldPct.toFixed(1)}% · {data.rentYield.reason}
              </span>
            </Block>
          )}

          {data.liquidity && (
            <Block label="Likviidsus" tip="Sarnaste kuulutuste arv samas piirkonnas. Kõrge likviidsus = lihtne müüa, kui vaja. Madal = nišš, ostjaid vähe.">
              <span className={`font-mono ${data.liquidity.tone === "kõrge" ? "text-emerald-700" : data.liquidity.tone === "madal" ? "text-red-700" : "text-ink"}`}>
                {data.liquidity.totalCount} sarnast · {data.liquidity.tone}
              </span>
            </Block>
          )}
        </div>
      )}
    </div>
  );
}

function Block({ label, tip, children }: { label: string; tip: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-2 py-1">
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-muted">{label}</span>
        <Tooltip text={tip}><span aria-hidden="true">ⓘ</span></Tooltip>
      </div>
      <div className="text-right min-w-0">{children}</div>
    </div>
  );
}
