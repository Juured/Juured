"use client";

import type { ProfilePolicy } from "@/lib/intelligence/profiles";
import type { ScoreDimension } from "@/lib/intelligence/types";

const LABELS: Record<ScoreDimension, string> = {
  pricingFairness: "Õiglane hind",
  buildingQuality: "Hoone kvaliteet",
  ownershipCost: "Elamiskulud",
  locationAccessibility: "Asukoht ja ligipääs",
  lifestyle: "Elustiil",
  environmentalSafety: "Keskkonnaohutus",
  legalConsistency: "Õiguslik kindlus",
  liquidity: "Likviidsus",
  investmentPotential: "Investeerimispotentsiaal",
  listingQuality: "Kuulutuse kvaliteet",
  dataConfidence: "Andmete kindlus",
};

export function ProfileWeightExplanation({ policy }: { policy: ProfilePolicy }) {
  const rows = Object.entries(policy.weights)
    .map(([dimension, weight]) => ({
      dimension: dimension as ScoreDimension,
      weight,
    }))
    .sort((a, b) => b.weight - a.weight);

  return (
    <section className="mb-5 border border-rule bg-paperDeep px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Sinu hinnangu kaalud
          </p>
          <h3 className="mt-1 font-display text-[18px] text-ink">
            {policy.profile === "homebuyer" ? "Koduhuvilise prioriteedid" : "Investori prioriteedid"}
          </h3>
        </div>
        <p className="max-w-md text-[11px] leading-relaxed text-muted">
          Need kaalud muudavad personaalset sobivust, mitte objekti alusandmeid ega riskireegleid.
        </p>
      </div>

      <div className="mt-4 grid gap-x-5 gap-y-2 sm:grid-cols-2">
        {rows.map(({ dimension, weight }) => (
          <div key={dimension} className="grid grid-cols-[minmax(0,1fr)_44px] items-center gap-3">
            <div>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[11px] text-ink">{LABELS[dimension]}</span>
              </div>
              <div className="h-1.5 overflow-hidden bg-rule">
                <div
                  className="h-full bg-accent transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${Math.min(100, weight * 400)}%` }}
                />
              </div>
            </div>
            <span className="text-right font-mono text-[10.5px] text-muted">
              {(weight * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>

      {policy.reasons.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-rule pt-3 text-[11px] text-muted">
          {policy.reasons.map((reason) => (
            <li key={`${reason.dimension}-${reason.change}`}>{reason.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
