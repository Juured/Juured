"use client";

import { LIFESTYLE_LABELS, type Lifestyle, type LifestyleKey } from "@/lib/lifestyle";

const ROWS: LifestyleKey[] = ["park", "school", "gym", "transit", "shop", "cafe", "restaurant"];

const GLYPHS: Record<LifestyleKey, string> = {
  park: "▲",
  school: "◆",
  gym: "●",
  transit: "▶",
  shop: "▣",
  cafe: "○",
  restaurant: "▤",
};

function Star({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width="9" height="9" aria-hidden="true">
      <path
        d="M10 1l2.5 6 6.5.6-5 4.5 1.5 6.4L10 15l-5.5 3.5L6 12 1 7.6 7.5 7z"
        fill="currentColor"
        className={on ? "text-ink" : "text-rule2"}
      />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-px">
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} on={i < value} />)}
    </span>
  );
}

export function LifestyleMatrix({ lifestyle }: { lifestyle: Lifestyle }) {
  return (
    <div className="px-4 pb-4 border-t border-rule">
      <p className="pt-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        Elustiil · 1 km raadiuses
      </p>
      <ul className="grid grid-cols-1 gap-0.5">
        {ROWS.map((k) => {
          const v = lifestyle[k];
          const missing = v.count === 0;
          return (
            <li
              key={k}
              className="grid grid-cols-[16px_1fr_auto_auto] items-center gap-2 py-1 text-[11.5px]"
            >
              <span aria-hidden="true" className="text-muted text-[12px] leading-none">
                {GLYPHS[k]}
              </span>
              <span className="text-ink">{LIFESTYLE_LABELS[k].replace(" lähedal", "")}</span>
              <span className="text-muted font-mono text-[10.5px] tabular-nums w-7 text-right">
                {missing ? "—" : v.count}
              </span>
              {missing ? (
                <span className="text-faint text-[10px] w-[55px] text-right" aria-label="Andmed puuduvad">
                  Andmed puuduvad
                </span>
              ) : (
                <Stars value={v.stars} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
