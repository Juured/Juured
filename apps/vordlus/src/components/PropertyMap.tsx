// Static map placeholder. The real implementation will use Leaflet/Mapbox
// with property markers + nearby-amenity overlays. For the hackathon we
// keep it as a quiet visual block so the layout doesn't shift.
export default function PropertyMap() {
  return (
    <div className="border border-rule bg-paper2/40 px-5 py-6 text-center">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-muted">
        Kaart
      </p>
      <p className="mt-1 text-[12.5px] text-faint">
        Asukoht, planeeringud ja läheduses olevad teenused kaardil — tuleb peagi.
      </p>
    </div>
  );
}
