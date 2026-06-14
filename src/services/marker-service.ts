import { isTauri } from "@tauri-apps/api/core";

import { callCommand } from "@/services/tauri-client";
import type { MarkerDraft, MarkerRecord, MarkerUpdate } from "@/types/marker";

const previewNow = "2026-06-14T00:00:00Z";

export function listProjectMarkers(projectId: string) {
  if (!isTauri()) {
    return Promise.resolve<MarkerRecord[]>([]);
  }

  return callCommand<MarkerRecord[]>("list_project_markers", { request: { projectId } });
}

export function createMarker(draft: MarkerDraft) {
  if (!isTauri()) {
    return Promise.resolve(buildPreviewMarker(draft));
  }

  return callCommand<MarkerRecord>("create_marker", { request: draft });
}

export function updateMarker(update: MarkerUpdate) {
  if (!isTauri()) {
    return Promise.resolve(buildPreviewMarker(update, update.markerId));
  }

  return callCommand<MarkerRecord>("update_marker", { request: update });
}

export function softDeleteMarker(projectId: string, markerId: string) {
  if (!isTauri()) {
    return Promise.resolve();
  }

  return callCommand<void>("soft_delete_marker", { request: { projectId, markerId } });
}

function buildPreviewMarker(draft: MarkerDraft, markerId = "preview-marker"): MarkerRecord {
  return {
    id: markerId,
    projectId: draft.projectId,
    name: draft.name.trim(),
    lng: draft.lng,
    lat: draft.lat,
    coordinateSystem: "BD09",
    address: draft.address?.trim() || null,
    categoryId: draft.categoryId?.trim() || null,
    note: draft.note?.trim() || null,
    source: draft.source ?? "manual",
    createdAt: previewNow,
    updatedAt: previewNow,
  };
}
