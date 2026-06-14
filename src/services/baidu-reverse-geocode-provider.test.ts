import { describe, expect, it, vi } from "vitest";

import { BaiduReverseGeocodeProvider, getReverseGeocodeErrorMessage } from "@/services/baidu-reverse-geocode-provider";

describe("baidu reverse geocode provider", () => {
  it("returns a plain address DTO from Baidu reverse geocoding", async () => {
    const fake = createFakeReverseGeocodeRuntime({
      address: "上海市黄浦区人民大道",
      addressComponents: { city: "上海市" },
    });
    const provider = new BaiduReverseGeocodeProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await expect(provider.reverseGeocode({ baiduAk: "test-ak", coordinate: { lng: 121.475, lat: 31.234 } })).resolves.toEqual({
      address: "上海市黄浦区人民大道",
      city: "上海市",
      source: "baidu",
    });
    expect(fake.points).toEqual([{ lng: 121.475, lat: 31.234 }]);
  });

  it("builds an address from components when Baidu omits the direct address", async () => {
    const fake = createFakeReverseGeocodeRuntime({
      addressComponents: {
        province: "上海市",
        city: "上海市",
        district: "黄浦区",
        street: "人民大道",
        streetNumber: "200号",
      },
    });
    const provider = new BaiduReverseGeocodeProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => fake.runtime,
    });

    await expect(provider.reverseGeocode({ baiduAk: "test-ak", coordinate: { lng: 121.475, lat: 31.234 } })).resolves.toMatchObject({
      address: "上海市黄浦区人民大道200号",
      city: "上海市",
    });
  });

  it("fails clearly when AK, runtime, or address result is unavailable", async () => {
    const loadedProvider = new BaiduReverseGeocodeProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => undefined,
    });
    const emptyProvider = new BaiduReverseGeocodeProvider({
      loadScript: () => Promise.resolve({ status: "loaded" }),
      getGlobal: () => createFakeReverseGeocodeRuntime({ address: "  " }).runtime,
    });

    await expect(loadedProvider.reverseGeocode({ baiduAk: null, coordinate: { lng: 121.475, lat: 31.234 } })).rejects.toThrow(
      "BAIDU_AK_MISSING",
    );
    await expect(loadedProvider.reverseGeocode({ baiduAk: "test-ak", coordinate: { lng: 121.475, lat: 31.234 } })).rejects.toThrow(
      "BAIDU_REVERSE_GEOCODE_UNAVAILABLE",
    );
    await expect(emptyProvider.reverseGeocode({ baiduAk: "test-ak", coordinate: { lng: 121.475, lat: 31.234 } })).rejects.toThrow(
      "BAIDU_REVERSE_GEOCODE_EMPTY",
    );
    expect(getReverseGeocodeErrorMessage(new Error("BAIDU_AK_MISSING"))).toBe("未配置百度 AK，可手动填写地址。");
  });
});

interface FakeReverseResult {
  address?: string;
  addressComponents?: {
    province?: string;
    city?: string;
    district?: string;
    street?: string;
    streetNumber?: string;
  };
}

function createFakeReverseGeocodeRuntime(result: FakeReverseResult) {
  const points: Array<{ lng: number; lat: number }> = [];
  const getLocation = vi.fn((point: { lng?: number; lat?: number }, callback: (nextResult: FakeReverseResult) => void) => {
    callback(result);
  });

  return {
    points,
    runtime: {
      api: {
        Geocoder: class {
          getLocation = getLocation;
        },
        Point: class {
          lng: number;
          lat: number;

          constructor(lng: number, lat: number) {
            this.lng = lng;
            this.lat = lat;
            points.push({ lng, lat });
          }
        },
      },
    },
  };
}
