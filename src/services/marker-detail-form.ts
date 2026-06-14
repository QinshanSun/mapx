import type { MarkerRecord, MarkerUpdate } from "@/types/marker";
import type { MapCoordinate } from "@/services/map-provider";

export interface MarkerDetailFormState {
  name: string;
  address: string;
  categoryId: string;
  tagIds: string[];
  note: string;
}

export function markerToFormState(marker: MarkerRecord | null): MarkerDetailFormState {
  return {
    name: marker?.name ?? "",
    address: marker?.address ?? "",
    categoryId: marker?.categoryId ?? "",
    tagIds: marker?.tagIds ?? [],
    note: marker?.note ?? "",
  };
}

export function validateMarkerDetailForm(formState: MarkerDetailFormState) {
  if (!formState.name.trim()) {
    return "点位名称不能为空。";
  }

  return null;
}

export function isMarkerDetailFormDirty(marker: MarkerRecord, formState: MarkerDetailFormState) {
  const initialState = markerToFormState(marker);

  return (
    initialState.name !== formState.name ||
    initialState.address !== formState.address ||
    initialState.categoryId !== formState.categoryId ||
    initialState.note !== formState.note ||
    !haveSameTags(initialState.tagIds, formState.tagIds)
  );
}

export function isMarkerCoordinateDirty(marker: MarkerRecord, coordinate: MapCoordinate | null) {
  return Boolean(coordinate && (marker.lng !== coordinate.lng || marker.lat !== coordinate.lat));
}

export function applyAutoReverseGeocodedAddress(formState: MarkerDetailFormState, address: string | null | undefined) {
  const nextAddress = address?.trim();

  if (!nextAddress || formState.address.trim()) {
    return formState;
  }

  return {
    ...formState,
    address: nextAddress,
  };
}

export function buildMarkerUpdate(
  marker: MarkerRecord,
  formState: MarkerDetailFormState,
  coordinate: MapCoordinate = { lng: marker.lng, lat: marker.lat },
): MarkerUpdate {
  return {
    projectId: marker.projectId,
    markerId: marker.id,
    name: formState.name.trim(),
    lng: coordinate.lng,
    lat: coordinate.lat,
    address: formState.address.trim() || null,
    categoryId: formState.categoryId || null,
    tagIds: formState.tagIds,
    note: formState.note.trim() || null,
    source: marker.source,
  };
}

function haveSameTags(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();

  return sortedLeft.every((tagId, index) => tagId === sortedRight[index]);
}
