import { create, type StateCreator } from "zustand";

import {
  WORKSPACE_ACTION_LABELS,
  type WorkspaceActionId,
  type WorkspaceActionNotice,
  type WorkspaceActionSource,
} from "@/types/workspace-actions";
import type { WorkspacePanel } from "@/types/workspace";

export interface WorkspaceState {
  activePanel: WorkspacePanel;
  lastActionNotice: WorkspaceActionNotice | null;
  selectedMarkerId: string | null;
  dispatchAction: (actionId: WorkspaceActionId, source: WorkspaceActionSource) => void;
  setActivePanel: (panel: WorkspacePanel) => void;
  selectMarker: (markerId: string | null) => void;
}

export const createWorkspaceState: StateCreator<WorkspaceState> = (set) => ({
  activePanel: "overview",
  lastActionNotice: null,
  selectedMarkerId: null,
  dispatchAction: (actionId, source) =>
    set((state) => {
      const label = WORKSPACE_ACTION_LABELS[actionId];
      const nextState: Partial<WorkspaceState> = {
        lastActionNotice: {
          id: actionId,
          label,
          message: buildActionMessage(actionId, state.selectedMarkerId),
          source,
        },
      };

      if (actionId === "search.focus") {
        nextState.activePanel = "markers";
      }

      if (actionId === "mode.cancel" || actionId === "view.overview") {
        nextState.activePanel = "overview";
      }

      if (actionId === "view.settings") {
        nextState.activePanel = "settings";
      }

      if (actionId === "help.about") {
        nextState.activePanel = "about";
      }

      return nextState;
    }),
  setActivePanel: (activePanel) => set({ activePanel }),
  selectMarker: (selectedMarkerId) => set({ selectedMarkerId, activePanel: "markers" }),
});

export const useWorkspaceStore = create<WorkspaceState>(createWorkspaceState);

function buildActionMessage(actionId: WorkspaceActionId, selectedMarkerId: string | null) {
  switch (actionId) {
    case "project.new":
      return "新建项目入口已收到，后续项目管理 issue 会接入真实创建流程。";
    case "search.focus":
      return "搜索入口已收到，后续搜索 issue 会接入本地和百度 POI 搜索。";
    case "changes.save":
      return "保存入口已收到，后续表单和 SQLite issue 会接入真实保存。";
    case "mode.cancel":
      return "取消入口已收到，当前没有需要退出的工具模式。";
    case "selection.delete":
      return selectedMarkerId
        ? "删除入口已收到，后续点位 issue 会接入二次确认和软删除。"
        : "删除入口已收到，但当前没有选中项。";
    case "view.overview":
      return "已切换到项目概览。";
    case "view.settings":
      return "已切换到设置入口占位。";
    case "help.about":
      return "已切换到关于信息占位。";
  }
}
