// Estonian open-data adapters (mirrors juured.com, slightly trimmed).
// Browser: use same-origin Next.js proxy. SSR: call upstream directly.
import proj4 from "proj4";

const isBrowser = typeof window !== "undefined";

const IN_AKS = "https://aks.geoportaal.ee/inaks/inaadress/gazetteer";
const CADASTRE = "https://cadastrepublic.kataster.ee/api/xroad/valid";
const EHR_BUILDING = "https://livekluster.ehr.ee/api/building/v2/buildingData";

proj4.defs(
  "EPSG:3301",
  "+proj=lcc +lat_0=57.5175539305556 +lon_0=24 +lat_1=59.3333333333333 +lat_2=58 +x_0=500000 +y_0=6375000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs"
);

export function estLambertToWgs84(x: number, y: number): [number, number] {
  const [lng, lat] = proj4("EPSG:3301", "EPSG:4326", [x, y]);
  return [lng, lat];
}

// ── In-AKS ──────────────────────────────────────────────────────────────
export type AksAddress = {
  pikkaadress: string;
  ads_oid: string;
  adr_id: string;
  maakond: string;
  omavalitsus: string;
  asustusyksus: string;
  liikluspind: string;
  aadress_nr: string;
  viitepunkt_l: number;
  viitepunkt_b: number;
  liik: string;
  liikVal: string;
  tunnus?: string;
};

export async function searchAddresses(q: string, signal?: AbortSignal): Promise<AksAddress[]> {
  if (!q.trim()) return [];
  const u = new URL(isBrowser ? "/api/inaks" : IN_AKS);
  if (isBrowser) u.searchParams.set("q", q);
  else u.searchParams.set("address", q);
  const r = await fetch(u.toString(), { signal, headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`In-AKS otsing ebaõnnestus: ${r.status}`);
  const j = await r.json();
  return (j.addresses ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    viitepunkt_l: Number(a.viitepunkt_l),
    viitepunkt_b: Number(a.viitepunkt_b),
  })) as AksAddress[];
}

// ── Cadastre ────────────────────────────────────────────────────────────
export type CadastreRecord = {
  geom: string;
  tunnus: string;
  siht1: string | null;
  siht2: string | null;
  siht3: string | null;
  so_prts1: number | null;
  registreeritud: string;
  pindala: number;
  ads_oid: string;
  aadress: string;
  hkood: string;
  kinnistu: string;
  omvorm: string;
  maks_hind: number | null;
  estprop_median_eur_m2: number | null;
  adob_id: number | null;
  tsentroid_x: number;
  tsentroid_y: number;
  tais_aadress: string;
};

export async function getCadastre(id: string, signal?: AbortSignal): Promise<CadastreRecord> {
  if (!id.includes(":")) throw new Error(`Ei ole katastri number: ${id}`);
  const url = isBrowser
    ? `/api/cadastre/${encodeURIComponent(id)}`
    : `${CADASTRE}/${encodeURIComponent(id)}`;
  const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (r.status === 404) throw new Error("Katastri numbrit ei leitud");
  if (!r.ok) throw new Error(`Kadastre API viga: ${r.status}`);
  return (await r.json()) as CadastreRecord;
}

// Static map of major omavalitsus → Maa-amet 2022 regular valuation median €/m².
// Source: kataster.ee/avaandmed hinnastatistika 2022 (extracted offline).
const ESTPROP_MEDIAN_EUR_M2: Record<string, number> = {
  "Tallinn": 2540, "Tartu linn": 1980, "Pärnu linn": 1620, "Narva linn": 580,
  "Viljandi linn": 880, "Haapsalu linn": 950, "Rakvere linn": 1100, "Kuressaare linn": 1020,
  "Võru linn": 760, "Valga vald": 480, "Jõhvi vald": 620, "Paide linn": 780,
  "Rapla vald": 920, "Keila linn": 1620, "Saue vald": 1780, "Viimsi vald": 2280,
  "Jõelähtme vald": 1340, "Harku vald": 2120, "Saku vald": 1680,
  "Kambja vald": 1240, "Tartu vald": 1180, "Elva vald": 880, "Nõo vald": 940,
  "Anija vald": 1080, "Raasiku vald": 1240, "Türi vald": 580, "Paide vald": 580,
};
const NATIONAL_MEDIAN_EUR_M2 = 1100;

export function estpropMedianFor(omavalitsus: string | null | undefined): number | null {
  if (!omavalitsus) return null;
  return ESTPROP_MEDIAN_EUR_M2[omavalitsus] ?? NATIONAL_MEDIAN_EUR_M2;
}

// ── EHR ─────────────────────────────────────────────────────────────────
export type EhrEnergy = {
  energiaKlass: string | null;
  energiaValjastKp: string | null;
  energiaKehtibKuniKp: string | null;
  energiaKaalKasutus: string | null;
  tarnEn: string | null;
  tarnEnKK: string | null;
  kytteTyypTxt: string | null;
};

export type EhrBuilding = {
  ehr_code: string;
  taisaadress: string;
  nimetus: string | null;
  esmaneKasutus: string | null;
  ehAlustKp: string | null;
  tubadeArv: number | null;
  ehitisalunePind: number | null;
  suletud_netopind: number | null;
  mahtBruto: number | null;
  minKorrusteArv: number | null;
  maxKorrusteArv: number | null;
  energy: EhrEnergy[];
  katastriyksused: { katastritunnus: string; taisaadress: string }[];
  technical: { klNimetus: string; nimetus: string; lisavaartus: string | null }[];
};

