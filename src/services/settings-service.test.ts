import { describe, expect, it } from "vitest";

import {
  buildCompleteFirstLaunchInput,
  buildUpdateAutoUpdateCheckOnStartupInput,
  buildUpdateBaiduAkInput,
  DEFAULT_CITY,
  updateAutoUpdateCheckOnStartup,
} from "@/services/settings-service";

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

  it("builds startup update-check preference payloads", () => {
    expect(buildUpdateAutoUpdateCheckOnStartupInput(false)).toEqual({ enabled: false });
    expect(buildUpdateAutoUpdateCheckOnStartupInput(true)).toEqual({ enabled: true });
  });

  it("maps the startup update-check preference back into settings state", async () => {
    const currentSettings = {
      completed: true,
      defaultCity: DEFAULT_CITY,
      baiduAk: null,
      autoUpdateCheckOnStartup: true,
    };

    await expect(updateAutoUpdateCheckOnStartup(false, currentSettings)).resolves.toEqual({
      ...currentSettings,
      autoUpdateCheckOnStartup: false,
    });
  });
});
