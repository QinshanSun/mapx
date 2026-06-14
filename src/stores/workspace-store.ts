import { create } from "zustand";

import type { WorkspacePanel } from "@/types/workspace";

interface WorkspaceState {
  activePanel: WorkspacePanel;
  selectedMarkerId: string | null;
  setActivePanel: (panel: WorkspacePanel) => void;
  selectMarker: (markerId: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activePanel: "overview",
  selectedMarkerId: null,
  setActivePanel: (activePanel) => set({ activePanel }),
  selectMarker: (selectedMarkerId) => set({ selectedMarkerId, activePanel: "markers" }),
}));
