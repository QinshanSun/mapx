export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMapSettings {
  searchCity: string;
  mapLayer: "normal" | "satellite";
  mapCenterLng: number;
  mapCenterLat: number;
  mapZoom: number;
}

export interface ProjectWorkspace {
  projects: ProjectSummary[];
  currentProject: ProjectSummary;
  settings: ProjectMapSettings;
}
