import { describe, expect, it, vi } from "vitest";

import { BaiduPoiSearchProvider } from "@/services/baidu-poi-search-provider";

describe("baidu poi search provider", () => {
  it("searches POIs within the selected city and returns plain DTOs", async () => {
    const fake = createFakePoiRuntime([
      {
        uid: "poi-1",
        title: "人民广场",
        address: "上海市黄浦区人民大道",
        city: "上海",
        point: { lng: 121.475, lat: 31.234 },
      },
    ]);
    const provider = new BaiduPoiSearchProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await expect(provider.search({ baiduAk: "test-ak", keyword: " 人民广场 ", scope: { type: "city", city: "上海" } })).resolves.toEqual([
      {
        id: "poi-1",
        name: "人民广场",
        address: "上海市黄浦区人民大道",
        city: "上海",
        lng: 121.475,
        lat: 31.234,
        source: "baidu",
      },
    ]);
    expect(fake.localSearches[0].location).toBe("上海");
    expect(fake.localSearches[0].search).toHaveBeenCalledWith("人民广场");
  });

  it("uses the national scope only after it is explicitly requested", async () => {
    const fake = createFakePoiRuntime([]);
    const provider = new BaiduPoiSearchProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.search({ baiduAk: "test-ak", keyword: "医院", scope: { type: "city", city: "杭州" } });
    await provider.search({ baiduAk: "test-ak", keyword: "医院", scope: { type: "national" } });

    expect(fake.localSearches.map((search) => search.location)).toEqual(["杭州", "全国"]);
  });

  it("fails clearly when AK or Baidu search runtime is unavailable", async () => {
    const provider = new BaiduPoiSearchProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => undefined,
    });

    await expect(provider.search({ baiduAk: null, keyword: "餐厅", scope: { type: "city", city: "上海" } })).rejects.toThrow("BAIDU_AK_MISSING");
    await expect(provider.search({ baiduAk: "test-ak", keyword: "餐厅", scope: { type: "city", city: "上海" } })).rejects.toThrow(
      "BAIDU_POI_SEARCH_UNAVAILABLE",
    );
  });

  it("turns Baidu non-success statuses into a stable failed state", async () => {
    const fake = createFakePoiRuntime([], 2);
    const provider = new BaiduPoiSearchProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await expect(provider.search({ baiduAk: "test-ak", keyword: "餐厅", scope: { type: "city", city: "上海" } })).rejects.toThrow(
      "BAIDU_POI_SEARCH_FAILED",
    );
  });
});

function createFakePoiRuntime(pois: FakePoi[], status = 0) {
  const localSearches: FakeLocalSearch[] = [];
  const api = {
    LocalSearch: class extends FakeLocalSearch {
      constructor(location: string, options: FakeLocalSearchOptions) {
        super(location, options, pois, status);
        localSearches.push(this);
      }
    },
  };

  return {
    runtime: { api },
    localSearches,
  };
}

interface FakePoi {
  uid?: string;
  title?: string;
  address?: string;
  city?: string;
  point?: { lng: number; lat: number };
}

interface FakeLocalSearchOptions {
  onSearchComplete: (results: FakePoiResultSet) => void;
  pageCapacity?: number;
}

class FakeLocalSearch {
  readonly search = vi.fn(() => {
    this.options.onSearchComplete(new FakePoiResultSet(this.pois, this.status));
  });

  constructor(
    readonly location: string,
    private readonly options: FakeLocalSearchOptions,
    private readonly pois: FakePoi[],
    private readonly status: number,
  ) {}

  getStatus() {
    return this.status;
  }
}

class FakePoiResultSet {
  constructor(
    private readonly pois: FakePoi[],
    private readonly status: number,
  ) {}

  getCurrentNumPois() {
    return this.pois.length;
  }

  getPoi(index: number) {
    return this.pois[index] ?? null;
  }

  getStatus() {
    return this.status;
  }
}
