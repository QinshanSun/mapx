import { create, type StateCreator } from "zustand";

import type { WorkspacePanel } from "@/types/workspace";

export interface WorkspaceState {
  activePanel: WorkspacePanel;
  selectedMarkerId: string | null;
  setActivePanel: (panel: WorkspacePanel) => void;
  selectMarker: (markerId: string | null) => void;
}

export const createWorkspaceState: StateCreator<WorkspaceState> = (set) => ({
  activePanel: "overview",
  selectedMarkerId: null,
  setActivePanel: (activePanel) => set({ activePanel }),
  selectMarker: (selectedMarkerId) => set({ selectedMarkerId, activePanel: "markers" }),
});

export const useWorkspaceStore = create<WorkspaceState>(createWorkspaceState);
