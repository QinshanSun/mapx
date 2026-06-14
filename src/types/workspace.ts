export type WorkspacePanel = "overview" | "markers" | "settings" | "about";

export type ConnectionStatus = "online" | "offline" | "missing-ak";

export interface WorkspaceMarkerPreview {
  id: string;
  name: string;
  categoryName: string;
  city: string;
  address: string;
}

export interface AppShellSnapshot {
  activeProjectName: string;
  defaultCity: string;
  connectionStatus: ConnectionStatus;
  markerCount: number;
}
