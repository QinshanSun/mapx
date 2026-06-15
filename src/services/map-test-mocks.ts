import type { MapCoordinate, MapMarkerItem, MapPoiPreview, MapProvider, MapViewState } from "@/services/map-provider";
import type { MapLayer } from "@/types/project";

export class MockMapProvider implements MapProvider {
  readonly calls: string[] = [];
  markers: MapMarkerItem[] = [];
  poiPreview: MapPoiPreview | null = null;
  selectedMarkerId: string | null = null;
  draggableMarkerId: string | null = null;
  view: MapViewState | null = null;
  layer: MapLayer = "normal";
  private mapClickHandler: ((coordinate: MapCoordinate) => void) | null = null;
  private markerClickHandler: ((markerId: string) => void) | null = null;
  private markerDragHandler: ((markerId: string, coordinate: MapCoordinate) => void) | null = null;

  constructor(private readonly options: { initError?: Error } = {}) {}

  async init(_container: HTMLElement, view: MapViewState) {
    this.calls.push("init");

    if (this.options.initError) {
      throw this.options.initError;
    }

    this.view = view;
  }

  destroy() {
    this.calls.push("destroy");
  }

  setView(view: MapViewState) {
    this.view = view;
  }

  getView() {
    return this.view;
  }

  async locateCurrentPosition() {
    const coordinate = { lng: 121.4737, lat: 31.2304 };
    this.view = { center: coordinate, zoom: 16 };
    return coordinate;
  }

  setLayer(layer: MapLayer) {
    this.layer = layer;
  }

  getLayer() {
    return this.layer;
  }

  setMarkers(markers: MapMarkerItem[]) {
    this.markers = markers;
  }

  setSelectedMarker(markerId: string | null) {
    this.selectedMarkerId = markerId;
  }

  setDraggableMarker(markerId: string | null) {
    this.draggableMarkerId = markerId;
  }

  setPoiPreview(preview: MapPoiPreview | null) {
    this.poiPreview = preview;
  }

  setMarkerClickHandler(handler: ((markerId: string) => void) | null) {
    this.markerClickHandler = handler;
  }

  setMarkerDragHandler(handler: ((markerId: string, coordinate: MapCoordinate) => void) | null) {
    this.markerDragHandler = handler;
  }

  setMapClickHandler(handler: ((coordinate: MapCoordinate) => void) | null) {
    this.mapClickHandler = handler;
  }

  triggerMapClick(coordinate: MapCoordinate) {
    this.mapClickHandler?.(coordinate);
  }

  triggerMarkerClick(markerId: string) {
    this.markerClickHandler?.(markerId);
  }

  triggerMarkerDrag(markerId: string, coordinate: MapCoordinate) {
    this.markerDragHandler?.(markerId, coordinate);
  }
}

export interface MockPoi {
  uid?: string;
  title?: string;
  address?: string;
  city?: string;
  point?: { lng: number; lat: number };
}

export function createMockPoiSearchRuntime(pois: MockPoi[], status = 0) {
  const localSearches: MockLocalSearch[] = [];
  const api = {
    LocalSearch: class extends MockLocalSearch {
      constructor(location: string, options: MockLocalSearchOptions) {
        super(location, options, pois, status);
        localSearches.push(this);
      }
    },
  };

  return {
    runtime: { api },
    localSearches,
  };
}

interface MockLocalSearchOptions {
  onSearchComplete: (results: MockPoiResultSet) => void;
  pageCapacity?: number;
}

export class MockLocalSearch {
  readonly searchedKeywords: string[] = [];

  constructor(
    readonly location: string,
    private readonly options: MockLocalSearchOptions,
    private readonly pois: MockPoi[],
    private readonly status: number,
  ) {}

  search(keyword: string) {
    this.searchedKeywords.push(keyword);
    this.options.onSearchComplete(new MockPoiResultSet(this.pois, this.status));
  }

  getStatus() {
    return this.status;
  }
}

class MockPoiResultSet {
  constructor(
    private readonly pois: MockPoi[],
    private readonly status: number,
  ) {}

  getCurrentNumPois() {
    return this.pois.length;
  }

  getPoi(index: number) {
    return this.pois[index] ?? null;
  }

  getStatus() {
    return this.status;
  }
}

export interface MockReverseGeocodeResult {
  address?: string;
  addressComponents?: {
    province?: string;
    city?: string;
    district?: string;
    street?: string;
    streetNumber?: string;
  };
}

export function createMockReverseGeocodeRuntime(result: MockReverseGeocodeResult) {
  const points: Array<{ lng: number; lat: number }> = [];
  const getLocationCalls: Array<{ lng?: number; lat?: number }> = [];

  return {
    points,
    getLocationCalls,
    runtime: {
      api: {
        Geocoder: class {
          getLocation(point: { lng?: number; lat?: number }, callback: (nextResult: MockReverseGeocodeResult) => void) {
            getLocationCalls.push(point);
            callback(result);
          }
        },
        Point: class {
          lng: number;
          lat: number;

          constructor(lng: number, lat: number) {
            this.lng = lng;
            this.lat = lat;
            points.push({ lng, lat });
          }
        },
      },
    },
  };
}
