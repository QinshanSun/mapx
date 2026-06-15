import { loadBaiduMapScript, type BaiduMapLoadResult } from "@/services/baidu-map-loader";
import { DEFAULT_LOCATE_ME_ZOOM, DEFAULT_LOCATION_TIMEOUT_MS, getBrowserGeolocationErrorCode } from "@/services/map-location";
import { adjustMapViewZoom } from "@/services/map-provider";
import type { MapCoordinate, MapMarkerItem, MapPoiPreview, MapProvider, MapViewState } from "@/services/map-provider";
import type { MapLayer } from "@/types/project";

interface BaiduPoint {
  lng: number;
  lat: number;
}

interface BaiduMapInstance {
  addEventListener?: (eventName: string, handler: (event?: BaiduMapClickEvent) => void) => void;
  addOverlay(overlay: unknown): void;
  centerAndZoom(point: BaiduPoint, zoom: number): void;
  enableScrollWheelZoom?: (enabled?: boolean) => void;
  getCenter(): BaiduPoint;
  getZoom(): number;
  removeOverlay(overlay: unknown): void;
  setMapType?: (mapType: unknown) => void;
  destroy?: () => void;
}

interface BaiduMapClickEvent {
  domEvent?: {
    preventDefault?: () => void;
    stopPropagation?: () => void;
  };
  latlng?: BaiduPoint;
  point?: BaiduPoint;
}

interface BaiduGeolocationResult {
  point?: BaiduPoint;
}

interface BaiduGeolocationInstance {
  getCurrentPosition: (
    callback: (result?: BaiduGeolocationResult) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number },
  ) => void;
  getStatus?: () => number;
}

interface BaiduIconOptions {
  anchor?: unknown;
  imageSize?: unknown;
}

interface BaiduMarkerInstance {
  addEventListener?: (eventName: string, handler: (event?: BaiduMapClickEvent) => void) => void;
  disableDragging?: () => void;
  enableDragging?: () => void;
  getPosition?: () => BaiduPoint;
  setIcon?: (icon: unknown) => void;
  setTitle?: (title: string) => void;
  setZIndex?: (zIndex: number) => void;
}

export interface BaiduMapGlobal {
  Geolocation?: new () => BaiduGeolocationInstance;
  Icon: new (url: string, size: unknown, options?: BaiduIconOptions) => unknown;
  LocalSearch?: unknown;
  Map: new (container: HTMLElement) => BaiduMapInstance;
  Marker: new (point: BaiduPoint, options?: { enableClicking?: boolean; icon?: unknown }) => BaiduMarkerInstance;
  Point: new (lng: number, lat: number) => BaiduPoint;
  Size: new (width: number, height: number) => unknown;
}

export interface BaiduMapRuntime {
  api: BaiduMapGlobal;
  geolocationSuccessStatus?: number;
  normalMapType?: unknown;
  satelliteMapType?: unknown;
}

interface BaiduMapProviderOptions {
  loadScript?: typeof loadBaiduMapScript;
  getGlobal?: () => BaiduMapRuntime | undefined;
}

const MARKER_LABEL_MIN_ZOOM = 16;
const MARKER_LABEL_MAX_LENGTH = 14;

export class BaiduMapProvider implements MapProvider {
  private map: BaiduMapInstance | null = null;
  private container: HTMLElement | null = null;
  private iconCache = new Map<string, unknown>();
  private isDestroyed = true;
  private layer: MapLayer = "normal";
  private draggableMarkerId: string | null = null;
  private mapClickHandler: ((coordinate: MapCoordinate) => void) | null = null;
  private markerDragHandler: ((markerId: string, coordinate: MapCoordinate) => void) | null = null;
  private markerClickHandler: ((markerId: string) => void) | null = null;
  private markerItems: MapMarkerItem[] = [];
  private markerOverlays: BaiduMarkerInstance[] = [];
  private poiPreview: MapPoiPreview | null = null;
  private poiPreviewOverlay: BaiduMarkerInstance | null = null;
  private selectedMarkerId: string | null = null;

  constructor(
    private readonly baiduAk: string,
    private readonly options: BaiduMapProviderOptions = {},
  ) {}

