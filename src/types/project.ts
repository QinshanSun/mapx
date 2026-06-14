export type MapLayer = "normal" | "satellite";

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMapSettings {
  searchCity: string;
  mapLayer: MapLayer;
  mapCenterLng: number;
  mapCenterLat: number;
  mapZoom: number;
}

export interface ProjectWorkspace {
  projects: ProjectSummary[];
  currentProject: ProjectSummary;
  settings: ProjectMapSettings;
}
