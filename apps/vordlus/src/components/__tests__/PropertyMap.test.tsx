import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PropertyMap from "@/components/PropertyMap";

const addTo = vi.fn();
const invalidateSize = vi.fn();
const setView = vi.fn();
const remove = vi.fn();
const map = vi.fn(() => ({ invalidateSize, remove, setView }));
const tileLayer = vi.fn(() => ({ addTo }));

vi.mock("leaflet", () => ({
  default: {
    map,
    tileLayer,
  },
}));

describe("PropertyMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders an interactive OpenStreetMap tile layer", async () => {
    render(<PropertyMap columns={[]} />);

    await waitFor(() => expect(map).toHaveBeenCalledOnce());
    expect(tileLayer).toHaveBeenCalledWith(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      expect.objectContaining({ maxZoom: 19 }),
    );
    expect(addTo).toHaveBeenCalled();
  });
});
