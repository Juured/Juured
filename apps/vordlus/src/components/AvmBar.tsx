"use client";

type Props = {
  pricePerM2: number | null;
  baseline: number | null;
  baselineSource: string;
};

export function AvmBar({ pricePerM2, baseline, baselineSource }: Props) {
  if (baseline == null || baseline <= 0 || pricePerM2 == null || pricePerM2 <= 0) {
    return null;
  }
  const ratio = pricePerM2 / baseline;
  const LOG_AT_30 = Math.log(1.3);
  const pctRaw = (Math.log(ratio) / LOG_AT_30) * 30;
  const pct = Math.max(-30, Math.min(30, pctRaw));
  const leftPct = 50 + (pct / 30) * 30;
  const aboveMedian = pct > 0;
  return (
    <div>
      <div className="relative h-1.5 mt-2.5 border border-rule">
        <div
          className="absolute inset-y-0"
          style={{
            left: aboveMedian ? "50%" : `${leftPct}%`,
            right: aboveMedian ? `${100 - leftPct}%` : "50%",
            background: aboveMedian ? "#fef2f2" : "#f0fdf4",
          }}
          data-fill="property"
        />
        <div className="absolute top-[-3px] bottom-[-3px] w-px bg-ink" style={{ left: "50%" }} aria-hidden="true" />
        <div
          className="absolute top-[-3px] bottom-[-3px] w-[2px] bg-ink"
          style={{ left: `${leftPct}%` }}
          data-marker="property"
        />
        <span className="absolute -bottom-4 left-0 text-[9.5px] text-faint">−30%</span>
        <span className="absolute -bottom-4 right-0 text-[9.5px] text-faint">+30%</span>
      </div>
      <p className="mt-5 text-[10.5px] text-faint">
        vs {baselineSource} mediaan €{Math.round(baseline).toLocaleString("et-EE")} / m²
      </p>
    </div>
  );
}
