import { describe, expect, it } from "vitest";

import { BaiduPoiSearchProvider } from "@/services/baidu-poi-search-provider";
import { createMockPoiSearchRuntime } from "@/services/map-test-mocks";

describe("baidu poi search provider", () => {
  it("searches POIs within the selected city and returns plain DTOs", async () => {
    const fake = createMockPoiSearchRuntime([
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
    expect(fake.localSearches[0].searchedKeywords).toEqual(["人民广场"]);
  });

  it("expands national scope by searching supported cities only after it is explicitly requested", async () => {
    const fake = createMockPoiSearchRuntime([
      {
        uid: "hospital-1",
        title: "城市医院",
        address: "测试路 1 号",
        city: "测试城市",
        point: { lng: 121, lat: 31 },
      },
    ]);
    const provider = new BaiduPoiSearchProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await provider.search({ baiduAk: "test-ak", keyword: "医院", scope: { type: "city", city: "杭州" } });
    await provider.search({ baiduAk: "test-ak", keyword: "医院", scope: { type: "national" }, pageSize: 1 });

    expect(fake.localSearches.map((search) => search.location)).toEqual(["杭州", "上海"]);
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
    const fake = createMockPoiSearchRuntime([], 2);
    const provider = new BaiduPoiSearchProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await expect(provider.search({ baiduAk: "test-ak", keyword: "餐厅", scope: { type: "city", city: "上海" } })).rejects.toThrow(
      "BAIDU_POI_SEARCH_FAILED",
    );
  });
});
