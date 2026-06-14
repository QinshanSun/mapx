import { isTauri } from "@tauri-apps/api/core";

import { callCommand } from "@/services/tauri-client";
import type { CategoryRecord } from "@/types/category";

const previewNow = "2026-06-14T00:00:00Z";

export const PREVIEW_CATEGORIES: CategoryRecord[] = [
  buildPreviewCategory("preview-category-customer", "客户", "#2563eb", "Users", 10),
  buildPreviewCategory("preview-category-store", "门店", "#16a34a", "Store", 20),
  buildPreviewCategory("preview-category-warehouse", "仓库", "#f59e0b", "Warehouse", 30),
  buildPreviewCategory("preview-category-competitor", "竞品", "#dc2626", "BadgeAlert", 40),
  buildPreviewCategory("preview-category-candidate", "候选点", "#7c3aed", "MapPin", 50),
];

export function listProjectCategories(projectId: string) {
  if (!isTauri()) {
    return Promise.resolve(PREVIEW_CATEGORIES.map((category) => ({ ...category, projectId })));
  }

  return callCommand<CategoryRecord[]>("list_project_categories", { request: { projectId } });
}

function buildPreviewCategory(
  id: string,
  name: string,
  color: string,
  icon: string,
  sortOrder: number,
): CategoryRecord {
  return {
    id,
    projectId: "preview-project",
    name,
    color,
    icon,
    sortOrder,
    createdAt: previewNow,
    updatedAt: previewNow,
  };
}
