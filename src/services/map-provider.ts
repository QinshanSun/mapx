import type { MapLayer } from "@/types/project";

export interface MapMarkerItem {
  id: string;
  name: string;
  lng: number;
  lat: number;
  color: string;
  icon: string;
}

export interface MapMeasurementItem {
  id: string;
  name: string;
  points: MapCoordinate[];
  totalDistanceMeters: number;
}

export interface MapViewState {
  center: {
    lng: number;
    lat: number;
  };
  zoom: number;
}

export const MIN_MAP_ZOOM = 3;
export const MAX_MAP_ZOOM = 19;

export function clampMapZoom(zoom: number) {
  return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));
}

export function adjustMapViewZoom(view: MapViewState, delta: number): MapViewState {
  return {
    center: view.center,
    zoom: clampMapZoom(view.zoom + delta),
  };
}

export interface MapCoordinate {
  lng: number;
  lat: number;
}

export interface MapDistanceMeasurementProgress {
  point: MapCoordinate;
  index: number;
  totalDistanceMeters: number;
}

export interface MapDistanceMeasurementResult {
  points: MapCoordinate[];
  totalDistanceMeters: number;
}

export interface MapDistanceMeasurementHandlers {
  onPointAdded?: (progress: MapDistanceMeasurementProgress) => void;
  onCompleted?: (result: MapDistanceMeasurementResult | null) => void;
  onCleared?: () => void;
}

export interface MapDistanceMeasurementStartResult {
  status: "ready" | "failed";
  code?: "MAP_DISTANCE_TOOL_UNAVAILABLE";
  message?: string;
}

export interface MapPoiPreview {
  id: string;
  name: string;
  lng: number;
  lat: number;
  address: string | null;
  city: string | null;
  source: "baidu";
}

export interface MapProvider {
  init(container: HTMLElement, view: MapViewState): Promise<void>;
  destroy(): void;
  setView(view: MapViewState): void;
  getView(): MapViewState | null;
  zoomBy(delta: number): MapViewState | null;
  locateCurrentPosition(): Promise<MapCoordinate>;
  setLayer(layer: MapLayer): void;
  getLayer(): MapLayer;
  setMarkers(markers: MapMarkerItem[]): void;
  setMeasurements(measurements: MapMeasurementItem[]): void;
  setSelectedMeasurement(measurementId: string | null): void;
  setSelectedMarker(markerId: string | null): void;
  setDraggableMarker(markerId: string | null): void;
  setPoiPreview(preview: MapPoiPreview | null): void;
  startDistanceMeasurement(handlers: MapDistanceMeasurementHandlers): Promise<MapDistanceMeasurementStartResult>;
  stopDistanceMeasurement(): void;
  setMarkerClickHandler(handler: ((markerId: string) => void) | null): void;
  setMeasurementClickHandler(handler: ((measurementId: string) => void) | null): void;
  setMarkerDragHandler(handler: ((markerId: string, coordinate: MapCoordinate) => void) | null): void;
  setMapClickHandler(handler: ((coordinate: MapCoordinate) => void) | null): void;
}
