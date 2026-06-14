import type { MapLayer } from "@/types/project";

export interface MapMarkerItem {
  id: string;
  name: string;
  lng: number;
  lat: number;
  color: string;
  icon: string;
}

export interface MapViewState {
  center: {
    lng: number;
    lat: number;
  };
  zoom: number;
}

export interface MapCoordinate {
  lng: number;
  lat: number;
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
  setLayer(layer: MapLayer): void;
  getLayer(): MapLayer;
  setMarkers(markers: MapMarkerItem[]): void;
  setSelectedMarker(markerId: string | null): void;
  setPoiPreview(preview: MapPoiPreview | null): void;
  setMarkerClickHandler(handler: ((markerId: string) => void) | null): void;
  setMapClickHandler(handler: ((coordinate: MapCoordinate) => void) | null): void;
}
