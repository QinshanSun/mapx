import { describe, expect, it, vi } from "vitest";

import { BaiduMapProvider } from "@/services/baidu-map-provider";
import { MAX_MAP_ZOOM, MIN_MAP_ZOOM } from "@/services/map-provider";

describe("baidu map provider", () => {
  it("initializes the map at the requested view", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });
    const container = createContainer();

    await provider.init(container, { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });

    expect(fake.instances).toHaveLength(1);
    expect(fake.instances[0].centerAndZoom).toHaveBeenCalledWith({ lng: 121.4737, lat: 31.2304 }, 12);
    expect(provider.getView()).toEqual({ center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
  });

  it("supports setView and getView with plain MapX objects", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 120.1551, lat: 30.2741 }, zoom: 12 });
    provider.setView({ center: { lng: 116.4074, lat: 39.9042 }, zoom: 10 });

    expect(provider.getView()).toEqual({ center: { lng: 116.4074, lat: 39.9042 }, zoom: 10 });
  });

  it("enables wheel zoom and adjusts zoom without exposing Baidu objects", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });

    expect(fake.instances[0].enableScrollWheelZoom).toHaveBeenCalledWith(true);
    expect(provider.zoomBy(1)).toEqual({ center: { lng: 121.4737, lat: 31.2304 }, zoom: 13 });
    expect(provider.getView()).toEqual({ center: { lng: 121.4737, lat: 31.2304 }, zoom: 13 });
    expect(fake.instances[0].centerAndZoom).toHaveBeenLastCalledWith({ lng: 121.4737, lat: 31.2304 }, 13);
  });

  it("clamps provider zoom changes to the supported map range", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: MAX_MAP_ZOOM });

    expect(provider.zoomBy(1)?.zoom).toBe(MAX_MAP_ZOOM);
    provider.setView({ center: { lng: 121.4737, lat: 31.2304 }, zoom: MIN_MAP_ZOOM });
    expect(provider.zoomBy(-1)?.zoom).toBe(MIN_MAP_ZOOM);
  });

  it("locates the current position and moves the map with plain coordinates", async () => {
    const fake = createFakeApi({ geolocationResult: { point: { lng: 121.501, lat: 31.221 } }, geolocationStatus: 0 });
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    await expect(provider.locateCurrentPosition()).resolves.toEqual({ lng: 121.501, lat: 31.221 });

    expect(fake.geolocations).toHaveLength(1);
    expect(fake.geolocations[0].getCurrentPosition).toHaveBeenCalledWith(expect.any(Function), {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    });
    expect(provider.getView()).toEqual({ center: { lng: 121.501, lat: 31.221 }, zoom: 16 });
  });

  it("fails locate-me without crashing when Baidu returns no usable point", async () => {
    const fake = createFakeApi({ geolocationResult: {}, geolocationStatus: 1 });
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });

    await expect(provider.locateCurrentPosition()).rejects.toThrow("MAP_LOCATION_FAILED");
    expect(provider.getView()).toEqual({ center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
  });

  it("destroys the previous map before reinitializing", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });
    const container = createContainer();

    await provider.init(container, { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    const firstMap = fake.instances[0];

    await provider.init(container, { center: { lng: 113.2644, lat: 23.1291 }, zoom: 11 });

    expect(firstMap.destroy).toHaveBeenCalledTimes(1);
    expect(container.replaceChildren).toHaveBeenCalledTimes(1);
    expect(fake.instances).toHaveLength(2);
    expect(provider.getView()).toEqual({ center: { lng: 113.2644, lat: 23.1291 }, zoom: 11 });
  });

  it("keeps MapX teardown stable when Baidu destroy throws", async () => {
    const fake = createFakeApi();
    const container = createContainer();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(container, { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    fake.instances[0].destroy.mockImplementationOnce(() => {
      throw new Error("clearData failed");
    });

    expect(() => provider.destroy()).not.toThrow();
    expect(container.replaceChildren).toHaveBeenCalledTimes(1);
    expect(provider.getView()).toBeNull();
  });

  it("does not create a map if destroyed while the script is loading", async () => {
    const fake = createFakeApi();
    let resolveLoad!: (result: { status: "loaded" }) => void;
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () =>
        new Promise((resolve) => {
          resolveLoad = resolve;
        }),
      getGlobal: () => fake.runtime,
    });
    const loading = provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });

    provider.destroy();
    resolveLoad({ status: "loaded" });
    await loading;

    expect(fake.instances).toHaveLength(0);
    expect(provider.getView()).toBeNull();
  });

  it("throws when the script loader cannot load Baidu Maps", async () => {
    const provider = new BaiduMapProvider("bad-ak", {
      loadScript: () => Promise.resolve({ status: "failed", code: "BAIDU_MAP_LOAD_FAILED" }),
      getGlobal: () => createFakeApi().runtime,
    });

    await expect(provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 })).rejects.toThrow(
      "BAIDU_MAP_LOAD_FAILED",
    );
  });

  it("switches between normal and satellite map layers without exposing Baidu objects", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setLayer("satellite");

    expect(fake.instances[0].setMapType).toHaveBeenLastCalledWith("satellite-map-type");
    expect(provider.getLayer()).toBe("satellite");

    provider.setLayer("normal");

    expect(fake.instances[0].setMapType).toHaveBeenLastCalledWith("normal-map-type");
    expect(provider.getLayer()).toBe("normal");
  });

  it("renders project markers with category style as Baidu overlays", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([
      { id: "marker-1", name: "客户点位", lng: 121.47, lat: 31.23, color: "#2563eb", icon: "Users" },
      { id: "marker-2", name: "仓库点位", lng: 121.48, lat: 31.24, color: "#f59e0b", icon: "Warehouse" },
    ]);

    expect(fake.instances[0].addOverlay).toHaveBeenCalledTimes(2);
    expect(fake.markers).toHaveLength(2);
    expect(fake.markers[0].point).toEqual({ lng: 121.47, lat: 31.23 });
    expect(fake.markers[0].options?.enableClicking).toBe(true);
    expect(fake.markers[0].setTitle).toHaveBeenCalledWith("客户点位");
    expect(fake.icons[0].url).toContain(encodeURIComponent("#2563eb"));
    expect(decodeIconSvg(fake.icons[0])).toContain('stroke="#ffffff"');
    expect(decodeIconSvg(fake.icons[0])).not.toContain(">US<");
    expect(decodeIconSvg(fake.icons[0])).not.toContain(">MP<");

    provider.setMarkers([{ id: "marker-3", name: "门店点位", lng: 121.49, lat: 31.25, color: "#16a34a", icon: "Store" }]);

    expect(fake.instances[0].removeOverlay).toHaveBeenCalledTimes(2);
    expect(fake.instances[0].addOverlay).toHaveBeenCalledTimes(3);
  });

  it("falls back to a MapPin icon path for unknown marker icon names", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([{ id: "marker-1", name: "未知图标点位", lng: 121.47, lat: 31.23, color: "#64748b", icon: "UnknownIcon" }]);

    const svg = decodeIconSvg(fake.icons[0]);
    expect(svg).toContain('circle cx="12" cy="10" r="2"');
    expect(svg).not.toContain("UnknownIcon");
  });

  it("shows transparent marker labels only when selected or zoomed in", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([{ id: "marker-1", name: "静安项目点位", lng: 121.47, lat: 31.23, color: "#2563eb", icon: "MapPin" }]);

    expect(decodeIconSvg(lastIcon(fake.icons))).not.toContain("静安项目点位");

    provider.setSelectedMarker("marker-1");

    expect(decodeIconSvg(lastIcon(fake.icons))).toContain("静安项目点位");
    expect(decodeIconSvg(lastIcon(fake.icons))).toContain('fill="#0f172a"');
    expect(decodeIconSvg(lastIcon(fake.icons))).toContain('stroke="#ffffff"');
    expect(decodeIconSvg(lastIcon(fake.icons))).not.toContain("<rect");

    provider.setSelectedMarker(null);
    fake.instances[0].triggerZoomEnd(16);

    expect(decodeIconSvg(lastIcon(fake.icons))).toContain("静安项目点位");
  });

  it("emits plain marker ids when Baidu markers are clicked", async () => {
    const fake = createFakeApi();
    const onSelectMarker = vi.fn();
    const domEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() };
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    provider.setMarkerClickHandler(onSelectMarker);
    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([{ id: "marker-1", name: "客户点位", lng: 121.47, lat: 31.23, color: "#2563eb", icon: "Users" }]);

    fake.markers[0].triggerClick({ domEvent });

    expect(onSelectMarker).toHaveBeenCalledWith("marker-1");
    expect(domEvent.preventDefault).toHaveBeenCalledTimes(1);
    expect(domEvent.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("only enables dragging for the requested marker and emits plain drag coordinates", async () => {
    const fake = createFakeApi();
    const onMarkerDragged = vi.fn();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    provider.setMarkerDragHandler(onMarkerDragged);
    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([
      { id: "marker-1", name: "客户点位", lng: 121.47, lat: 31.23, color: "#2563eb", icon: "Users" },
      { id: "marker-2", name: "仓库点位", lng: 121.48, lat: 31.24, color: "#f59e0b", icon: "Warehouse" },
    ]);

    expect(fake.markers[0].enableDragging).not.toHaveBeenCalled();
    expect(fake.markers[1].enableDragging).not.toHaveBeenCalled();

    provider.setDraggableMarker("marker-2");
    fake.markers[3].triggerDragEnd({ point: { lng: 121.51, lat: 31.26 } });

    expect(fake.markers[2].enableDragging).not.toHaveBeenCalled();
    expect(fake.markers[3].enableDragging).toHaveBeenCalledTimes(1);
    expect(onMarkerDragged).toHaveBeenCalledWith("marker-2", { lng: 121.51, lat: 31.26 });

    provider.setDraggableMarker(null);

    expect(fake.markers[4].enableDragging).not.toHaveBeenCalled();
    expect(fake.markers[5].enableDragging).not.toHaveBeenCalled();
  });

  it("emits plain coordinates only after a map click handler is registered", async () => {
    const fake = createFakeApi();
    const onCreateMarker = vi.fn();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    fake.instances[0].triggerClick({ latlng: { lng: 121.5, lat: 31.25 } });

    expect(onCreateMarker).not.toHaveBeenCalled();

    provider.setMapClickHandler(onCreateMarker);
    fake.instances[0].triggerClick({ latlng: { lng: 121.5, lat: 31.25 } });

    expect(onCreateMarker).toHaveBeenCalledWith({ lng: 121.5, lat: 31.25 });

    provider.setMapClickHandler(null);
    fake.instances[0].triggerClick({ latlng: { lng: 121.6, lat: 31.26 } });

    expect(onCreateMarker).toHaveBeenCalledTimes(1);
  });

  it("renders the selected marker with selected styling", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([
      { id: "marker-1", name: "客户点位", lng: 121.47, lat: 31.23, color: "#2563eb", icon: "Users" },
      { id: "marker-2", name: "仓库点位", lng: 121.48, lat: 31.24, color: "#f59e0b", icon: "Warehouse" },
    ]);
    provider.setSelectedMarker("marker-2");

    expect(fake.instances[0].removeOverlay).toHaveBeenCalledTimes(2);
    expect(fake.markers[3].setZIndex).toHaveBeenCalledWith(20);
    expect(fake.icons.some((icon) => icon.url.includes(encodeURIComponent("#0f172a")))).toBe(true);
  });

  it("renders, replaces, and clears a temporary Baidu POI preview overlay", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setPoiPreview({
      id: "poi-1",
      name: "人民广场",
      lng: 121.475,
      lat: 31.234,
      address: "上海市黄浦区人民大道",
      city: "上海",
      source: "baidu",
    });

    expect(fake.instances[0].addOverlay).toHaveBeenCalledTimes(1);
    expect(fake.markers[0].point).toEqual({ lng: 121.475, lat: 31.234 });
    expect(fake.markers[0].setTitle).toHaveBeenCalledWith("人民广场");
    expect(fake.instances[0].centerAndZoom).toHaveBeenLastCalledWith({ lng: 121.475, lat: 31.234 }, 15);

    provider.setPoiPreview({
      id: "poi-2",
      name: "上海站",
      lng: 121.455,
      lat: 31.249,
      address: "上海市静安区秣陵路",
      city: "上海",
      source: "baidu",
    });

    expect(fake.instances[0].removeOverlay).toHaveBeenCalledTimes(1);
    expect(fake.instances[0].addOverlay).toHaveBeenCalledTimes(2);
    expect(fake.markers[1].point).toEqual({ lng: 121.455, lat: 31.249 });

    provider.setPoiPreview(null);

    expect(fake.instances[0].removeOverlay).toHaveBeenCalledTimes(2);
  });

  it("draws distance measurements inside the provider boundary and emits plain measurement data", async () => {
    const fake = createFakeApi();
    const onPointAdded = vi.fn();
    const onCompleted = vi.fn();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    await expect(provider.startDistanceMeasurement({ onPointAdded, onCompleted })).resolves.toEqual({ status: "ready" });

    expect(fake.instances[0].disableDoubleClickZoom).toHaveBeenCalledTimes(1);

    fake.instances[0].triggerClick({ latlng: { lng: 121.48, lat: 31.24 } });
    fake.instances[0].triggerClick({ latlng: { lng: 121.49, lat: 31.25 } });
    fake.instances[0].triggerDoubleClick({ latlng: { lng: 121.49, lat: 31.25 } });

    expect(onPointAdded).toHaveBeenCalledWith({ point: { lng: 121.48, lat: 31.24 }, index: 0, totalDistanceMeters: 0 });
    expect(onCompleted).toHaveBeenCalledWith({
      points: [
        { lng: 121.48, lat: 31.24 },
        { lng: 121.49, lat: 31.25 },
      ],
      totalDistanceMeters: 1000,
    });
    expect(fake.polylines).toHaveLength(1);
    expect(fake.circles).toHaveLength(3);
    expect(fake.labels[0].text).toBe("1.00 km");
    expect(fake.instances[0].removeEventListener).toHaveBeenCalledWith("click", expect.any(Function));
    expect(fake.instances[0].removeEventListener).toHaveBeenCalledWith("dblclick", expect.any(Function));
    expect(fake.instances[0].enableDoubleClickZoom).toHaveBeenCalledTimes(1);
  });

  it("falls back to provider-owned DOM events when Baidu map click events are unavailable", async () => {
    const fake = createFakeApi();
    const onPointAdded = vi.fn();
    const onCompleted = vi.fn();
    const container = createContainer();
    container.getBoundingClientRect = vi.fn(() => ({
      bottom: 720,
      height: 720,
      left: 10,
      right: 970,
      top: 20,
      width: 960,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }));
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(container, { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    await provider.startDistanceMeasurement({ onPointAdded, onCompleted });

    container.dispatchEvent(createMouseEvent("click", 1215, 332));
    container.dispatchEvent(createMouseEvent("click", 1220, 334));
    container.dispatchEvent(createMouseEvent("dblclick", 1220, 334));

    expect(fake.instances[0].pixelToPoint).toHaveBeenCalledWith({ x: 1205, y: 312 });
    expect(onPointAdded).toHaveBeenCalledWith({ point: { lng: 20.5, lat: 31.2 }, index: 0, totalDistanceMeters: 0 });
    expect(onCompleted).toHaveBeenCalledWith({
      points: [
        { lng: 20.5, lat: 31.2 },
        { lng: 21, lat: 31.4 },
      ],
      totalDistanceMeters: 1000,
    });
  });

  it("draws a live preview segment from the last measurement point to the cursor", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    await provider.startDistanceMeasurement({});

    fake.instances[0].triggerClick({ latlng: { lng: 121.48, lat: 31.24 } });
    fake.instances[0].triggerMouseMove({ latlng: { lng: 121.485, lat: 31.245 } });

    expect(fake.polylines[fake.polylines.length - 1]).toMatchObject({
      points: [
        { lng: 121.48, lat: 31.24 },
        { lng: 121.485, lat: 31.245 },
      ],
      options: {
        strokeColor: "#2563eb",
        strokeOpacity: 0.46,
        strokeStyle: "dashed",
        strokeWeight: 2,
      },
    });

    fake.instances[0].triggerMouseMove({ latlng: { lng: 121.49, lat: 31.25 } });
    expect(fake.instances[0].removeOverlay).toHaveBeenCalledWith(fake.polylines[fake.polylines.length - 2]);
    expect(fake.polylines[fake.polylines.length - 1].points).toEqual([
      { lng: 121.48, lat: 31.24 },
      { lng: 121.49, lat: 31.25 },
    ]);

    const latestPreviewLine = fake.polylines[fake.polylines.length - 1];
    fake.instances[0].triggerClick({ latlng: { lng: 121.49, lat: 31.25 } });
    expect(fake.instances[0].removeOverlay).toHaveBeenCalledWith(latestPreviewLine);
  });

  it("renders saved measurements as weak map overlays and supports selecting them", async () => {
    const fake = createFakeApi();
    const onMeasurementClick = vi.fn();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMeasurementClickHandler(onMeasurementClick);
    provider.setMeasurements([
      {
        id: "measurement-1",
        name: "园区边界",
        points: [
          { lng: 121.48, lat: 31.24 },
          { lng: 121.49, lat: 31.25 },
        ],
        totalDistanceMeters: 1000,
      },
    ]);

    expect(fake.polylines[0]?.options).toMatchObject({
      strokeColor: "#475569",
      strokeOpacity: 0.42,
      strokeStyle: "dashed",
      strokeWeight: 2,
    });

    fake.polylines[0]?.triggerClick({ latlng: { lng: 121.48, lat: 31.24 } });
    expect(onMeasurementClick).toHaveBeenCalledWith("measurement-1");

    provider.setSelectedMeasurement("measurement-1");

    expect(fake.polylines[fake.polylines.length - 1]?.options).toMatchObject({
      strokeColor: "#2563eb",
      strokeOpacity: 0.82,
      strokeStyle: "solid",
      strokeWeight: 4,
    });
    expect(fake.labels[fake.labels.length - 1]?.text).toBe("园区边界 · 1.00 km");
  });

  it("does not emit a savable measurement when drawing ends with fewer than two points", async () => {
    const fake = createFakeApi();
    const onCompleted = vi.fn();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    await provider.startDistanceMeasurement({ onCompleted });

    fake.instances[0].triggerClick({ latlng: { lng: 121.48, lat: 31.24 } });
    fake.instances[0].triggerDoubleClick({ latlng: { lng: 121.48, lat: 31.24 } });

    expect(onCompleted).toHaveBeenCalledWith(null);
    expect(fake.instances[0].removeOverlay).toHaveBeenCalledTimes(1);
  });

  it("cleans measurement overlays without emitting completion when stopped by MapX", async () => {
    const fake = createFakeApi();
    const onCompleted = vi.fn();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    await provider.startDistanceMeasurement({ onCompleted });
    fake.instances[0].triggerClick({ latlng: { lng: 121.48, lat: 31.24 } });
    fake.instances[0].triggerClick({ latlng: { lng: 121.49, lat: 31.25 } });
    provider.stopDistanceMeasurement();

    expect(onCompleted).not.toHaveBeenCalled();
    expect(fake.instances[0].removeOverlay).toHaveBeenCalledTimes(5);
    expect(fake.instances[0].enableDoubleClickZoom).toHaveBeenCalledTimes(1);
  });

  it("returns a structured failure when measurement drawing is unavailable", async () => {
    const fake = createFakeApi();
    (fake.api as unknown as { Polyline?: unknown }).Polyline = undefined;
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });

    await expect(provider.startDistanceMeasurement({})).resolves.toEqual({
      status: "failed",
      code: "MAP_DISTANCE_TOOL_UNAVAILABLE",
      message: "百度地图折线工具不可用",
    });
  });

  it("keeps one thousand marker rendering inside the provider boundary", async () => {
    const fake = createFakeApi();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers(
      Array.from({ length: 1000 }, (_, index) => ({
        id: `marker-${index}`,
        name: `测试点位 ${index}`,
        lng: 121.35 + (index % 20) * 0.01,
        lat: 31.1 + Math.floor(index / 20) * 0.004,
        color: "#2563eb",
        icon: "Users",
      })),
    );

    expect(fake.instances[0].addOverlay).toHaveBeenCalledTimes(1000);
    expect(fake.icons).toHaveLength(1);
  });
});

