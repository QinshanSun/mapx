import { describe, expect, it, vi } from "vitest";

import { BaiduMapProvider } from "@/services/baidu-map-provider";

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

function createFakeApi() {
  const instances: FakeMap[] = [];
  const icons: FakeIcon[] = [];
  const markers: FakeMarker[] = [];
  const api = {
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
      normalMapType: "normal-map-type",
      satelliteMapType: "satellite-map-type",
    },
    icons,
    instances,
    markers,
  };
}

class FakeMap {
  private center = { lng: 0, lat: 0 };
  private zoom = 0;
  readonly addOverlay = vi.fn();
  readonly destroy = vi.fn();
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

  readonly addEventListener = vi.fn((eventName: string, handler: () => void) => {
    if (eventName === "click") {
      this.clickHandler = handler;
    }
  });
  readonly setTitle = vi.fn();
  readonly setZIndex = vi.fn();

  constructor(
    readonly point: { lng: number; lat: number },
    readonly options?: { icon?: unknown },
  ) {}

  triggerClick() {
    this.clickHandler?.();
  }
}
