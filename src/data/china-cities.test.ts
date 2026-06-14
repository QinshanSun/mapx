import { describe, expect, it } from "vitest";

import { CHINA_CITIES, isSupportedCityName, normalizeCityName } from "@/data/china-cities";

const requiredCities = ["上海", "北京", "深圳", "广州", "杭州"];

describe("China city data", () => {
  it("keeps the V1 built-in city list in the expected size range", () => {
    expect(CHINA_CITIES.length).toBeGreaterThanOrEqual(30);
    expect(CHINA_CITIES.length).toBeLessThanOrEqual(50);
  });

  it("contains required major cities without calling geocoding", () => {
    const cityNames = CHINA_CITIES.map((city) => city.name);

    expect(cityNames).toEqual(expect.arrayContaining(requiredCities));
  });

  it("stores city-level centers with valid coordinates", () => {
    for (const city of CHINA_CITIES) {
      expect(city.name).not.toMatch(/[区县]/);
      expect(Number.isFinite(city.centerLng)).toBe(true);
      expect(Number.isFinite(city.centerLat)).toBe(true);
      expect(city.centerLng).toBeGreaterThanOrEqual(-180);
      expect(city.centerLng).toBeLessThanOrEqual(180);
      expect(city.centerLat).toBeGreaterThanOrEqual(-90);
      expect(city.centerLat).toBeLessThanOrEqual(90);
    }
  });

  it("normalizes unknown cities to Shanghai", () => {
    expect(isSupportedCityName(" 深圳 ")).toBe(true);
    expect(normalizeCityName("不存在的城市")).toBe("上海");
  });
});
