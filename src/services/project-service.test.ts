import { describe, expect, it } from "vitest";

import { buildPreviewProjectWorkspace } from "@/services/project-service";

describe("project service", () => {
  it("builds a preview default project from the selected city", () => {
    expect(buildPreviewProjectWorkspace("杭州")).toMatchObject({
      currentProject: { name: "我的项目" },
      settings: {
        searchCity: "杭州",
        mapLayer: "normal",
        mapCenterLng: 120.1551,
        mapCenterLat: 30.2741,
        mapZoom: 12,
      },
    });
  });
});
