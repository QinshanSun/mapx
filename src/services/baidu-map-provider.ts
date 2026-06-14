import { loadBaiduMapScript, type BaiduMapLoadResult } from "@/services/baidu-map-loader";
import type { MapCoordinate, MapMarkerItem, MapPoiPreview, MapProvider, MapViewState } from "@/services/map-provider";
import type { MapLayer } from "@/types/project";

interface BaiduPoint {
  lng: number;
  lat: number;
}

interface BaiduMapInstance {
  addEventListener?: (eventName: string, handler: (event: BaiduMapClickEvent) => void) => void;
  addOverlay(overlay: unknown): void;
  centerAndZoom(point: BaiduPoint, zoom: number): void;
  getCenter(): BaiduPoint;
  getZoom(): number;
  removeOverlay(overlay: unknown): void;
  setMapType?: (mapType: unknown) => void;
  destroy?: () => void;
}

interface BaiduMapClickEvent {
  latlng?: BaiduPoint;
  point?: BaiduPoint;
}

interface BaiduIconOptions {
  anchor?: unknown;
  imageSize?: unknown;
}

interface BaiduMarkerInstance {
  addEventListener?: (eventName: string, handler: () => void) => void;
  setIcon?: (icon: unknown) => void;
  setTitle?: (title: string) => void;
  setZIndex?: (zIndex: number) => void;
}

export interface BaiduMapGlobal {
  Icon: new (url: string, size: unknown, options?: BaiduIconOptions) => unknown;
  LocalSearch?: unknown;
  Map: new (container: HTMLElement) => BaiduMapInstance;
  Marker: new (point: BaiduPoint, options?: { icon?: unknown }) => BaiduMarkerInstance;
  Point: new (lng: number, lat: number) => BaiduPoint;
  Size: new (width: number, height: number) => unknown;
}

export interface BaiduMapRuntime {
  api: BaiduMapGlobal;
  normalMapType?: unknown;
  satelliteMapType?: unknown;
}

interface BaiduMapProviderOptions {
  loadScript?: typeof loadBaiduMapScript;
  getGlobal?: () => BaiduMapRuntime | undefined;
}

export class BaiduMapProvider implements MapProvider {
  private map: BaiduMapInstance | null = null;
  private container: HTMLElement | null = null;
  private iconCache = new Map<string, unknown>();
  private isDestroyed = true;
  private layer: MapLayer = "normal";
  private mapClickHandler: ((coordinate: MapCoordinate) => void) | null = null;
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
    this.map.addEventListener?.("click", (event) => {
      const coordinate = readClickCoordinate(event);
      if (coordinate) {
        this.mapClickHandler?.(coordinate);
      }
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

  setPoiPreview(preview: MapPoiPreview | null) {
    this.poiPreview = preview;
    this.renderPoiPreview();
  }

  setMarkerClickHandler(handler: ((markerId: string) => void) | null) {
    this.markerClickHandler = handler;
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
      const point = new runtime.api.Point(markerItem.lng, markerItem.lat);
      const marker = new runtime.api.Marker(point, {
        icon: this.getMarkerIcon(runtime.api, markerItem, isSelected),
      });

      marker.setTitle?.(markerItem.name);
      marker.setZIndex?.(isSelected ? 20 : 10);
      marker.addEventListener?.("click", () => {
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

  private getMarkerIcon(api: BaiduMapGlobal, markerItem: MapMarkerItem, isSelected: boolean) {
    const cacheKey = `${markerItem.color}:${markerItem.icon}:${isSelected ? "selected" : "default"}`;
    const cachedIcon = this.iconCache.get(cacheKey);

    if (cachedIcon) {
      return cachedIcon;
    }

    const width = isSelected ? 36 : 30;
    const height = isSelected ? 44 : 36;
    const size = new api.Size(width, height);
    const icon = new api.Icon(buildMarkerIconDataUrl(markerItem.color, markerItem.icon, isSelected), size, {
      anchor: new api.Size(width / 2, height),
      imageSize: size,
    });

    this.iconCache.set(cacheKey, icon);
    return icon;
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
    BMAP_NORMAL_MAP?: unknown;
    BMAP_SATELLITE_MAP?: unknown;
  };

  if (!runtimeWindow.BMapGL) {
    return undefined;
  }

  return {
    api: runtimeWindow.BMapGL,
    normalMapType: runtimeWindow.BMAP_NORMAL_MAP,
    satelliteMapType: runtimeWindow.BMAP_SATELLITE_MAP,
  };
}

function readClickCoordinate(event: BaiduMapClickEvent): MapCoordinate | null {
  const point = event.latlng ?? event.point;

  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    return null;
  }

  return {
    lng: point.lng,
    lat: point.lat,
  };
}

function buildMarkerIconDataUrl(color: string, iconName: string, isSelected: boolean) {
  const normalizedIconName = iconName.replace(/[^A-Za-z0-9]/g, "");
  const uppercaseLetters = normalizedIconName.replace(/[a-z0-9]/g, "");
  const label = (uppercaseLetters || normalizedIconName.charAt(0).toUpperCase() || "M").slice(0, 2);
  const width = isSelected ? 36 : 30;
  const height = isSelected ? 44 : 36;
  const scale = isSelected ? 1.16 : 1;
  const stroke = isSelected ? `<path d="M15 35C10 28 4 23 4 14a11 11 0 1 1 22 0c0 9-6 14-11 21Z" fill="none" stroke="#0f172a" stroke-width="2" transform="translate(3 3) scale(${scale})"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${stroke}<path d="M15 35C10 28 4 23 4 14a11 11 0 1 1 22 0c0 9-6 14-11 21Z" fill="${escapeSvgAttribute(color)}" transform="translate(${isSelected ? 3 : 0} ${isSelected ? 3 : 0}) scale(${scale})"/><circle cx="${width / 2}" cy="${isSelected ? 19 : 14}" r="8" fill="white" fill-opacity="0.92"/><text x="${width / 2}" y="${isSelected ? 22 : 17}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="${escapeSvgAttribute(color)}">${escapeSvgText(label)}</text></svg>`;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

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
