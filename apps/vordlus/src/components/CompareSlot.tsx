"use client";

import { useEffect, useState } from "react";
import type { CompareColumn } from "@/lib/compareStore";
import { makeId, saveCompare } from "@/lib/compareStore";
import { parseUserInput } from "@/lib/parseInput";
import { EMPTY_LIFESTYLE } from "@/lib/lifestyle";

type Props = {
  index: number;
  column: CompareColumn | null;
  onChange: (col: CompareColumn | null) => void;
  onResolve: (raw: string, manual?: { price?: number | null; area?: number | null; rooms?: number | null }) => Promise<{
    ok: boolean;
    error?: string;
  }>;
};

export default function CompareSlot({ index, column, onChange, onResolve }: Props) {
  const [raw, setRaw] = useState(column?.input.raw ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState<{
    price?: number;
    area?: number;
    rooms?: number;
  }>({
    price: column?.input.manualPrice ?? undefined,
    area: column?.input.manualArea ?? undefined,
    rooms: column?.input.manualRooms ?? undefined,
  });

  // Decide if the resolved building is multi-unit — if so, surface the
  // manual inputs immediately so the user knows to enter their apartment.
  const nimetus = column?.ehr?.nimetus?.toLowerCase() ?? "";
  const isMultiUnit =
    nimetus.includes("korterelamu") ||
    nimetus.includes("korter") ||
    (column?.ehr?.tubadeArv != null && column.ehr.tubadeArv > 5);

  useEffect(() => {
    setRaw(column?.input.raw ?? "");
    setManual({
      price: column?.input.manualPrice ?? undefined,
      area: column?.input.manualArea ?? undefined,
      rooms: column?.input.manualRooms ?? undefined,
    });
    // Auto-expand manual inputs for multi-unit buildings
    setShowManual(isMultiUnit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [column?.id, isMultiUnit]);

  async function submit() {
    const parsed = parseUserInput(raw);
    if (parsed.kind === "empty") {
      setErr("Sisesta aadress või ID");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await onResolve(raw, {
      price: manual.price ?? null,
      area: manual.area ?? null,
      rooms: manual.rooms ?? null,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error || "Andmete laadimine ebaõnnestus");
    }
  }

  function clearSlot() {
    setRaw("");
    setManual({ price: undefined, area: undefined, rooms: undefined });
    setErr(null);
    onChange(null);
  }

  // Has-data state: show a compact card
  if (column && (column.cadastre || column.ehr)) {
    const c = column.cadastre;
    const e = column.ehr;
    const yearBuilt = e?.esmaneKasutus ? e.esmaneKasutus : (e?.ehAlustKp?.slice(0, 4) ?? null);
    const energy = e?.energy[0]?.energiaKlass ?? null;
    const missing: string[] = [];
    if (column.input.manualPrice == null) missing.push("hind");
    if (column.input.manualArea == null) missing.push("m²");
    if (column.input.manualRooms == null) missing.push("toad");
    return (
      <div className="rounded-md border border-rule bg-white overflow-hidden">
        <div className="px-3 py-2.5 border-b border-rule flex items-center justify-between gap-2">
          <span className="eyebrow text-faint">#{String(index + 1).padStart(2, "0")}</span>
          <button
            onClick={clearSlot}
            className="text-[11px] text-muted hover:text-ink"
            aria-label="Eemalda"
          >
            ✕
          </button>
        </div>
        <div className="p-3">
          <p className="text-[13px] font-medium text-ink leading-tight line-clamp-2">
            {c?.tais_aadress || e?.taisaadress || column.input.raw}
          </p>
          <div className="mt-2 text-[11px] text-muted space-y-0.5">
            {e && <p>{e.nimetus ?? "—"} · EHR {e.ehr_code} · {yearBuilt ?? "—"}</p>}
            {energy && <p>Energiamärgis: <span className="text-ink font-semibold">{energy}</span></p>}
            {c && <p>Omand: {c.omvorm ?? "—"}</p>}
          </div>
          {missing.length > 0 && (
            <p className="mt-2 text-[10.5px] text-warn">
              ⚠ Sisesta: {missing.join(", ")}
            </p>
          )}
          {column.errors.length > 0 && (
            <p className="mt-2 text-[10.5px] text-warn line-clamp-2" title={column.errors.join("; ")}>
              ⚠ {column.errors[0]}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Empty state: paste slot
  return (
    <div className="rounded-md border border-dashed border-rule2 bg-white/40">
      <div className="px-3 py-2 border-b border-rule flex items-center justify-between">
        <span className="eyebrow text-faint">#{String(index + 1).padStart(2, "0")}</span>
        {column && (
          <button onClick={clearSlot} className="text-[11px] text-muted hover:text-ink" aria-label="Eemalda">✕</button>
        )}
      </div>
      <div className="p-3 space-y-2.5">
        <input
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Aadress, kv.ee link või ID"
          className="w-full bg-field border border-rule px-2.5 py-1.5 text-[13px]
                     focus:border-ink outline-none transition-colors"
        />
        <button
          onClick={() => setShowManual((s) => !s)}
          className="text-[11px] text-muted hover:text-ink"
        >
          {showManual ? "− Peida" : "+ Lisa"} käsitsi andmed (hind, m², toad)
        </button>
        {showManual && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-faint leading-snug">
              Kuulutuse hind ja oma korteri pindala. Seda küsime, sest EHR andmed on kogu hoone kohta.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <input
                type="number"
                value={manual.price ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, price: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="Hind €"
                className="bg-field border border-rule px-1.5 py-1 text-[11px] font-mono focus:border-ink outline-none"
              />
              <input
                type="number"
                value={manual.area ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, area: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="m²"
                className="bg-field border border-rule px-1.5 py-1 text-[11px] font-mono focus:border-ink outline-none"
              />
              <input
                type="number"
                value={manual.rooms ?? ""}
                onChange={(e) => setManual((m) => ({ ...m, rooms: e.target.value ? Number(e.target.value) : undefined }))}
                placeholder="Tube"
                className="bg-field border border-rule px-1.5 py-1 text-[11px] font-mono focus:border-ink outline-none"
              />
            </div>
          </div>
        )}
        <button
          onClick={submit}
          disabled={busy}
          className="w-full bg-ink text-paper text-[12px] font-semibold tracking-wide
                     uppercase py-1.5 hover:bg-ink/85 transition-colors disabled:opacity-50"
        >
          {busy ? "Laen…" : "Lisa võrdlusesse"}
        </button>
        {err && <p className="text-[11px] text-bad leading-snug">{err}</p>}
      </div>
    </div>
  );
}
