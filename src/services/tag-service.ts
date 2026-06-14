import { isTauri } from "@tauri-apps/api/core";

import { callCommand } from "@/services/tauri-client";
import type { TagRecord } from "@/types/tag";

const previewNow = "2026-06-14T00:00:00Z";

export function listProjectTags(projectId: string) {
  if (!isTauri()) {
    return Promise.resolve<TagRecord[]>([]);
  }

  return callCommand<TagRecord[]>("list_project_tags", { request: { projectId } });
}

export function createTag(projectId: string, name: string) {
  if (!isTauri()) {
    return Promise.resolve(buildPreviewTag(projectId, name));
  }

  return callCommand<TagRecord>("create_tag", { request: { projectId, name } });
}

export function updateTag(projectId: string, tagId: string, name: string) {
  if (!isTauri()) {
    return Promise.resolve(buildPreviewTag(projectId, name, tagId));
  }

  return callCommand<TagRecord>("update_tag", { request: { projectId, tagId, name } });
}

export function softDeleteTag(projectId: string, tagId: string) {
  if (!isTauri()) {
    return Promise.resolve();
  }

  return callCommand<void>("soft_delete_tag", { request: { projectId, tagId } });
}

function buildPreviewTag(projectId: string, name: string, tagId = `preview-tag-${name.trim()}`): TagRecord {
  return {
    id: tagId,
    projectId,
    name: name.trim(),
    createdAt: previewNow,
    updatedAt: previewNow,
  };
}
