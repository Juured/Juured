"use client";

import { useState } from "react";

type Props = {
  propertyPrice: number | null;
};

// Standard annuity formula: fixed monthly payment over n months.
function calcMonthly(price: number, downPct: number, ratePct: number, termYears: number): number {
  const principal = price * (1 - downPct / 100);
  const n = termYears * 12;
  if (ratePct === 0) return principal / n;
  const r = ratePct / 100 / 12;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

export function LoanCalculator({ propertyPrice }: Props) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState<number>(propertyPrice ?? 0);
  const [downPct, setDownPct] = useState(20);
  const [ratePct, setRatePct] = useState(4.0);
  const [termYears, setTermYears] = useState(20);

  const monthly = price > 0 ? calcMonthly(price, downPct, ratePct, termYears) : null;
  const principal = price * (1 - downPct / 100);

  return (
    <div className="border-t border-rule">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-2.5 flex items-baseline justify-between text-left hover:bg-paper transition-colors"
        aria-expanded={open}
      >
        <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink">
          Laenukalkulaator
        </span>
        <span className="text-[11px] text-muted">{open ? "▾" : "▸"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted mb-1">
            Kogukulu omandina
          </p>

          {/* Kinnisvara hind — number input, pre-filled from prop */}
          <div>
            <div className="flex justify-between items-baseline mb-1">
              <label className="text-[11.5px] text-muted">Kinnisvara hind</label>
              <span className="text-[11.5px] font-semibold tabnum text-ink">
                {price > 0 ? `${price.toLocaleString("et-EE")} €` : "—"}
              </span>
            </div>
            <input
              type="number"
              value={price || ""}
              min={0}
              step={1000}
              placeholder="Sisesta hind"
              onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))}
              className="w-full border border-rule bg-field text-ink text-[12px] px-2 py-1.5 tabnum focus:outline-none focus:border-ink"
            />
          </div>

          {/* Sissemakse slider */}
          <SliderRow
            label="Sissemakse"
            valueLabel={`${downPct}%`}
            min={0}
            max={50}
            step={1}
            value={downPct}
            onChange={setDownPct}
            minLabel="0%"
            maxLabel="50%"
          />

          {/* Intressimäär slider */}
          <SliderRow
            label="Intressimäär"
            valueLabel={`${ratePct.toFixed(1)}%`}
            min={1.0}
            max={8.0}
            step={0.1}
            value={ratePct}
            onChange={setRatePct}
            minLabel="1,0%"
            maxLabel="8,0%"
          />

          {/* Periood slider */}
          <SliderRow
            label="Periood"
            valueLabel={`${termYears} a`}
            min={5}
            max={30}
            step={1}
            value={termYears}
            onChange={setTermYears}
            minLabel="5 a"
            maxLabel="30 a"
          />

          {/* Output */}
          <div className="border-t border-rule pt-3 flex items-baseline justify-between gap-2">
            <span className="text-[11.5px] text-muted">Igakuine makse</span>
            <span className="display text-[22px] leading-none tabnum text-ink">
              {monthly != null ? `${Math.round(monthly).toLocaleString("et-EE")} €` : "—"}
            </span>
          </div>
          {price > 0 && (
            <p className="text-[10px] text-faint -mt-1">
              Laenusumma: {Math.round(principal).toLocaleString("et-EE")} €
            </p>
          )}
        </div>
      )}
    </div>
  );
}

type SliderRowProps = {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  minLabel: string;
  maxLabel: string;
};

function SliderRow({ label, valueLabel, min, max, step, value, onChange, minLabel, maxLabel }: SliderRowProps) {
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <label className="text-[11.5px] text-muted">{label}</label>
        <span className="text-[11.5px] font-semibold tabnum text-ink">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-ink h-0.5 cursor-pointer"
      />
      <div className="flex justify-between text-[10px] text-faint mt-0.5">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}
