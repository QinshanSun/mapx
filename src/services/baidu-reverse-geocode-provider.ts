import { loadBaiduMapScript, type BaiduMapLoadResult } from "@/services/baidu-map-loader";
import { readBaiduMapRuntime } from "@/services/baidu-map-provider";
import type { MapCoordinate } from "@/services/map-provider";

const DEFAULT_TIMEOUT_MS = 8000;

export interface BaiduReverseGeocodeRequest {
  baiduAk: string | null | undefined;
  coordinate: MapCoordinate;
  timeoutMs?: number;
}

export interface BaiduAddressResult {
  address: string | null;
  city: string | null;
  source: "baidu";
}

interface BaiduPointLike {
  lng?: number;
  lat?: number;
}

interface BaiduAddressComponentsLike {
  province?: string;
  city?: string;
  district?: string;
  street?: string;
  streetNumber?: string;
}

interface BaiduGeocoderResultLike {
  address?: string;
  addressComponents?: BaiduAddressComponentsLike;
}

interface BaiduGeocoderInstance {
  getLocation: (point: BaiduPointLike, callback: (result: BaiduGeocoderResultLike | null | undefined) => void) => void;
}

interface BaiduReverseGeocodeGlobal {
  Geocoder: new () => BaiduGeocoderInstance;
  Point: new (lng: number, lat: number) => BaiduPointLike;
}

interface BaiduReverseGeocodeRuntime {
  api: BaiduReverseGeocodeGlobal;
}

interface BaiduReverseGeocodeProviderOptions {
  loadScript?: typeof loadBaiduMapScript;
  getGlobal?: () => BaiduReverseGeocodeRuntime | undefined;
}

export class BaiduReverseGeocodeProvider {
  constructor(private readonly options: BaiduReverseGeocodeProviderOptions = {}) {}

  async reverseGeocode(request: BaiduReverseGeocodeRequest): Promise<BaiduAddressResult> {
    const ak = request.baiduAk?.trim();

    if (!ak) {
      throw new Error("BAIDU_AK_MISSING");
    }

    if (!Number.isFinite(request.coordinate.lng) || !Number.isFinite(request.coordinate.lat)) {
      throw new Error("BAIDU_REVERSE_GEOCODE_INVALID_COORDINATE");
    }

    const loadResult = await this.loadScript(ak);

    if (loadResult.status !== "loaded") {
      throw new Error(loadResult.code ?? "BAIDU_REVERSE_GEOCODE_UNAVAILABLE");
    }

    const runtime = this.getRuntime();

    if (!runtime?.api.Geocoder) {
      throw new Error("BAIDU_REVERSE_GEOCODE_UNAVAILABLE");
    }

    return this.reverseGeocodeWithRuntime(runtime, request.coordinate, request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }

  private loadScript(baiduAk: string): Promise<BaiduMapLoadResult> {
    return (this.options.loadScript ?? loadBaiduMapScript)(baiduAk);
  }

  private getRuntime() {
    return this.options.getGlobal?.() ?? readBaiduReverseGeocodeRuntime();
  }

  private reverseGeocodeWithRuntime(runtime: BaiduReverseGeocodeRuntime, coordinate: MapCoordinate, timeoutMs: number) {
    return new Promise<BaiduAddressResult>((resolve, reject) => {
      let settled = false;
      const timeoutId = globalThis.setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        reject(new Error("BAIDU_REVERSE_GEOCODE_TIMEOUT"));
      }, timeoutMs);

      try {
        const point = new runtime.api.Point(coordinate.lng, coordinate.lat);
        const geocoder = new runtime.api.Geocoder();

        geocoder.getLocation(point, (result) => {
          if (settled) {
            return;
          }

          settled = true;
          globalThis.clearTimeout(timeoutId);

          const address = readAddress(result);

          if (!address) {
            reject(new Error("BAIDU_REVERSE_GEOCODE_EMPTY"));
            return;
          }

          resolve({
            address,
            city: result?.addressComponents?.city?.trim() || null,
            source: "baidu",
          });
        });
      } catch {
        if (!settled) {
          settled = true;
          globalThis.clearTimeout(timeoutId);
          reject(new Error("BAIDU_REVERSE_GEOCODE_FAILED"));
        }
      }
    });
  }
}

export function reverseGeocodeBaiduAddress(request: BaiduReverseGeocodeRequest) {
  return new BaiduReverseGeocodeProvider().reverseGeocode(request);
}

export function getReverseGeocodeErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("BAIDU_AK_MISSING")) {
    return "未配置百度 AK，可手动填写地址。";
  }

  if (message.includes("BAIDU_REVERSE_GEOCODE_EMPTY")) {
    return "未获取到地址，可手动填写。";
  }

  if (message.includes("BAIDU_REVERSE_GEOCODE_INVALID_COORDINATE")) {
    return "坐标无效，可手动填写地址。";
  }

  return "地址获取失败，请检查 AK、白名单或网络连接。";
}

function readBaiduReverseGeocodeRuntime() {
  const runtime = readBaiduMapRuntime();
  const api = runtime?.api as { Geocoder?: unknown } | undefined;

  return api?.Geocoder ? (runtime as unknown as BaiduReverseGeocodeRuntime) : undefined;
}

function readAddress(result: BaiduGeocoderResultLike | null | undefined) {
  const directAddress = result?.address?.trim();

  if (directAddress) {
    return directAddress;
  }

  return buildAddressFromComponents(result?.addressComponents);
}

function buildAddressFromComponents(components: BaiduAddressComponentsLike | null | undefined) {
  const province = components?.province?.trim();
  const city = components?.city?.trim();
  const address = [province, city && city !== province ? city : undefined, components?.district, components?.street, components?.streetNumber]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("");

  return address || null;
}
