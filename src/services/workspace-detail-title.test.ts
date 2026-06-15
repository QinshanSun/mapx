import { describe, expect, it } from "vitest";

import { resolveWorkspaceDetailTitle } from "@/services/workspace-detail-title";

describe("workspace detail title", () => {
  it("uses project overview when no marker, pending marker, or POI preview is active", () => {
    expect(resolveWorkspaceDetailTitle(state())).toBe("项目概览");
  });

  it("uses marker-specific titles for selected and editing markers", () => {
    expect(resolveWorkspaceDetailTitle(state({ hasSelectedMarker: true }))).toBe("点位详情");
    expect(resolveWorkspaceDetailTitle(state({ hasSelectedMarker: true, isEditingMarker: true }))).toBe("编辑点位");
  });

  it("uses new marker and Baidu POI preview titles for transient states", () => {
    expect(resolveWorkspaceDetailTitle(state({ hasPendingMarker: true }))).toBe("新建点位");
    expect(resolveWorkspaceDetailTitle(state({ activePanel: "search", hasPoiPreview: true }))).toBe("百度地点预览");
  });

  it("keeps settings and about titles independent from marker state", () => {
    expect(resolveWorkspaceDetailTitle(state({ activePanel: "settings", hasSelectedMarker: true }))).toBe("设置");
    expect(resolveWorkspaceDetailTitle(state({ activePanel: "about", hasPendingMarker: true }))).toBe("关于 MapX");
  });
});

function state(overrides: Partial<Parameters<typeof resolveWorkspaceDetailTitle>[0]> = {}) {
  return {
    activePanel: "overview" as const,
    hasSelectedMarker: false,
    hasPendingMarker: false,
    isEditingMarker: false,
    hasPoiPreview: false,
    ...overrides,
  };
}
