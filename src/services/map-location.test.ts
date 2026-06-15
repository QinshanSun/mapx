import { describe, expect, it } from "vitest";

import { getMapLocationErrorMessage } from "@/services/map-location";

describe("map location messages", () => {
  it("maps known locate-me failures to Chinese user-facing messages", () => {
    expect(getMapLocationErrorMessage(new Error("MAP_LOCATION_UNAVAILABLE"))).toBe("当前环境不支持定位，可继续手动操作地图。");
    expect(getMapLocationErrorMessage(new Error("MAP_LOCATION_PERMISSION_DENIED"))).toBe("定位权限未开启，可在系统或浏览器设置中允许定位。");
    expect(getMapLocationErrorMessage(new Error("MAP_LOCATION_TIMEOUT"))).toBe("定位超时，可稍后重试或手动移动地图。");
  });

  it("falls back to a generic non-blocking locate-me failure", () => {
    expect(getMapLocationErrorMessage(new Error("UNKNOWN"))).toBe("定位失败，可继续手动操作地图。");
  });
});