function createContainer() {
  const listeners = new Map<string, Array<(event: Event) => void>>();

  const container = {
    addEventListener: vi.fn((eventName: string, handler: (event: Event) => void) => {
      listeners.set(eventName, [...(listeners.get(eventName) ?? []), handler]);
    }),
    dispatchEvent: vi.fn((event: Event) => {
      for (const handler of listeners.get(event.type) ?? []) {
        handler(event);
      }
      return true;
    }),
    getBoundingClientRect: vi.fn(() => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })),
    removeEventListener: vi.fn((eventName: string, handler: (event: Event) => void) => {
      listeners.set(
        eventName,
        (listeners.get(eventName) ?? []).filter((currentHandler) => currentHandler !== handler),
      );
    }),
    replaceChildren: vi.fn(),
  };

  return container as unknown as HTMLElement;
}

function createMouseEvent(type: string, clientX: number, clientY: number) {
  return {
    clientX,
    clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    type,
  } as unknown as Event;
}

function createFakeApi(options: { geolocationResult?: { point?: { lng: number; lat: number } }; geolocationStatus?: number } = {}) {
  const instances: FakeMap[] = [];
  const circles: FakeCircle[] = [];
  const geolocations: FakeGeolocation[] = [];
  const icons: FakeIcon[] = [];
  const labels: FakeLabel[] = [];
  const markers: FakeMarker[] = [];
  const polylines: FakePolyline[] = [];
  const api = {
    Circle: class extends FakeCircle {
      constructor(point: { lng: number; lat: number }, radius: number, options?: unknown) {
        super(point, radius, options);
        circles.push(this);
      }
    },
    Geolocation: class extends FakeGeolocation {
      constructor() {
        super(options.geolocationResult ?? { point: { lng: 121.4737, lat: 31.2304 } }, options.geolocationStatus ?? 0);
        geolocations.push(this);
      }
    },
    Icon: class extends FakeIcon {
      constructor(url: string, size: unknown, options?: unknown) {
        super(url, size, options);
        icons.push(this);
      }
    },
    Label: class extends FakeLabel {
      constructor(text: string, options?: unknown) {
        super(text, options);
        labels.push(this);
      }
    },
    Map: class extends FakeMap {
      constructor(container: HTMLElement) {
        super(container);
        instances.push(this);
      }
    },
    Marker: class extends FakeMarker {
      constructor(point: { lng: number; lat: number }, options?: { icon?: unknown }) {
        super(point, options);
        markers.push(this);
      }
    },
    Pixel: class {
      constructor(
        readonly x: number,
        readonly y: number,
      ) {}
    },
    Point: class {
      constructor(
        readonly lng: number,
        readonly lat: number,
      ) {}
    },
    Polyline: class extends FakePolyline {
      constructor(points: Array<{ lng: number; lat: number }>, options?: unknown) {
        super(points, options);
        polylines.push(this);
      }
    },
    Size: class {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {}
    },
  };

  return {
    api,
    circles,
    runtime: {
      api,
      geolocationSuccessStatus: 0,
      normalMapType: "normal-map-type",
      satelliteMapType: "satellite-map-type",
    },
    geolocations,
    icons,
    instances,
    labels,
    markers,
    polylines,
  };
}

