import { loadBaiduMapScript, type BaiduMapLoadResult } from "@/services/baidu-map-loader";
import type { MapProvider, MapViewState } from "@/services/map-provider";
import type { MapLayer } from "@/types/project";

interface BaiduPoint {
  lng: number;
  lat: number;
}

interface BaiduMapInstance {
  centerAndZoom(point: BaiduPoint, zoom: number): void;
  getCenter(): BaiduPoint;
  getZoom(): number;
  setMapType?: (mapType: unknown) => void;
  destroy?: () => void;
}

interface BaiduMapGlobal {
  Map: new (container: HTMLElement) => BaiduMapInstance;
  Point: new (lng: number, lat: number) => BaiduPoint;
}

interface BaiduMapRuntime {
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
  private isDestroyed = true;
  private layer: MapLayer = "normal";

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
    this.setView(view);
    this.setLayer(this.layer);
  }

  destroy() {
    this.isDestroyed = true;
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

  private loadScript(): Promise<BaiduMapLoadResult> {
    return (this.options.loadScript ?? loadBaiduMapScript)(this.baiduAk);
  }

  private getRuntime() {
    return this.options.getGlobal?.() ?? readBaiduMapGlobal();
  }
}

export function createBaiduMapProvider(baiduAk: string) {
  return new BaiduMapProvider(baiduAk);
}

function readBaiduMapGlobal() {
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