  async init(container: HTMLElement, view: MapViewState) {
    this.destroy();
    this.isDestroyed = false;

    const loadResult = await this.loadScript();
    if (this.isDestroyed) {
      return;
    }

    if (loadResult.status !== "loaded") {
      throw new Error(loadResult.code ?? "BAIDU_MAP_LOAD_FAILED");
    }

    const runtime = this.getRuntime();
    if (this.isDestroyed) {
      return;
    }

    if (!runtime) {
      throw new Error("BAIDU_MAP_LOAD_FAILED");
    }

    this.container = container;
    this.map = new runtime.api.Map(container);
    this.map.enableScrollWheelZoom?.(true);
    this.map.addEventListener?.("click", (event) => {
      const coordinate = readClickCoordinate(event);
      if (coordinate) {
        this.mapClickHandler?.(coordinate);
      }
    });
    this.map.addEventListener?.("zoomend", () => {
      this.renderMarkers();
    });
    this.setView(view);
    this.setLayer(this.layer);
    this.renderMarkers();
    this.renderPoiPreview();
  }

  destroy() {
    this.isDestroyed = true;
    this.clearMarkers();
    this.clearPoiPreviewOverlay();
    this.map?.destroy?.();
    this.map = null;

    if (this.container) {
      this.container.replaceChildren();
      this.container = null;
    }
  }

  setView(view: MapViewState) {
    if (!this.map) {
      return;
    }

    const runtime = this.getRuntime();
    if (!runtime) {
      return;
    }

    this.map.centerAndZoom(new runtime.api.Point(view.center.lng, view.center.lat), view.zoom);
  }

  getView(): MapViewState | null {
    if (!this.map) {
      return null;
    }

    const center = this.map.getCenter();
    return {
      center: {
        lng: center.lng,
        lat: center.lat,
      },
      zoom: this.map.getZoom(),
    };
  }

  zoomBy(delta: number): MapViewState | null {
    const currentView = this.getView();

    if (!currentView) {
      return null;
    }

    const nextView = adjustMapViewZoom(currentView, delta);
    this.setView(nextView);
    this.renderMarkers();
    return nextView;
  }

  async locateCurrentPosition() {
    const runtime = this.getRuntime();

    if (!this.map || !runtime) {
      throw new Error("MAP_LOCATION_UNAVAILABLE");
    }

    const coordinate = runtime.api.Geolocation
      ? await this.locateWithBaiduGeolocation(runtime)
      : await locateWithBrowserGeolocation(DEFAULT_LOCATION_TIMEOUT_MS);

    if (!this.map || this.isDestroyed) {
      throw new Error("MAP_LOCATION_UNAVAILABLE");
    }

    this.map.centerAndZoom(new runtime.api.Point(coordinate.lng, coordinate.lat), Math.max(this.map.getZoom(), DEFAULT_LOCATE_ME_ZOOM));
    return coordinate;
  }

  setLayer(layer: MapLayer) {
    this.layer = layer;

    if (!this.map) {
      return;
    }

    const runtime = this.getRuntime();
    const mapType = layer === "satellite" ? runtime?.satelliteMapType : runtime?.normalMapType;

    if (mapType) {
      this.map.setMapType?.(mapType);
    }
  }

  getLayer() {
    return this.layer;
  }

  setMarkers(markers: MapMarkerItem[]) {
    this.markerItems = markers;
    this.renderMarkers();
  }

  setSelectedMarker(markerId: string | null) {
    this.selectedMarkerId = markerId;
    this.renderMarkers();
  }

  setDraggableMarker(markerId: string | null) {
    this.draggableMarkerId = markerId;
    this.renderMarkers();
  }

