import { describe, expect, it } from "vitest";

import {
  BROWSER_DEV_ORIGIN,
  MACOS_PACKAGED_ORIGIN,
  TAURI_DEV_ORIGIN,
  WINDOWS_PACKAGED_ORIGINS,
  buildBaiduAkOriginGuidance,
} from "@/services/map-runtime";

describe("map runtime origin guidance", () => {
  it("lists dev and packaged origins for Baidu AK allowlist guidance", () => {
    const guidance = buildBaiduAkOriginGuidance("tauri://localhost");

    expect(guidance.currentOrigin).toBe("tauri://localhost");
    expect(guidance.devOrigins).toEqual([MACOS_PACKAGED_ORIGIN, TAURI_DEV_ORIGIN, BROWSER_DEV_ORIGIN]);
    expect(guidance.packagedOrigins).toEqual([MACOS_PACKAGED_ORIGIN, ...WINDOWS_PACKAGED_ORIGINS]);
  });

  it("keeps map failure checks user-facing and actionable", () => {
    expect(buildBaiduAkOriginGuidance("http://localhost:1420").failureChecks).toEqual([
      "AK 是否正确",
      "白名单是否包含当前运行来源",
      "网络连接是否可用",
      "百度地图开放平台服务是否正常",
    ]);
  });
});
