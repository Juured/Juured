"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, CircleMarker } from "leaflet";
import type { CompareColumn } from "@/lib/compareStore";

type PoiCategory =
  | "park"
  | "school"
  | "kindergarten"
  | "gym"
  | "transit"
  | "shop"
  | "cafe"
  | "restaurant";

type PoiItem = {
  category: PoiCategory;
  lat: number;
  lon: number;
  name: string;
};

// Warm muted palette — every hue sits in the cream/taupe/ochre family
// so the map doesn't punch a hole in the editorial aesthetic.
const CATEGORY_COLOR: Record<PoiCategory, string> = {
  park: "#5C7A3F",          // warm leaf green
  school: "#5C6D6D",        // slate
  kindergarten: "#8C6D4F",  // brand ochre
  gym: "#8B5A3F",           // terracotta
  transit: "#6D7A8C",       // slate blue
  shop: "#A88A4F",          // sand
  cafe: "#8B5A5A",          // dusty rose
  restaurant: "#A8623F",    // burnt sienna
};

const CATEGORY_LABEL: Record<PoiCategory, string> = {
  park: "Park",
  school: "Kool",
  kindergarten: "Lasteaed",
  gym: "Sport",
  transit: "Ühistransport",
  shop: "Kauplus",
  cafe: "Kohvik",
  restaurant: "Restoran",
};

export default function PropertyMap({ columns = [] }: { columns?: CompareColumn[] }) {
  const mapRootRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Array<Marker | CircleMarker>>([]);
  const [mapReady, setMapReady] = useState(false);
  const [poiItems, setPoiItems] = useState<PoiItem[]>([]);
  const [loadingPoi, setLoadingPoi] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const points = useMemo(
    () =>
      columns.flatMap((column) =>
        column.lat != null && column.lon != null
          ? [
              {
                id: column.id,
                label:
                  column.cadastre?.tais_aadress ??
                  column.ehr?.taisaadress ??
                  column.input.raw,
                lat: column.lat,
                lon: column.lon,
              },
            ]
          : [],
      ),
    [columns],
  );

  useEffect(() => {
    let active = true;

    async function initializeMap() {
      if (!mapRootRef.current || mapRef.current) return;

      try {
        const imported = await import("leaflet");
        const leaflet = imported.default;
        if (!active || !mapRootRef.current) return;

        const map = leaflet.map(mapRootRef.current, {
          zoomControl: true,
          attributionControl: true,
        });

        leaflet
          .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
          })
          .addTo(map);

        map.setView([59.43696, 24.75353], 12);
        mapRef.current = map;
        setMapReady(true);
      } catch (cause) {
        console.error("Leaflet map initialization failed", cause);
        setError("Kaardi laadimine ebaõnnestus.");
      }
    }

    void initializeMap();

    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPoi() {
      if (points.length === 0) {
        setPoiItems([]);
        return;
      }

      setLoadingPoi(true);
      try {
        const responses = await Promise.all(
          points.map(async (point) => {
            const params = new URLSearchParams({
              lat: String(point.lat),
              lon: String(point.lon),
              radius: "500",
              detail: "1",
            });
            const response = await fetch(`/api/poi?${params}`);
            if (!response.ok) return [];

            const data = (await response.json()) as { items?: PoiItem[] };
            return Array.isArray(data.items) ? data.items : [];
          }),
        );

        if (!cancelled) {
          setPoiItems(
            responses
              .flat()
              .filter(
                (item) =>
                  item.category in CATEGORY_COLOR &&
                  Number.isFinite(item.lat) &&
                  Number.isFinite(item.lon),
              ),
          );
        }
      } catch {
        if (!cancelled) setPoiItems([]);
      } finally {
        if (!cancelled) setLoadingPoi(false);
      }
    }

    void loadPoi();
    return () => {
      cancelled = true;
    };
  }, [points]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    let active = true;
    async function updateMarkers() {
      const imported = await import("leaflet");
      const leaflet = imported.default;
      if (!active || !mapRef.current) return;

      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];

      for (const point of points) {
        const icon = leaflet.divIcon({
          className: "property-map-pin",
          html: '<span aria-hidden="true"></span>',
          iconSize: [24, 34],
          iconAnchor: [12, 34],
        });
        const marker = leaflet.marker([point.lat, point.lon], { icon }).addTo(mapRef.current);
        marker.bindTooltip(point.label, { direction: "top", offset: [0, -28] });
        markersRef.current.push(marker);
      }

      for (const poi of poiItems) {
        const marker = leaflet
          .circleMarker([poi.lat, poi.lon], {
            radius: 5,
            color: CATEGORY_COLOR[poi.category],
            fillColor: CATEGORY_COLOR[poi.category],
            fillOpacity: 0.9,
            weight: 1,
          })
          .addTo(mapRef.current);
        marker.bindTooltip(`${poi.name} · ${CATEGORY_LABEL[poi.category]}`, {
          direction: "top",
        });
        markersRef.current.push(marker);
      }

      if (points.length > 0) {
        const bounds = leaflet.latLngBounds(points.map((point) => [point.lat, point.lon]));
        mapRef.current.fitBounds(bounds.pad(0.35), { animate: false, maxZoom: 15 });
      } else {
        mapRef.current.setView([59.43696, 24.75353], 12);
      }

      mapRef.current.invalidateSize();
    }

    void updateMarkers();
    return () => {
      active = false;
    };
  }, [mapReady, poiItems, points]);

  return (
    <section className="border border-rule bg-paper2/40">
      <div className="flex items-center justify-between gap-4 border-b border-rule px-4 py-3">
        <div>
          <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
            Asukoht ja lähedus
          </h2>
          <p className="mt-1 text-[12px] text-faint">
            {points.length > 0
              ? `${points.length} objekti ja teenused 500 m raadiuses`
              : "Tallinn · lisa objektid asukohtade kuvamiseks"}
          </p>
        </div>
        {loadingPoi && <span className="text-[11px] text-faint">Laen teenuseid…</span>}
      </div>

      <div className="relative h-[420px] min-h-[320px] w-full">
        <div ref={mapRootRef} className="h-full w-full" aria-label="Kinnisvara asukohtade kaart" />
        {error && (
          <div className="absolute inset-0 z-[500] grid place-items-center bg-paper2/90 px-6 text-center text-sm text-muted">
            {error}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-rule px-4 py-3">
        {Object.entries(CATEGORY_LABEL).map(([category, label]) => (
          <span key={category} className="inline-flex items-center gap-1.5 text-[10.5px] text-faint">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CATEGORY_COLOR[category as PoiCategory] }}
            />
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}