  setPoiPreview(preview: MapPoiPreview | null) {
    this.poiPreview = preview;
    this.renderPoiPreview();
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

  private loadScript(): Promise<BaiduMapLoadResult> {
    return (this.options.loadScript ?? loadBaiduMapScript)(this.baiduAk);
  }

  private getRuntime() {
    return this.options.getGlobal?.() ?? readBaiduMapRuntime();
  }

  private renderMarkers() {
    if (!this.map) {
      return;
    }

    const runtime = this.getRuntime();
    if (!runtime) {
      return;
    }

    this.clearMarkers();
    this.markerOverlays = this.markerItems.map((markerItem) => {
      const isSelected = markerItem.id === this.selectedMarkerId;
      const isDraggable = markerItem.id === this.draggableMarkerId;
      const point = new runtime.api.Point(markerItem.lng, markerItem.lat);
      const marker = new runtime.api.Marker(point, {
        enableClicking: true,
        icon: this.getMarkerIcon(runtime.api, markerItem, isSelected, this.shouldShowMarkerLabel(isSelected)),
      });

      marker.setTitle?.(markerItem.name);
      marker.setZIndex?.(isDraggable ? 25 : isSelected ? 20 : 10);
      if (isDraggable) {
        marker.enableDragging?.();
        marker.addEventListener?.("dragend", (event) => {
          const coordinate = readClickCoordinate(event) ?? readMarkerPosition(marker);
          if (coordinate) {
            this.markerDragHandler?.(markerItem.id, coordinate);
          }
        });
      } else {
        marker.disableDragging?.();
      }
      marker.addEventListener?.("click", (event) => {
        stopBaiduDomEvent(event);
        this.markerClickHandler?.(markerItem.id);
      });
      this.map?.addOverlay(marker);
      return marker;
    });
  }

  private clearMarkers() {
    if (this.map) {
      for (const marker of this.markerOverlays) {
        this.map.removeOverlay(marker);
      }
    }

    this.markerOverlays = [];
  }

  private renderPoiPreview() {
    if (!this.map) {
      return;
    }

    const runtime = this.getRuntime();
    if (!runtime) {
      return;
    }

    this.clearPoiPreviewOverlay();

    if (!this.poiPreview) {
      return;
    }

    const point = new runtime.api.Point(this.poiPreview.lng, this.poiPreview.lat);
    const marker = new runtime.api.Marker(point, {
      icon: this.getPoiPreviewIcon(runtime.api),
    });

    marker.setTitle?.(this.poiPreview.name);
    marker.setZIndex?.(30);
    this.map.addOverlay(marker);
    this.map.centerAndZoom(point, Math.max(this.map.getZoom(), 15));
    this.poiPreviewOverlay = marker;
  }

  private clearPoiPreviewOverlay() {
    if (this.map && this.poiPreviewOverlay) {
      this.map.removeOverlay(this.poiPreviewOverlay);
    }

    this.poiPreviewOverlay = null;
  }

  private getMarkerIcon(api: BaiduMapGlobal, markerItem: MapMarkerItem, isSelected: boolean, shouldShowLabel: boolean) {
    const label = shouldShowLabel ? formatMarkerLabel(markerItem.name) : "";
    const cacheKey = `${markerItem.color}:${markerItem.icon}:${isSelected ? "selected" : "default"}:${label}`;
    const cachedIcon = this.iconCache.get(cacheKey);

    if (cachedIcon) {
      return cachedIcon;
    }

    const width = getMarkerIconWidth(label, isSelected);
    const height = isSelected ? 44 : 36;
    const size = new api.Size(width, height);
    const icon = new api.Icon(buildMarkerIconDataUrl(markerItem.color, markerItem.icon, isSelected, label), size, {
      anchor: new api.Size(isSelected ? 18 : 15, height),
      imageSize: size,
    });

    this.iconCache.set(cacheKey, icon);
    return icon;
  }

  private shouldShowMarkerLabel(isSelected: boolean) {
    return isSelected || (this.map?.getZoom() ?? 0) >= MARKER_LABEL_MIN_ZOOM;
  }

  private getPoiPreviewIcon(api: BaiduMapGlobal) {
    const cacheKey = "poi-preview";
    const cachedIcon = this.iconCache.get(cacheKey);

    if (cachedIcon) {
      return cachedIcon;
    }

    const size = new api.Size(34, 42);
    const icon = new api.Icon(buildPoiPreviewIconDataUrl(), size, {
      anchor: new api.Size(17, 42),
      imageSize: size,
    });

    this.iconCache.set(cacheKey, icon);
    return icon;
  }

  private locateWithBaiduGeolocation(runtime: BaiduMapRuntime) {
    const Geolocation = runtime.api.Geolocation;

    if (!Geolocation) {
      return locateWithBrowserGeolocation(DEFAULT_LOCATION_TIMEOUT_MS);
    }

    return new Promise<MapCoordinate>((resolve, reject) => {
      let settled = false;
      const timeout = globalThis.setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error("MAP_LOCATION_TIMEOUT"));
        }
      }, DEFAULT_LOCATION_TIMEOUT_MS);

      const settle = (next: () => void) => {
        if (settled) {
          return;
        }

        settled = true;
        globalThis.clearTimeout(timeout);
        next();
      };

      try {
        const geolocation = new Geolocation();
        geolocation.getCurrentPosition(
          (result) => {
            const status = geolocation.getStatus?.();
            if (runtime.geolocationSuccessStatus !== undefined && status !== undefined && status !== runtime.geolocationSuccessStatus) {
              settle(() => reject(new Error("MAP_LOCATION_FAILED")));
              return;
            }

            const coordinate = readLocationCoordinate(result?.point);
            if (!coordinate) {
              settle(() => reject(new Error("MAP_LOCATION_FAILED")));
              return;
            }

            settle(() => resolve(coordinate));
          },
          { enableHighAccuracy: true, timeout: DEFAULT_LOCATION_TIMEOUT_MS, maximumAge: 30_000 },
        );
      } catch {
        settle(() => reject(new Error("MAP_LOCATION_FAILED")));
      }
    });
  }
}