class FakeGeolocation {
  readonly getCurrentPosition = vi.fn((callback: (result?: { point?: { lng: number; lat: number } }) => void) => {
    callback(this.result);
  });

  constructor(
    private readonly result: { point?: { lng: number; lat: number } },
    private readonly status: number,
  ) {}

  getStatus() {
    return this.status;
  }
}

class FakeMap {
  private center = { lng: 0, lat: 0 };
  private clickHandlers: Array<(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void> = [];
  private doubleClickHandlers: Array<(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void> = [];
  private mouseMoveHandlers: Array<(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void> = [];
  private zoomEndHandler: (() => void) | null = null;
  private zoom = 0;
  readonly addEventListener = vi.fn((eventName: string, handler: (event?: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) => {
    if (eventName === "click") {
      this.clickHandlers.push(handler as (event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void);
    }

    if (eventName === "dblclick") {
      this.doubleClickHandlers.push(handler as (event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void);
    }

    if (eventName === "mousemove") {
      this.mouseMoveHandlers.push(handler as (event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void);
    }

    if (eventName === "zoomend") {
      this.zoomEndHandler = () => handler();
    }
  });
  readonly addOverlay = vi.fn();
  readonly disableDoubleClickZoom = vi.fn();
  readonly destroy = vi.fn();
  readonly enableDoubleClickZoom = vi.fn();
  readonly enableScrollWheelZoom = vi.fn();
  readonly getDistance = vi.fn(() => 1000);
  readonly pixelToPoint = vi.fn((pixel: { x: number; y: number }) => ({ lng: (pixel.x - 1000) / 10, lat: pixel.y / 10 }));
  readonly removeOverlay = vi.fn();
  readonly removeEventListener = vi.fn((eventName: string, handler: (event?: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) => {
    if (eventName === "click") {
      this.clickHandlers = this.clickHandlers.filter((currentHandler) => currentHandler !== handler);
    }

    if (eventName === "dblclick") {
      this.doubleClickHandlers = this.doubleClickHandlers.filter((currentHandler) => currentHandler !== handler);
    }

    if (eventName === "mousemove") {
      this.mouseMoveHandlers = this.mouseMoveHandlers.filter((currentHandler) => currentHandler !== handler);
    }
  });
  readonly setMapType = vi.fn();
  readonly centerAndZoom = vi.fn((point: { lng: number; lat: number }, zoom: number) => {
    this.center = { lng: point.lng, lat: point.lat };
    this.zoom = zoom;
  });

  constructor(readonly container: HTMLElement) {}

  getCenter() {
    return this.center;
  }

  getZoom() {
    return this.zoom;
  }

  triggerClick(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) {
    for (const handler of this.clickHandlers) {
      handler(event);
    }
  }

  triggerDoubleClick(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) {
    for (const handler of this.doubleClickHandlers) {
      handler(event);
    }
  }

  triggerMouseMove(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) {
    for (const handler of this.mouseMoveHandlers) {
      handler(event);
    }
  }

  triggerZoomEnd(zoom: number) {
    this.zoom = zoom;
    this.zoomEndHandler?.();
  }
}

class FakeIcon {
  constructor(
    readonly url: string,
    readonly size: unknown,
    readonly options?: unknown,
  ) {}
}

class FakeCircle {
  constructor(
    readonly point: { lng: number; lat: number },
    readonly radius: number,
    readonly options?: unknown,
  ) {}
}

class FakeLabel {
  constructor(
    readonly text: string,
    readonly options?: unknown,
  ) {}
}

class FakePolyline {
  private clickHandler: ((event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) | null = null;

  constructor(
    readonly points: Array<{ lng: number; lat: number }>,
    readonly options?: unknown,
  ) {}

  addEventListener(eventName: string, handler: (event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) {
    if (eventName === "click") {
      this.clickHandler = handler;
    }
  }

  triggerClick(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) {
    this.clickHandler?.(event);
  }
}

function decodeIconSvg(icon: FakeIcon | undefined) {
  if (!icon) {
    throw new Error("Missing fake icon");
  }

  return decodeURIComponent(icon.url.replace("data:image/svg+xml;charset=UTF-8,", ""));
}

function lastIcon(icons: FakeIcon[]) {
  return icons[icons.length - 1];
}

interface FakeMapEvent {
  domEvent?: {
    preventDefault?: () => void;
    stopPropagation?: () => void;
  };
  latlng?: { lng: number; lat: number };
  point?: { lng: number; lat: number };
}

class FakeMarker {
  private clickHandler: ((event?: FakeMapEvent) => void) | null = null;
  private dragEndHandler: ((event?: FakeMapEvent) => void) | null = null;

  readonly addEventListener = vi.fn((eventName: string, handler: (event?: FakeMapEvent) => void) => {
    if (eventName === "click") {
      this.clickHandler = (event?: FakeMapEvent) => handler(event);
    }

    if (eventName === "dragend") {
      this.dragEndHandler = handler;
    }
  });
  readonly disableDragging = vi.fn();
  readonly enableDragging = vi.fn();
  readonly setTitle = vi.fn();
  readonly setZIndex = vi.fn();

  constructor(
    readonly point: { lng: number; lat: number },
    readonly options?: { enableClicking?: boolean; icon?: unknown },
  ) {}

  triggerClick(event?: FakeMapEvent) {
    this.clickHandler?.(event);
  }

  triggerDragEnd(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) {
    this.dragEndHandler?.(event);
  }

  getPosition() {
    return this.point;
  }
}
