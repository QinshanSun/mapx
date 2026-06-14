export const WORKSPACE_MENU_EVENT = "mapx-menu-action";

export type WorkspaceActionId =
  | "project.new"
  | "search.focus"
  | "changes.save"
  | "mode.cancel"
  | "selection.delete"
  | "view.overview"
  | "view.settings"
  | "help.about";

export type WorkspaceActionSource = "button" | "menu" | "shortcut";

export interface WorkspaceActionNotice {
  id: WorkspaceActionId;
  label: string;
  message: string;
  source: WorkspaceActionSource;
}

export interface WorkspaceMenuActionPayload {
  actionId: WorkspaceActionId;
}

export const WORKSPACE_ACTION_LABELS: Record<WorkspaceActionId, string> = {
  "project.new": "新建项目",
  "search.focus": "搜索",
  "changes.save": "保存",
  "mode.cancel": "取消当前模式",
  "selection.delete": "删除选中项",
  "view.overview": "项目概览",
  "view.settings": "设置",
  "help.about": "关于 MapX",
};

export function isWorkspaceActionId(value: string): value is WorkspaceActionId {
  return value in WORKSPACE_ACTION_LABELS;
}
