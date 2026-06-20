"use client";

import type { CompareColumn } from "@/lib/compareStore";

// Building type detection — used to decide whether to show user-input
// area/rooms or fall back to the building's total (which for a
// korterelamu is not what the user wants).
const MULTI = ["korterelamu", "korter"];

function isMultiUnit(c: CompareColumn): boolean {
  const n = c.ehr?.nimetus?.toLowerCase() ?? "";
  return MULTI.some((m) => n.includes(m));
}

const ROWS: { label: string; pick: (c: CompareColumn) => string | number | null }[] = [
  { label: "Aadress", pick: (c) => c.cadastre?.tais_aadress || c.ehr?.taisaadress || c.input.raw },
  { label: "Üldskoor", pick: (c) => c.scores.overall > 0 ? c.scores.overall : 0 },
  { label: "Fair Value", pick: (c) => c.scores.fairValue.score > 0 ? `${c.scores.fairValue.score}/5` : "—" },
  { label: "Elamiskulud", pick: (c) => c.scores.tco.score > 0 ? `${c.scores.tco.score}/5` : "—" },
  { label: "Väärtuse kasv", pick: (c) => c.scores.appreciation.score > 0 ? `${c.scores.appreciation.score}/5` : "—" },
  { label: "Elustiil", pick: (c) => c.scores.lifestyle.score > 0 ? `${c.scores.lifestyle.score}/5` : "—" },
  { label: "Rohelaen", pick: (c) => c.scores.greenMortgage.score > 0 ? `${c.scores.greenMortgage.score}/5` : "—" },
  // Rooms: prefer user input, fall back to EHR building total for single-unit.
  { label: "Toad", pick: (c) => {
      if (c.input.manualRooms != null) return c.input.manualRooms;
      if (isMultiUnit(c)) return "—"; // can't pick a single apartment's room count
      return c.ehr?.tubadeArv ?? "—";
    }
  },
  // Area: prefer user input. For korterelamu, hide the building total.
  { label: "Pindala", pick: (c) => {
      if (c.input.manualArea != null) return `${c.input.manualArea} m²`;
      if (isMultiUnit(c)) return "—";
      return c.ehr?.suletud_netopind ? `${c.ehr.suletud_netopind} m²` : "—";
    }
  },
  { label: "Esmakasutus", pick: (c) => c.ehr?.esmaneKasutus?.slice(0, 4) ?? "—" },
  { label: "Energiamärgis", pick: (c) => c.ehr?.energy[0]?.energiaKlass ?? "—" },
  { label: "Planeeringu radar", pick: (c) => c.planeeringud ? `${c.planeeringud.length} plaan(i)` : "—" },
  { label: "Radoon", pick: (c) => c.radon?.class ?? "—" },
  { label: "Üleujutus", pick: (c) => c.flood?.zone ?? "—" },
];

function isNumeric(v: string | number | null): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function ComparisonTable({ columns }: { columns: CompareColumn[] }) {
  if (columns.length === 0) return null;
  return (
    <section className="mt-12">
      <h2 className="display-tight text-[20px] text-ink mb-4">Kõrvuti võrdlus</h2>
      <div className="overflow-x-auto no-scrollbar -mx-5 sm:-mx-8 px-5 sm:px-8">
        <table className="w-full text-[11.5px] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[10.5px] uppercase tracking-[0.14em] text-muted font-semibold py-2 pr-4 border-b border-rule">Väli</th>
              {columns.map((c) => (
                <th key={c.id} className="text-right text-[11.5px] text-ink font-semibold py-2 px-2 border-b border-rule max-w-[180px] truncate">
                  {c.cadastre?.tais_aadress || c.ehr?.taisaadress || c.input.raw}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => {
              const values = columns.map((c) => row.pick(c));
              const numericValues = values.filter(isNumeric);
              const max = numericValues.length > 0 ? Math.max(...numericValues) : null;
              const min = numericValues.length > 0 ? Math.min(...numericValues) : null;
              return (
                <tr key={row.label} className="border-b border-rule last:border-b-0">
                  <td className="text-muted py-2 pr-4 whitespace-nowrap">{row.label}</td>
                  {columns.map((c, i) => {
                    const v = values[i];
                    const isBest = isNumeric(v) && max != null && v === max && max !== min;
                    const isWorst = isNumeric(v) && min != null && v === min && max !== min;
                    return (
                      <td
                        key={c.id}
                        className={`text-right py-2 px-2 font-mono tabular-nums ${isBest ? "bg-emerald-50 text-emerald-900" : isWorst ? "bg-red-50 text-red-900" : "text-ink"}`}
                      >
                        {typeof v === "number" ? v.toFixed(1) : v ?? "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