export function createBaiduMapProvider(baiduAk: string) {
  return new BaiduMapProvider(baiduAk);
}

export function readBaiduMapRuntime() {
  if (typeof window === "undefined") {
    return undefined;
  }

  const runtimeWindow = window as Window & {
    BMapGL?: BaiduMapGlobal;
    BMAP_STATUS_SUCCESS?: number;
    BMAP_NORMAL_MAP?: unknown;
    BMAP_SATELLITE_MAP?: unknown;
  };

  if (!runtimeWindow.BMapGL) {
    return undefined;
  }

  return {
    api: runtimeWindow.BMapGL,
    geolocationSuccessStatus: runtimeWindow.BMAP_STATUS_SUCCESS,
    normalMapType: runtimeWindow.BMAP_NORMAL_MAP,
    satelliteMapType: runtimeWindow.BMAP_SATELLITE_MAP,
  };
}

function readClickCoordinate(event: BaiduMapClickEvent | undefined): MapCoordinate | null {
  if (!event) {
    return null;
  }

  const point = event.latlng ?? event.point;

  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    return null;
  }

  return {
    lng: point.lng,
    lat: point.lat,
  };
}

function stopBaiduDomEvent(event: BaiduMapClickEvent | undefined) {
  event?.domEvent?.preventDefault?.();
  event?.domEvent?.stopPropagation?.();
}

function readMarkerPosition(marker: BaiduMarkerInstance): MapCoordinate | null {
  const point = marker.getPosition?.();

  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    return null;
  }

  return {
    lng: point.lng,
    lat: point.lat,
  };
}

function locateWithBrowserGeolocation(timeoutMs: number) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(new Error("MAP_LOCATION_UNAVAILABLE"));
  }

  return new Promise<MapCoordinate>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinate = readLocationCoordinate({ lng: position.coords.longitude, lat: position.coords.latitude });
        if (!coordinate) {
          reject(new Error("MAP_LOCATION_FAILED"));
          return;
        }

        resolve(coordinate);
      },
      (error) => reject(new Error(getBrowserGeolocationErrorCode(error))),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

function readLocationCoordinate(point: BaiduPoint | undefined): MapCoordinate | null {
  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    return null;
  }

  return {
    lng: point.lng,
    lat: point.lat,
  };
}

