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

export function createProject(name: string, currentWorkspace: ProjectWorkspace | null) {
  if (!isTauri()) {
    return Promise.resolve(buildPreviewProjectWorkspace(DEFAULT_CITY, name, currentWorkspace));
  }

  return callCommand<ProjectWorkspace>("create_project", { request: { name } });
}

export function selectProject(projectId: string, currentWorkspace: ProjectWorkspace) {
  if (!isTauri()) {
    const currentProject = currentWorkspace.projects.find((project) => project.id === projectId);

    return Promise.resolve(
      currentProject
        ? {
            ...currentWorkspace,
            currentProject,
          }
        : currentWorkspace,
    );
  }

  return callCommand<ProjectWorkspace>("select_project_workspace", { request: { projectId } });
}

export function buildPreviewProjectWorkspace(
  defaultCity: string,
  newProjectName?: string,
  currentWorkspace?: ProjectWorkspace | null,
): ProjectWorkspace {
  const city = CHINA_CITIES.find((item) => item.name === defaultCity) ?? CHINA_CITIES[0];
  const baseProject = {
    id: "preview-project",
    name: "我的项目",
    createdAt: previewNow,
    updatedAt: previewNow,
  };
  const projects = currentWorkspace?.projects ?? [baseProject];
  const currentProject = newProjectName
    ? {
        id: `preview-project-${projects.length + 1}`,
        name: newProjectName.trim(),
        createdAt: previewNow,
        updatedAt: previewNow,
      }
    : currentWorkspace?.currentProject ?? baseProject;

  return {
    projects: newProjectName ? [...projects, currentProject] : projects,
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
