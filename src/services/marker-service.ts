import { isTauri } from "@tauri-apps/api/core";

import { PREVIEW_CATEGORIES } from "@/services/category-service";
import { searchLocalMarkers } from "@/services/marker-search";
import { callCommand } from "@/services/tauri-client";
import type { MarkerDraft, MarkerMoveInput, MarkerRecord, MarkerUpdate } from "@/types/marker";

const previewNow = "2026-06-14T00:00:00Z";
const previewMarkersByProject = new Map<string, MarkerRecord[]>();
let previewMarkerCreateCount = 0;

export function listProjectMarkers(projectId: string) {
  if (!isTauri()) {
    return Promise.resolve(getPreviewMarkers(projectId));
  }

  return callCommand<MarkerRecord[]>("list_project_markers", { request: { projectId } });
}

export function searchProjectMarkers(projectId: string, keyword: string) {
  if (!isTauri()) {
    return Promise.resolve(searchLocalMarkers(getPreviewMarkers(projectId), PREVIEW_CATEGORIES, [], keyword));
  }

  return callCommand<MarkerRecord[]>("search_project_markers", { request: { projectId, keyword } });
}

export function createMarker(draft: MarkerDraft) {
  if (!isTauri()) {
    const marker = buildPreviewMarker(draft, `preview-created-marker-${++previewMarkerCreateCount}`);
    previewMarkersByProject.set(draft.projectId, [marker, ...getPreviewMarkers(draft.projectId)]);
    return Promise.resolve(marker);
  }

  return callCommand<MarkerRecord>("create_marker", { request: draft });
}

export function updateMarker(update: MarkerUpdate) {
  if (!isTauri()) {
    const marker = buildPreviewMarker(update, update.markerId);
    previewMarkersByProject.set(
      update.projectId,
      getPreviewMarkers(update.projectId).map((currentMarker) => (currentMarker.id === update.markerId ? marker : currentMarker)),
    );
    return Promise.resolve(marker);
  }

  return callCommand<MarkerRecord>("update_marker", { request: update });
}

export function moveMarker(input: MarkerMoveInput) {
  if (!isTauri()) {
    const marker = getPreviewMarkers(input.projectId).find((currentMarker) => currentMarker.id === input.markerId);

    if (!marker) {
      return Promise.reject(new Error("MARKER_NOT_FOUND"));
    }

    const movedMarker = {
      ...marker,
      lng: input.lng,
      lat: input.lat,
      updatedAt: previewNow,
    };
    previewMarkersByProject.set(
      input.projectId,
      getPreviewMarkers(input.projectId).map((currentMarker) => (currentMarker.id === input.markerId ? movedMarker : currentMarker)),
    );
    return Promise.resolve(movedMarker);
  }

  return callCommand<MarkerRecord>("move_marker", { request: input });
}

export function softDeleteMarker(projectId: string, markerId: string) {
  if (!isTauri()) {
    previewMarkersByProject.set(
      projectId,
      getPreviewMarkers(projectId).filter((marker) => marker.id !== markerId),
    );
    return Promise.resolve();
  }

  return callCommand<void>("soft_delete_marker", { request: { projectId, markerId } });
}

function getPreviewMarkers(projectId: string) {
  const existingMarkers = previewMarkersByProject.get(projectId);

  if (existingMarkers) {
    return existingMarkers;
  }

  const markers = buildPreviewMarkers(projectId, 1000);
  previewMarkersByProject.set(projectId, markers);
  return markers;
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
    tagIds: draft.tagIds ?? [],
    note: draft.note?.trim() || null,
    source: draft.source ?? "manual",
    createdAt: previewNow,
    updatedAt: previewNow,
  };
}

function buildPreviewMarkers(projectId: string, count: number): MarkerRecord[] {
  return Array.from({ length: count }, (_, index) => {
    const category = PREVIEW_CATEGORIES.length > 0 ? PREVIEW_CATEGORIES[index % PREVIEW_CATEGORIES.length] : null;
    const markerNumber = index + 1;

    return {
      id: `preview-marker-${markerNumber}`,
      projectId,
      name: `测试点位 ${markerNumber.toString().padStart(4, "0")}`,
      lng: 121.35 + (index % 20) * 0.01,
      lat: 31.1 + Math.floor(index / 20) * 0.004,
      coordinateSystem: "BD09",
      address: `上海市测试街区 ${markerNumber} 号`,
      categoryId: markerNumber % 7 === 0 ? null : category?.id ?? null,
      tagIds: [],
      note: markerNumber % 5 === 0 ? "待复访" : null,
      source: "manual",
      createdAt: `2026-06-14T${String(index % 24).padStart(2, "0")}:00:00Z`,
      updatedAt: `2026-06-15T${String((count - index) % 24).padStart(2, "0")}:00:00Z`,
    };
  });
}
