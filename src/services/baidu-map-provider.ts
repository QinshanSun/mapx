import { loadBaiduMapScript, type BaiduMapLoadResult } from "@/services/baidu-map-loader";
import type { MapProvider, MapViewState } from "@/services/map-provider";

interface BaiduPoint {
  lng: number;
  lat: number;
}

interface BaiduMapInstance {
  centerAndZoom(point: BaiduPoint, zoom: number): void;
  getCenter(): BaiduPoint;
  getZoom(): number;
  destroy?: () => void;
}

interface BaiduMapGlobal {
  Map: new (container: HTMLElement) => BaiduMapInstance;
  Point: new (lng: number, lat: number) => BaiduPoint;
}

interface BaiduMapProviderOptions {
  loadScript?: typeof loadBaiduMapScript;
  getGlobal?: () => BaiduMapGlobal | undefined;
}

export class BaiduMapProvider implements MapProvider {
  private map: BaiduMapInstance | null = null;
  private container: HTMLElement | null = null;
  private isDestroyed = true;

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

    const api = this.getApi();
    if (this.isDestroyed) {
      return;
    }

    if (!api) {
      throw new Error("BAIDU_MAP_LOAD_FAILED");
    }

    this.container = container;
    this.map = new api.Map(container);
    this.setView(view);
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

    const api = this.getApi();
    if (!api) {
      return;
    }

    this.map.centerAndZoom(new api.Point(view.center.lng, view.center.lat), view.zoom);
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

  private loadScript(): Promise<BaiduMapLoadResult> {
    return (this.options.loadScript ?? loadBaiduMapScript)(this.baiduAk);
  }

  private getApi() {
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

  return (window as Window & { BMapGL?: BaiduMapGlobal }).BMapGL;
}
