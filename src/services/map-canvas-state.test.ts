import { describe, expect, it } from "vitest";

import { resolveMapCanvasOverlay } from "@/services/map-canvas-state";

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
});
