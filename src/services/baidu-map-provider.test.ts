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
});

function createContainer() {
  return {
    replaceChildren: vi.fn(),
  } as unknown as HTMLElement;
}

function createFakeApi() {
  const instances: FakeMap[] = [];
  const api = {
    Map: class extends FakeMap {
      constructor(container: HTMLElement) {
        super(container);
        instances.push(this);
      }
    },
    Point: class {
      constructor(
        readonly lng: number,
        readonly lat: number,
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
    instances,
  };
}

class FakeMap {
  private center = { lng: 0, lat: 0 };
  private zoom = 0;
  readonly destroy = vi.fn();
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
