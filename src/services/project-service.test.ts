import { describe, expect, it } from "vitest";

import { buildPreviewProjectWorkspace, selectProject } from "@/services/project-service";

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

  it("adds a preview project as the current project", () => {
    const workspace = buildPreviewProjectWorkspace("上海");
    const nextWorkspace = buildPreviewProjectWorkspace("上海", "客户项目", workspace);

    expect(nextWorkspace.projects.map((project) => project.name)).toEqual(["我的项目", "客户项目"]);
    expect(nextWorkspace.currentProject.name).toBe("客户项目");
  });

  it("selects an existing preview project", async () => {
    const workspace = buildPreviewProjectWorkspace("上海", "客户项目", buildPreviewProjectWorkspace("上海"));
    const nextWorkspace = await selectProject("preview-project", workspace);

    expect(nextWorkspace.currentProject.name).toBe("我的项目");
  });
});
