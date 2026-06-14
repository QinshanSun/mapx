import { isTauri } from "@tauri-apps/api/core";

import { CHINA_CITIES, normalizeCityName } from "@/data/china-cities";
import { DEFAULT_CITY } from "@/services/settings-service";
import { callCommand } from "@/services/tauri-client";
import type { MapLayer, ProjectWorkspace } from "@/types/project";

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

export function validateProjectName(name: string) {
  return name.trim() ? null : "项目名称不能为空。";
}

export function renameProject(projectId: string, name: string, currentWorkspace: ProjectWorkspace) {
  if (!isTauri()) {
    const trimmedName = name.trim();
    const projects = currentWorkspace.projects.map((project) =>
      project.id === projectId ? { ...project, name: trimmedName, updatedAt: previewNow } : project,
    );
    const currentProject =
      currentWorkspace.currentProject.id === projectId
        ? { ...currentWorkspace.currentProject, name: trimmedName, updatedAt: previewNow }
        : currentWorkspace.currentProject;

    return Promise.resolve({
      ...currentWorkspace,
      projects,
      currentProject,
    });
  }

  return callCommand<ProjectWorkspace>("rename_project", { request: { projectId, name } });
}

export function softDeleteProject(projectId: string, currentWorkspace: ProjectWorkspace) {
  if (!isTauri()) {
    const projects = currentWorkspace.projects.filter((project) => project.id !== projectId);
    const currentProject =
      currentWorkspace.currentProject.id === projectId
        ? projects[0] ?? buildPreviewProjectWorkspace(DEFAULT_CITY).currentProject
        : currentWorkspace.currentProject;

    return Promise.resolve({
      ...currentWorkspace,
      projects: projects.length > 0 ? projects : [currentProject],
      currentProject,
    });
  }

  return callCommand<ProjectWorkspace>("soft_delete_project", {
    request: { projectId, currentProjectId: currentWorkspace.currentProject.id },
  });
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

export function updateProjectMapLayer(projectId: string, mapLayer: MapLayer, currentWorkspace: ProjectWorkspace) {
  if (!isTauri()) {
    return Promise.resolve({
      ...currentWorkspace,
      settings: {
        ...currentWorkspace.settings,
        mapLayer,
      },
    });
  }

  return callCommand<ProjectWorkspace>("update_project_map_layer", { request: { projectId, mapLayer } });
}

export function updateProjectSearchCity(projectId: string, searchCity: string, currentWorkspace: ProjectWorkspace) {
  const nextSearchCity = normalizeCityName(searchCity, currentWorkspace.settings.searchCity);

  if (!isTauri()) {
    return Promise.resolve({
      ...currentWorkspace,
      settings: {
        ...currentWorkspace.settings,
        searchCity: nextSearchCity,
      },
    });
  }

  return callCommand<ProjectWorkspace>("update_project_search_city", { request: { projectId, searchCity: nextSearchCity } });
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
