import { describe, it, expect } from "vitest";
import { parseKvListing, parseCity24Listing, normalizeAddress } from "../parsers.js";

const KV_HTML = `
<html><body>
  <div class="object-price"><strong>420 000 €</strong></div>
  <dl class="object-data">
    <dt>Aadress</dt><dd>Viljandi mnt 47, Nõmme, Tallinn</dd>
    <dt>Tube</dt><dd>5</dd>
    <dt>Üldpind</dt><dd>199 m²</dd>
    <dt>Energiamärgis</dt><dd>D</dd>
    <dt>Ehitusaasta</dt><dd>1970</dd>
  </dl>
  <div class="object-description"><p>Hea asukohaga üksikelamu Nõmmel. Planeering on avar, aknad on põhja suunas.</p></div>
  <div class="object-photos">
    <a href="https://img-bb.example.com/photo1.jpg"><img src="https://img-bb.example.com/photo1.jpg" width="800"></a>
    <a href="https://img-bb.example.com/photo2.jpg"><img src="https://img-bb.example.com/photo2.jpg" width="800"></a>
    <a href="https://img-bb.example.com/photo3.jpg"><img src="https://img-bb.example.com/photo3.jpg" width="800"></a>
  </div>
  <a href="/plaan?id=123">Vaata plaani</a>
</body></html>
`;

const CITY24_HTML = `
<html><body>
  <h1 class="object-title">3-toaline korter, Pärnu mnt 28, Tallinn</h1>
  <div class="price-box"><span>220 000 €</span></div>
  <ul class="object-attributes">
    <li>Tube: 2</li>
    <li>Pindala: 55 m²</li>
    <li>Energiamärgis: C</li>
    <li>Ehitusaasta: 1937</li>
  </ul>
  <p>Stiilne kesklinna korter vaatega pargile.</p>
  <div class="gallery">
    <img src="https://city24.ee/img/a.jpg" width="700">
    <img src="https://city24.ee/img/b.jpg" width="700">
  </div>
</body></html>
`;

describe("parseKvListing", () => {
  it("extracts price, address, area, rooms, energy, year", () => {
    const out = parseKvListing("https://www.kv.ee/12345", KV_HTML);
    expect(out.portal).toBe("kv.ee");
    expect(out.listing_id).toBe("12345");
    expect(out.price_eur).toBe(420000);
    expect(out.address_display).toMatch(/Viljandi mnt 47/);
    expect(out.address_norm).toBe("viljandi-mnt-47-tallinn");
    expect(out.area_m2).toBe(199);
    expect(out.rooms).toBe(5);
    expect(out.energy_class).toBe("D");
    expect(out.build_year).toBe(1970);
  });
  it("counts photos and description length", () => {
    const out = parseKvListing("https://www.kv.ee/12345", KV_HTML);
    expect(out.photo_count).toBeGreaterThanOrEqual(3);
    expect(out.description_len).toBeGreaterThan(50);
  });
  it("detects floor plan link", () => {
    const out = parseKvListing("https://www.kv.ee/12345", KV_HTML);
    expect(out.has_floor_plan).toBe(1);
  });
});

describe("parseCity24Listing", () => {
  it("extracts from city24 HTML", () => {
    const out = parseCity24Listing("https://www.city24.ee/et/kinnisvara/tartu/67890", CITY24_HTML);
    expect(out.portal).toBe("city24.ee");
    expect(out.listing_id).toBe("67890");
    expect(out.price_eur).toBe(220000);
    expect(out.area_m2).toBe(55);
    expect(out.rooms).toBe(2);
    expect(out.energy_class).toBe("C");
  });
});

describe("normalizeAddress", () => {
  it("lowercases, removes punctuation, hyphenates", () => {
    expect(normalizeAddress("Viljandi mnt 47, Nõmme, Tallinn")).toBe("viljandi-mnt-47-tallinn");
    expect(normalizeAddress("Pärnu mnt 28, Tallinn")).toBe("parnu-mnt-28-tallinn");
  });
});
