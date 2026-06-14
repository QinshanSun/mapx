import { isTauri } from "@tauri-apps/api/core";

import { CHINA_CITIES } from "@/data/china-cities";
import { DEFAULT_CITY } from "@/services/settings-service";
import { callCommand } from "@/services/tauri-client";
import type { ProjectWorkspace } from "@/types/project";

const previewNow = "2026-06-14T00:00:00Z";

export function getProjectWorkspace() {
  if (!isTauri()) {
    return Promise.resolve(buildPreviewProjectWorkspace(DEFAULT_CITY));
  }

  return callCommand<ProjectWorkspace>("get_project_workspace");
}

export function buildPreviewProjectWorkspace(defaultCity: string): ProjectWorkspace {
  const city = CHINA_CITIES.find((item) => item.name === defaultCity) ?? CHINA_CITIES[0];
  const currentProject = {
    id: "preview-project",
    name: "我的项目",
    createdAt: previewNow,
    updatedAt: previewNow,
  };

  return {
    projects: [currentProject],
    currentProject,
    settings: {
      searchCity: city.name,
      mapLayer: "normal",
      mapCenterLng: city.centerLng,
      mapCenterLat: city.centerLat,
      mapZoom: 12,
    },
  };
}
