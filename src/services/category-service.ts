import { isTauri } from "@tauri-apps/api/core";

import type { CategorySaveInput } from "@/services/category-form";
import { callCommand } from "@/services/tauri-client";
import type { CategoryRecord } from "@/types/category";

const previewNow = "2026-06-14T00:00:00Z";

export const PREVIEW_CATEGORIES: CategoryRecord[] = [];

export function listProjectCategories(projectId: string) {
  if (!isTauri()) {
    return Promise.resolve(PREVIEW_CATEGORIES.map((category) => ({ ...category, projectId })));
  }

  return callCommand<CategoryRecord[]>("list_project_categories", { request: { projectId } });
}

export function createCategory(projectId: string, input: CategorySaveInput) {
  if (!isTauri()) {
    return Promise.resolve(
      buildPreviewCategory(
        `preview-category-${input.name}`,
        input.name,
        input.color,
        input.icon,
        PREVIEW_CATEGORIES.length * 10 + 10,
        projectId,
      ),
    );
  }

  return callCommand<CategoryRecord>("create_category", { request: { projectId, ...input } });
}

export function updateCategory(projectId: string, categoryId: string, input: CategorySaveInput) {
  if (!isTauri()) {
    return Promise.resolve(buildPreviewCategory(categoryId, input.name, input.color, input.icon, 10, projectId));
  }

  return callCommand<CategoryRecord>("update_category", { request: { projectId, categoryId, ...input } });
}

export function softDeleteCategory(projectId: string, categoryId: string) {
  if (!isTauri()) {
    return Promise.resolve();
  }

  return callCommand<void>("soft_delete_category", { request: { projectId, categoryId } });
}

function buildPreviewCategory(
  id: string,
  name: string,
  color: string,
  icon: string,
  sortOrder: number,
  projectId = "preview-project",
): CategoryRecord {
  return {
    id,
    projectId,
    name,
    color,
    icon,
    sortOrder,
    createdAt: previewNow,
    updatedAt: previewNow,
  };
}