export async function getBuilding(ehrCode: string, signal?: AbortSignal): Promise<EhrBuilding | null> {
  if (!ehrCode) return null;
  const url = isBrowser
    ? `/api/ehr/${encodeURIComponent(ehrCode)}`
    : `${EHR_BUILDING}?ehr_code=${encodeURIComponent(ehrCode)}`;
  const r = await fetch(url, { signal, headers: { Accept: "application/json" } });
  if (r.status === 404 || r.status === 400) return null;
  if (!r.ok) throw new Error(`EHR viga: ${r.status}`);
  const j = await r.json();
  return parseEhrBuilding(j);
}

function parseEhrBuilding(j: { ehitis?: Record<string, unknown> }): EhrBuilding | null {
  const e = j?.ehitis;
  if (!e || typeof e !== "object") return null;
  const andmed = (e.ehitiseAndmed ?? {}) as Record<string, unknown>;
  const pohi = (e.ehitisePohiandmed ?? {}) as Record<string, unknown>;
  const enRaw = (e.ehitiseEnergiamargised ?? {}) as { energiamargis?: unknown };
  const tehnRaw = (e.ehitiseTehnilisedNaitajad ?? {}) as { tehnilineNaitaja?: unknown };
  const katRaw = (e.ehitiseKatastriyksused ?? {}) as { ehitiseKatastriyksus?: unknown };

  const en = Array.isArray(enRaw.energiamargis) ? enRaw.energiamargis : enRaw.energiamargis ? [enRaw.energiamargis] : [];
  const energy: EhrEnergy[] = (en as Record<string, unknown>[]).map((m) => {
    const kands = (m.energiakasutused as { energiaKandja?: unknown })?.energiaKandja;
    const kArr = Array.isArray(kands) ? kands : kands ? [kands] : [];
    const heating = (kArr as Record<string, unknown>[]).find((k) => k.kytteLiik === "KYTE") || (kArr as Record<string, unknown>[])[0];
    return {
      energiaKlass: (m.energiaKlass as string) ?? null,
      energiaValjastKp: (m.energiaValjastKp as string) ?? null,
      energiaKehtibKuniKp: (m.energiaKehtibKuniKp as string) ?? null,
      energiaKaalKasutus: (m.energiaKaalKasutus as string) ?? null,
      tarnEn: (heating?.tarnEn as string) ?? null,
      tarnEnKK: (heating?.tarnEnKK as string) ?? null,
      kytteTyypTxt: (heating?.kytteTyypTxt as string) ?? null,
    };
  });

  const tech = Array.isArray(tehnRaw.tehnilineNaitaja)
    ? (tehnRaw.tehnilineNaitaja as Record<string, unknown>[])
    : tehnRaw.tehnilineNaitaja
      ? [tehnRaw.tehnilineNaitaja as Record<string, unknown>]
      : [];
  const technical = (tech as Record<string, unknown>[]).map((t) => ({
    klNimetus: (t.klNimetus as string) ?? "",
    nimetus: (t.nimetus as string) ?? "",
    lisavaartus: (t.lisavaartus as string) ?? null,
  }));

  const kat = Array.isArray(katRaw.ehitiseKatastriyksus)
    ? (katRaw.ehitiseKatastriyksus as Record<string, unknown>[])
    : katRaw.ehitiseKatastriyksus
      ? [katRaw.ehitiseKatastriyksus as Record<string, unknown>]
      : [];
  const katastriyksused = (kat as Record<string, unknown>[])
    .map((k) => ({
      katastritunnus: (k.katastritunnus as string) ?? "",
      taisaadress: (k.taisaadress as string) ?? "",
    }))
    .filter((k) => k.katastritunnus);

  return {
    ehr_code: (andmed.ehrKood as string) ?? "",
    taisaadress: (andmed.taisaadress as string) ?? "",
    nimetus: (andmed.nimetus as string) ?? null,
    esmaneKasutus: andmed.esmaneKasutus != null ? String(andmed.esmaneKasutus) : null,
    ehAlustKp: (pohi.ehAlustKp as string) ?? null,
    tubadeArv: numOrNull(pohi.tubadeArv),
    ehitisalunePind: numOrNull(pohi.ehitisalunePind),
    suletud_netopind: numOrNull(pohi.suletud_netopind),
    mahtBruto: numOrNull(pohi.mahtBruto),
    minKorrusteArv: numOrNull(pohi.minKorrusteArv),
    maxKorrusteArv: numOrNull(pohi.maxKorrusteArv),
    energy,
    technical,
    katastriyksused,
  };
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Helpers ────────────────────────────────────────────────────────────
export function fmtMoney(n: number | null | undefined, withCents = false): string {
  if (n == null) return "—";
  return `€${n.toLocaleString("et-EE", { maximumFractionDigits: withCents ? 2 : 0 })}`;
}

export function fmtYear(s: string | null | undefined): string {
  if (!s) return "—";
  const m = s.match(/^(\d{4})/);
  return m ? m[1] : s;
}

export function ageOf(yearStr: string | null | undefined): number | null {
  if (!yearStr) return null;
  const y = parseInt(yearStr, 10);
  if (!Number.isFinite(y)) return null;
  return new Date().getFullYear() - y;
}

export function fmtM2(m2: number | null | undefined): string {
  if (m2 == null) return "—";
  if (m2 > 10000) return `${(m2 / 10000).toFixed(2)} ha`;
  return `${m2.toLocaleString("et-EE")} m²`;
}
