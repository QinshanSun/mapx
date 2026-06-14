import { describe, expect, it, vi } from "vitest";

import { MockMapProvider } from "@/services/map-test-mocks";

describe("mock map provider test support", () => {
  it("simulates map loading failure without real Baidu network", async () => {
    const provider = new MockMapProvider({ initError: new Error("MOCK_MAP_LOAD_FAILED") });
    const container = {} as HTMLElement;

    await expect(provider.init(container, { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 })).rejects.toThrow(
      "MOCK_MAP_LOAD_FAILED",
    );
    expect(provider.calls).toEqual(["init"]);
    expect(provider.getView()).toBeNull();
  });

  it("drives GEO marker creation, selection, and drag flows with plain coordinates", async () => {
    const provider = new MockMapProvider();
    const onCreateMarker = vi.fn();
    const onSelectMarker = vi.fn();
    const onMarkerDragged = vi.fn();

    await provider.init({} as HTMLElement, { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([{ id: "marker-1", name: "客户点位", lng: 121.47, lat: 31.23, color: "#2563eb", icon: "Users" }]);
    provider.setMapClickHandler(onCreateMarker);
    provider.setMarkerClickHandler(onSelectMarker);
    provider.setMarkerDragHandler(onMarkerDragged);
    provider.setDraggableMarker("marker-1");

    provider.triggerMapClick({ lng: 121.5, lat: 31.25 });
    provider.triggerMarkerClick("marker-1");
    provider.triggerMarkerDrag("marker-1", { lng: 121.6, lat: 31.3 });

    expect(provider.markers).toHaveLength(1);
    expect(provider.draggableMarkerId).toBe("marker-1");
    expect(onCreateMarker).toHaveBeenCalledWith({ lng: 121.5, lat: 31.25 });
    expect(onSelectMarker).toHaveBeenCalledWith("marker-1");
    expect(onMarkerDragged).toHaveBeenCalledWith("marker-1", { lng: 121.6, lat: 31.3 });
  });
});
