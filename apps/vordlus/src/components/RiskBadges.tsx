"use client";

type Radon = { class: "madal" | "keskmine" | "korge" };
type Flood = { zone: "ei_ole_ohualas" | "100a_ohualas" | "1000a_ohualas" };

const RADON_LABEL: Record<Radon["class"], string> = { madal: "madal", keskmine: "keskmine", korge: "kõrge" };
const RADON_TONE: Record<Radon["class"], string> = { madal: "ok", keskmine: "warn", korge: "bad" };
const FLOOD_LABEL: Record<Flood["zone"], string> = { ei_ole_ohualas: "ei ole ohualas", "100a_ohualas": "100a ohualas", "1000a_ohualas": "1000a ohualas" };
const FLOOD_TONE: Record<Flood["zone"], string> = { ei_ole_ohualas: "ok", "100a_ohualas": "warn", "1000a_ohualas": "bad" };

export function RiskBadges({ radon, flood }: { radon: Radon | null; flood: Flood | null }) {
  if (!radon && !flood) return null;
  return (
    <div className="px-4 py-3 border-t border-rule flex gap-1.5 flex-wrap">
      {radon && (
        <span className={`risk-pill ${RADON_TONE[radon.class]}`}>
          Radoon · {RADON_LABEL[radon.class]}
        </span>
      )}
      {flood && (
        <span className={`risk-pill ${FLOOD_TONE[flood.zone]}`}>
          Üleujutus · {FLOOD_LABEL[flood.zone]}
        </span>
      )}
    </div>
  );
}
