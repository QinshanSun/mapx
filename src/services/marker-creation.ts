import type { MarkerDetailFormState } from "@/services/marker-detail-form";
import type { MapCoordinate } from "@/services/map-provider";
import type { MarkerDraft, MarkerSource } from "@/types/marker";

export interface PendingMarkerCreation {
  id: string;
  projectId: string;
  lng: number;
  lat: number;
  source: MarkerSource;
}

const PENDING_MARKER_ID = "pending-marker";

export function createPendingMarkerFromMapClick(
  projectId: string,
  coordinate: MapCoordinate,
  isCreationMode: boolean,
): PendingMarkerCreation | null {
  if (!isCreationMode) {
    return null;
  }

  return createPendingMarker(projectId, coordinate, "manual");
}

export function createPendingMarkerFromCenter(projectId: string, coordinate: MapCoordinate): PendingMarkerCreation {
  return createPendingMarker(projectId, coordinate, "center");
}

export function pendingMarkerToFormState(pendingMarker: PendingMarkerCreation): MarkerDetailFormState {
  return {
    name: pendingMarker.source === "center" ? "地图中心点" : "新建点位",
    address: "",
    categoryId: "",
    tagIds: [],
    note: "",
  };
}

export function buildMarkerDraftFromPending(
  pendingMarker: PendingMarkerCreation,
  formState: MarkerDetailFormState,
): MarkerDraft {
  return {
    projectId: pendingMarker.projectId,
    name: formState.name.trim(),
    lng: pendingMarker.lng,
    lat: pendingMarker.lat,
    address: formState.address.trim() || null,
    categoryId: formState.categoryId || null,
    tagIds: formState.tagIds,
    note: formState.note.trim() || null,
    source: pendingMarker.source,
  };
}

export function isPendingMarkerDirty(pendingMarker: PendingMarkerCreation | null) {
  return pendingMarker !== null;
}

function createPendingMarker(
  projectId: string,
  coordinate: MapCoordinate,
  source: MarkerSource,
): PendingMarkerCreation {
  return {
    id: PENDING_MARKER_ID,
    projectId,
    lng: coordinate.lng,
    lat: coordinate.lat,
    source,
  };
}
