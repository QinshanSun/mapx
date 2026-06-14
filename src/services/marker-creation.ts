import type { MarkerDetailFormState } from "@/services/marker-detail-form";
import type { MapCoordinate, MapPoiPreview } from "@/services/map-provider";
import type { MarkerDraft, MarkerSource } from "@/types/marker";

export interface PendingMarkerCreation {
  id: string;
  projectId: string;
  lng: number;
  lat: number;
  source: MarkerSource;
  initialName?: string;
  initialAddress?: string | null;
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

export function createPendingMarkerFromPoi(projectId: string, poiPreview: MapPoiPreview): PendingMarkerCreation {
  return {
    ...createPendingMarker(projectId, poiPreview, "search"),
    initialName: poiPreview.name,
    initialAddress: poiPreview.address,
  };
}

export function pendingMarkerToFormState(pendingMarker: PendingMarkerCreation): MarkerDetailFormState {
  return {
    name: getPendingMarkerInitialName(pendingMarker),
    address: pendingMarker.initialAddress ?? "",
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

function getPendingMarkerInitialName(pendingMarker: PendingMarkerCreation) {
  if (pendingMarker.initialName?.trim()) {
    return pendingMarker.initialName.trim();
  }

  if (pendingMarker.source === "center") {
    return "地图中心点";
  }

  if (pendingMarker.source === "search") {
    return "百度地点";
  }

  return "新建点位";
}
