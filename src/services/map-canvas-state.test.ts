import { describe, expect, it } from "vitest";

import { isMapZoomControlEnabled, resolveLocateStatusMessage, resolveMapCanvasOverlay } from "@/services/map-canvas-state";

describe("map canvas unavailable states", () => {
  it("offers a settings entry when the Baidu AK is missing", () => {
    expect(resolveMapCanvasOverlay("missing-ak")).toEqual({
      title: "地图未启用",
      message: "请在设置中填写百度地图开放平台 AK。",
      actions: [{ id: "settings", label: "打开设置" }],
    });
  });

  it("offers retry, settings, and log entries after a loader failure", () => {
    expect(resolveMapCanvasOverlay("failed", "百度地图加载失败，请检查 AK、白名单或网络连接")).toEqual({
      title: "地图加载失败",
      message: "百度地图加载失败，请检查 AK、白名单或网络连接",
      actions: [
        { id: "retry", label: "重试" },
        { id: "settings", label: "打开设置" },
        { id: "logs", label: "打开日志目录" },
      ],
    });
  });

  it("enables zoom controls only when the map is ready", () => {
    expect(isMapZoomControlEnabled("ready")).toBe(true);
    expect(isMapZoomControlEnabled("missing-ak")).toBe(false);
    expect(isMapZoomControlEnabled("loading")).toBe(false);
    expect(isMapZoomControlEnabled("failed")).toBe(false);
  });

  it("keeps locate feedback user-actionable after failures", () => {
    expect(resolveLocateStatusMessage("loading")).toBe("正在定位...");
    expect(resolveLocateStatusMessage("success", { lng: 121.4737, lat: 31.2304 })).toBe(
      "已定位到当前位置：121.47370, 31.23040",
    );
    expect(resolveLocateStatusMessage("failed", null, "定位失败")).toBe("定位失败，可继续手动操作地图。");
  });
});
