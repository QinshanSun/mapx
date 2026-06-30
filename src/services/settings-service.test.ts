import { describe, expect, it } from "vitest";

import { buildCompleteFirstLaunchInput, buildUpdateBaiduAkInput, DEFAULT_CITY, updateAutoUpdateCheckOnStartup } from "@/services/settings-service";

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

  it("builds Baidu AK save and clear payloads", () => {
    expect(buildUpdateBaiduAkInput("  test-ak  ")).toEqual({ baiduAk: "test-ak" });
    expect(buildUpdateBaiduAkInput("   ")).toEqual({ baiduAk: null });
  });

  it("previews startup auto-update preference changes", async () => {
    await expect(
      updateAutoUpdateCheckOnStartup(false, {
        completed: true,
        defaultCity: "上海",
        baiduAk: null,
        autoUpdateCheckOnStartup: true,
      }),
    ).resolves.toMatchObject({ autoUpdateCheckOnStartup: false });
  });
});
