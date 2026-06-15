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
    expect(fake.markers[0].setTitle).toHaveBeenCalledWith("客户点位");
    expect(fake.icons[0].url).toContain(encodeURIComponent("#2563eb"));

    provider.setMarkers([{ id: "marker-3", name: "门店点位", lng: 121.49, lat: 31.25, color: "#16a34a", icon: "Store" }]);

    expect(fake.instances[0].removeOverlay).toHaveBeenCalledTimes(2);
    expect(fake.instances[0].addOverlay).toHaveBeenCalledTimes(3);
  });

  it("emits plain marker ids when Baidu markers are clicked", async () => {
    const fake = createFakeApi();
    const onSelectMarker = vi.fn();
    const provider = new BaiduMapProvider("test-ak", {
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    provider.setMarkerClickHandler(onSelectMarker);
    await provider.init(createContainer(), { center: { lng: 121.4737, lat: 31.2304 }, zoom: 12 });
    provider.setMarkers([{ id: "marker-1", name: "客户点位", lng: 121.47, lat: 31.23, color: "#2563eb", icon: "Users" }]);

    fake.markers[0].triggerClick();

    expect(onSelectMarker).toHaveBeenCalledWith("marker-1");
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
  return {
    replaceChildren: vi.fn(),
  } as unknown as HTMLElement;
}

function createFakeApi(options: { geolocationResult?: { point?: { lng: number; lat: number } }; geolocationStatus?: number } = {}) {
  const instances: FakeMap[] = [];
  const geolocations: FakeGeolocation[] = [];
  const icons: FakeIcon[] = [];
  const markers: FakeMarker[] = [];
  const api = {
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
    Point: class {
      constructor(
        readonly lng: number,
        readonly lat: number,
      ) {}
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
    runtime: {
      api,
      geolocationSuccessStatus: 0,
      normalMapType: "normal-map-type",
      satelliteMapType: "satellite-map-type",
    },
    geolocations,
    icons,
    instances,
    markers,
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
  private clickHandler: ((event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) | null = null;
  private zoom = 0;
  readonly addEventListener = vi.fn((eventName: string, handler: (event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) => {
    if (eventName === "click") {
      this.clickHandler = handler;
    }
  });
  readonly addOverlay = vi.fn();
  readonly destroy = vi.fn();
  readonly enableScrollWheelZoom = vi.fn();
  readonly removeOverlay = vi.fn();
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
    this.clickHandler?.(event);
  }
}

class FakeIcon {
  constructor(
    readonly url: string,
    readonly size: unknown,
    readonly options?: unknown,
  ) {}
}

class FakeMarker {
  private clickHandler: (() => void) | null = null;
  private dragEndHandler: ((event?: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) | null = null;

  readonly addEventListener = vi.fn((eventName: string, handler: (event?: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) => void) => {
    if (eventName === "click") {
      this.clickHandler = () => handler();
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
    readonly options?: { icon?: unknown },
  ) {}

  triggerClick() {
    this.clickHandler?.();
  }

  triggerDragEnd(event: { latlng?: { lng: number; lat: number }; point?: { lng: number; lat: number } }) {
    this.dragEndHandler?.(event);
  }

  getPosition() {
    return this.point;
  }
}
