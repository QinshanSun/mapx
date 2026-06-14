import { describe, expect, it } from "vitest";

import { buildCompleteFirstLaunchInput, DEFAULT_CITY } from "@/services/settings-service";

describe("first launch settings service", () => {
  it("builds a skip-AK completion payload with the Shanghai default", () => {
    expect(buildCompleteFirstLaunchInput({ defaultCity: "", baiduAk: "will-not-save" }, { skipBaiduAk: true })).toEqual({
      defaultCity: DEFAULT_CITY,
      baiduAk: null,
    });
  });

  it("rejects free-form default cities before calling the backend", () => {
    expect(buildCompleteFirstLaunchInput({ defaultCity: "浦东新区", baiduAk: "" })).toEqual({
      defaultCity: DEFAULT_CITY,
      baiduAk: null,
    });
  });

  it("trims city and Baidu AK before saving", () => {
    expect(buildCompleteFirstLaunchInput({ defaultCity: " 杭州 ", baiduAk: "  test-ak  " })).toEqual({
      defaultCity: "杭州",
      baiduAk: "test-ak",
    });
  });
});
