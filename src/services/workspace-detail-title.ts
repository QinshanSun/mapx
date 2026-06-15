import type { WorkspacePanel } from "@/types/workspace";

export interface WorkspaceDetailTitleState {
  activePanel: WorkspacePanel;
  hasSelectedMarker: boolean;
  hasPendingMarker: boolean;
  isEditingMarker: boolean;
  hasPoiPreview: boolean;
}

export function resolveWorkspaceDetailTitle({
  activePanel,
  hasSelectedMarker,
  hasPendingMarker,
  isEditingMarker,
  hasPoiPreview,
}: WorkspaceDetailTitleState) {
  if (activePanel === "settings") {
    return "设置";
  }

  if (activePanel === "about") {
    return "关于 MapX";
  }

  if (activePanel === "search") {
    return hasPoiPreview ? "百度地点预览" : "搜索结果";
  }

  if (hasPendingMarker) {
    return "新建点位";
  }

  if (hasSelectedMarker) {
    return isEditingMarker ? "编辑点位" : "点位详情";
  }

  return "项目概览";
}