function buildMarkerIconDataUrl(color: string, iconName: string, isSelected: boolean, label: string) {
  const pinWidth = isSelected ? 36 : 30;
  const width = getMarkerIconWidth(label, isSelected);
  const height = isSelected ? 44 : 36;
  const scale = isSelected ? 1.16 : 1;
  const centerX = isSelected ? 18 : 15;
  const centerY = isSelected ? 19 : 14;
  const iconTransform = `translate(${centerX - 7} ${centerY - 7}) scale(0.58)`;
  const selectedStroke = isSelected
    ? `<path d="M15 35C10 28 4 23 4 14a11 11 0 1 1 22 0c0 9-6 14-11 21Z" fill="none" stroke="#0f172a" stroke-width="2" transform="translate(3 3) scale(${scale})"/>`
    : "";
  const labelSvg = label
    ? `<text x="${pinWidth + 6}" y="${centerY + 4}" font-family="Arial,sans-serif" font-size="${isSelected ? 13 : 12}" font-weight="${isSelected ? 700 : 600}" fill="#0f172a" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" paint-order="stroke fill">${escapeSvgText(label)}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${selectedStroke}<path d="M15 35C10 28 4 23 4 14a11 11 0 1 1 22 0c0 9-6 14-11 21Z" fill="${escapeSvgAttribute(color)}" transform="translate(${isSelected ? 3 : 0} ${isSelected ? 3 : 0}) scale(${scale})"/><g transform="${iconTransform}" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${getMarkerIconPath(iconName)}</g>${labelSvg}</svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getMarkerIconWidth(label: string, isSelected: boolean) {
  if (!label) {
    return isSelected ? 36 : 30;
  }

  return (isSelected ? 36 : 30) + 8 + estimateLabelWidth(label, isSelected);
}

function estimateLabelWidth(label: string, isSelected: boolean) {
  return Math.min(168, Math.max(28, Array.from(label).reduce((total, character) => total + (character.charCodeAt(0) > 127 ? 13 : 7), 0) + (isSelected ? 4 : 0)));
}

function formatMarkerLabel(name: string) {
  const trimmedName = name.trim();
  const characters = Array.from(trimmedName);

  if (characters.length <= MARKER_LABEL_MAX_LENGTH) {
    return trimmedName;
  }

  return `${characters.slice(0, MARKER_LABEL_MAX_LENGTH).join("")}…`;
}

function getMarkerIconPath(iconName: string) {
  return MARKER_ICON_PATHS[iconName] ?? MARKER_ICON_PATHS.MapPin;
}

const MARKER_ICON_PATHS: Record<string, string> = {
  MapPin: '<path d="M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11Z"/><circle cx="12" cy="10" r="2"/>',
  Building2: '<path d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M9 16h.01M15 16h.01"/>',
  Store: '<path d="M4 10h16l-1-5H5l-1 5Z"/><path d="M6 10v10h12V10M9 20v-6h6v6"/>',
  Warehouse: '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-8h10v8M7 15h10"/>',
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  Flag: '<path d="M5 22V4"/><path d="M5 5h12l-1 5 1 5H5"/>',
  Star: '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
  BadgeAlert: '<path d="M12 3l8 4v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z"/><path d="M12 8v5M12 17h.01"/>',
  Wrench: '<path d="M14.7 6.3a5 5 0 0 0-6.4 6.4L3 18l3 3 5.3-5.3a5 5 0 0 0 6.4-6.4l-3 3-3-3 3-3Z"/>',
  Truck: '<path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  Car: '<path d="M5 12l2-5h10l2 5"/><path d="M5 12h14v6H5z"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/>',
  Bus: '<path d="M6 4h12a2 2 0 0 1 2 2v11H4V6a2 2 0 0 1 2-2Z"/><path d="M4 10h16M8 21h.01M16 21h.01"/>',
  Train: '<path d="M6 3h12a2 2 0 0 1 2 2v10a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2Z"/><path d="M8 9h8M8 15h.01M16 15h.01M9 22l3-3 3 3"/>',
  School: '<path d="M3 10l9-6 9 6-9 6-9-6Z"/><path d="M6 12v5c2 2 10 2 12 0v-5M21 10v6"/>',
  Hospital: '<path d="M5 21V5h14v16"/><path d="M12 8v8M8 12h8"/>',
  Utensils: '<path d="M4 3v8M8 3v8M4 7h4M6 11v10"/><path d="M16 3v18M16 3c3 2 4 5 4 8 0 2-1 4-4 4"/>',
  Factory: '<path d="M3 21V9l6 4V9l6 4V5h6v16"/><path d="M7 17h.01M11 17h.01M15 17h.01"/>',
  Home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v11h14V10M10 21v-6h4v6"/>',
  BriefcaseBusiness: '<path d="M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1"/><path d="M4 7h16v12H4z"/><path d="M4 12h16"/>',
  Landmark: '<path d="M3 10l9-6 9 6H3Z"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  Trees: '<path d="M8 19v-5"/><path d="M5 14l3-8 3 8H5Z"/><path d="M16 21v-7"/><path d="M12 14l4-10 4 10h-8Z"/>',
  Package: '<path d="M12 3l8 4-8 4-8-4 8-4Z"/><path d="M4 7v10l8 4 8-4V7M12 11v10"/>',
  Shield: '<path d="M12 3l8 4v6c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z"/>',
  HeartPulse: '<path d="M20.8 6.6a5.5 5.5 0 0 0-7.8 0L12 7.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 23l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/><path d="M4 13h4l2-3 3 6 2-3h5"/>',
};

function buildPoiPreviewIconDataUrl() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42"><path d="M17 40C11 31 5 25 5 16a12 12 0 1 1 24 0c0 9-6 15-12 24Z" fill="#0f766e" stroke="#ffffff" stroke-width="2"/><circle cx="17" cy="16" r="7" fill="#ffffff" fill-opacity="0.95"/><text x="17" y="19" text-anchor="middle" font-family="Arial,sans-serif" font-size="7" font-weight="700" fill="#0f766e">POI</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function escapeSvgAttribute(value: string) {
  return value.replace(/[&"<>]/g, (character) => SVG_ESCAPE[character]);
}

function escapeSvgText(value: string) {
  return value.replace(/[&<>]/g, (character) => SVG_ESCAPE[character]);
}

const SVG_ESCAPE: Record<string, string> = {
  "&": "&amp;",
  '"': "&quot;",
  "<": "&lt;",
  ">": "&gt;",
};
