import { describe, expect, it } from "vitest";

import { buildPoiPreview, cancelPoiPreview, replacePoiPreview } from "@/services/poi-preview";
import type { BaiduPoiResult } from "@/services/baidu-poi-search-provider";

describe("poi preview state", () => {
  it("builds a temporary map preview from a Baidu POI without creating marker data", () => {
    expect(buildPoiPreview(buildPoi({ id: "poi-1", name: "人民广场" }))).toEqual({
      id: "poi-1",
      name: "人民广场",
      lng: 121.475,
      lat: 31.234,
      address: "上海市黄浦区人民大道",
      city: "上海",
      source: "baidu",
    });
  });

  it("does not preview Baidu results without coordinates", () => {
    expect(buildPoiPreview(buildPoi({ lng: null, lat: null }))).toBeNull();
  });

  it("can replace and cancel the active preview", () => {
    const firstPreview = buildPoiPreview(buildPoi({ id: "poi-1", name: "人民广场" }));
    const nextPreview = replacePoiPreview(firstPreview, buildPoi({ id: "poi-2", name: "上海站", lng: 121.455, lat: 31.249 }));

    expect(nextPreview?.id).toBe("poi-2");
    expect(cancelPoiPreview()).toBeNull();
  });
});

function buildPoi(overrides: Partial<BaiduPoiResult>): BaiduPoiResult {
  return {
    id: "poi-1",
    name: "人民广场",
    address: "上海市黄浦区人民大道",
    city: "上海",
    lng: 121.475,
    lat: 31.234,
    source: "baidu",
    ...overrides,
  };
}
