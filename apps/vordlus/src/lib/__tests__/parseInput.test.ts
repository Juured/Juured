import { describe, it, expect } from "vitest";
import { parseUserInput, parsedLabel } from "../parseInput";

describe("parseUserInput", () => {
  describe("kv.ee URLs", () => {
    it("parses a bare kv.ee ID", () => {
      const r = parseUserInput("https://www.kv.ee/3995056");
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("kv.ee");
        expect(r.listingId).toBe("3995056");
        expect(r.address).toBeNull();
      }
    });

    it("parses a kv.ee slug URL into a street+city address", () => {
      const r = parseUserInput("https://www.kv.ee/3995056-tartu-mnt-47-nomme-tallinn");
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("kv.ee");
        expect(r.listingId).toBe("3995056");
        expect(r.address).toMatch(/Tartu/);
        expect(r.address).toMatch(/47/);
        expect(r.address).toMatch(/Tallinn/);
      }
    });

    it("parses a kv.ee URL with the /en/ prefix", () => {
      const r = parseUserInput("https://kv.ee/en/3995056-tartu-mnt-47");
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("kv.ee");
        expect(r.listingId).toBe("3995056");
      }
    });

    it("parses a new-layout /kinnisvara/<category>/<slug>-o-<id> kv.ee URL", () => {
      const r = parseUserInput(
        "https://www.kv.ee/kinnisvara/uusarendused/uus-hobemetsa-rehe-13-ja-rehe-poik-4-avalik-muuk-o-8089"
      );
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("kv.ee");
        expect(r.listingId).toBe("8089");
        // Noise ("uus", "hobemetsa", "ja", "avalik", "muuk") is stripped;
        // the second address ("rehe poik 4") is dropped; first numbered
        // address "Rehe 13" is what In-AKS will receive.
        expect(r.address).toBe("Rehe 13");
      }
    });
  });

  describe("kinnisvara24.ee URLs (legacy kv.ee domain)", () => {
    it("parses a bare kinnisvara24.ee ID and labels it as kinnisvara24.ee", () => {
      const r = parseUserInput("https://kinnisvara24.ee/3995056");
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("kinnisvara24.ee");
        expect(r.listingId).toBe("3995056");
      }
    });

    it("parses a kinnisvara24.ee slug URL", () => {
      const r = parseUserInput("https://www.kinnisvara24.ee/3995056-tartu-mnt-47-nomme-tallinn");
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("kinnisvara24.ee");
        expect(r.listingId).toBe("3995056");
        expect(r.address).toMatch(/Tallinn/);
      }
    });
  });

  describe("city24.ee URLs", () => {
    it("parses the Estonian city24.ee URL shape", () => {
      const r = parseUserInput("https://www.city24.ee/et/kinnisvara/korterid/tallinn/12345");
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("city24.ee");
        expect(r.listingId).toBe("12345");
        expect(r.address).toMatch(/Tallinn/);
      }
    });

    it("parses the English city24.ee URL shape", () => {
      const r = parseUserInput("https://www.city24.ee/en/real-estate/apartments-for-sale/tallinn/12345");
      expect(r.kind).toBe("kv-url");
      if (r.kind === "kv-url") {
        expect(r.portal).toBe("city24.ee");
        expect(r.listingId).toBe("12345");
        expect(r.address).toMatch(/Tallinn/);
      }
    });
  });

  describe("non-URL inputs", () => {
    it("parses a cadastral id", () => {
      const r = parseUserInput("78401:001:0215");
      expect(r.kind).toBe("tunnus");
      if (r.kind === "tunnus") expect(r.tunnus).toBe("78401:001:0215");
    });

    it("parses an EHR building id", () => {
      const r = parseUserInput("120221727");
      expect(r.kind).toBe("ehr");
      if (r.kind === "ehr") expect(r.ehrCode).toBe("120221727");
    });

    it("parses free text as an address", () => {
      const r = parseUserInput("Viljandi mnt 47, Tallinn");
      expect(r.kind).toBe("address");
      if (r.kind === "address") expect(r.address).toBe("Viljandi mnt 47, Tallinn");
    });

    it("parses an empty string", () => {
      expect(parseUserInput("").kind).toBe("empty");
      expect(parseUserInput("   ").kind).toBe("empty");
    });
  });

  describe("parsedLabel", () => {
    it("formats a kv-url with a slug as 'portal · address'", () => {
      const r = parseUserInput("https://www.kv.ee/3995056-tartu-mnt-47-nomme-tallinn");
      expect(parsedLabel(r)).toMatch(/kv\.ee/);
      expect(parsedLabel(r)).toMatch(/Tartu/);
    });

    it("formats a kv-url without a slug with an address hint", () => {
      const r = parseUserInput("https://www.kv.ee/3995056");
      const label = parsedLabel(r);
      expect(label).toMatch(/kv\.ee/);
      expect(label).toMatch(/3995056/);
    });
  });
});
