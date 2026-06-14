import { loadBaiduMapScript, type BaiduMapLoadResult } from "@/services/baidu-map-loader";
import { readBaiduMapRuntime } from "@/services/baidu-map-provider";

const BAIDU_SUCCESS_STATUS = 0;
const DEFAULT_PAGE_SIZE = 10;

export type BaiduPoiSearchScope =
  | { type: "city"; city: string }
  | { type: "national" };

export interface BaiduPoiSearchRequest {
  baiduAk: string | null | undefined;
  keyword: string;
  scope: BaiduPoiSearchScope;
  pageSize?: number;
}

export interface BaiduPoiResult {
  id: string;
  name: string;
  address: string | null;
  city: string | null;
  lng: number | null;
  lat: number | null;
  source: "baidu";
}

interface BaiduPoiSearchProviderOptions {
  loadScript?: typeof loadBaiduMapScript;
  getGlobal?: () => BaiduPoiSearchRuntime | undefined;
}

interface BaiduPointLike {
  lng?: number;
  lat?: number;
}

interface BaiduPoiLike {
  uid?: string;
  title?: string;
  name?: string;
  address?: string;
  city?: string;
  point?: BaiduPointLike;
}

interface BaiduPoiResultSetLike {
  getCurrentNumPois?: () => number;
  getNumPois?: () => number;
  getPoi?: (index: number) => BaiduPoiLike | null | undefined;
  getStatus?: () => number;
}

interface BaiduLocalSearchInstance {
  getStatus?: () => number;
  search: (keyword: string) => void;
}

interface BaiduPoiSearchGlobal {
  LocalSearch: new (
    location: string,
    options: {
      onSearchComplete: (results: BaiduPoiResultSetLike) => void;
      pageCapacity?: number;
    },
  ) => BaiduLocalSearchInstance;
}

interface BaiduPoiSearchRuntime {
  api: BaiduPoiSearchGlobal;
}

export class BaiduPoiSearchProvider {
  constructor(private readonly options: BaiduPoiSearchProviderOptions = {}) {}

  async search(request: BaiduPoiSearchRequest): Promise<BaiduPoiResult[]> {
    const keyword = request.keyword.trim();
    const ak = request.baiduAk?.trim();

    if (!keyword) {
      return [];
    }

    if (!ak) {
      throw new Error("BAIDU_AK_MISSING");
    }

    const loadResult = await this.loadScript(ak);

    if (loadResult.status !== "loaded") {
      throw new Error(loadResult.code ?? "BAIDU_POI_SEARCH_UNAVAILABLE");
    }

    const runtime = this.getRuntime();

    if (!runtime?.api.LocalSearch) {
      throw new Error("BAIDU_POI_SEARCH_UNAVAILABLE");
    }

    return this.searchWithRuntime(runtime, keyword, request.scope, request.pageSize ?? DEFAULT_PAGE_SIZE);
  }

  private loadScript(baiduAk: string): Promise<BaiduMapLoadResult> {
    return (this.options.loadScript ?? loadBaiduMapScript)(baiduAk);
  }

  private getRuntime() {
    return this.options.getGlobal?.() ?? readBaiduPoiSearchRuntime();
  }

  private searchWithRuntime(
    runtime: BaiduPoiSearchRuntime,
    keyword: string,
    scope: BaiduPoiSearchScope,
    pageSize: number,
  ) {
    return new Promise<BaiduPoiResult[]>((resolve, reject) => {
      const location = scope.type === "city" ? scope.city : "全国";
      let settled = false;
      const search = new runtime.api.LocalSearch(location, {
        pageCapacity: pageSize,
        onSearchComplete: (resultSet) => {
          if (settled) {
            return;
          }

          settled = true;
          const status = search.getStatus?.() ?? resultSet.getStatus?.() ?? BAIDU_SUCCESS_STATUS;

          if (status !== BAIDU_SUCCESS_STATUS) {
            reject(new Error("BAIDU_POI_SEARCH_FAILED"));
            return;
          }

          resolve(readPoiResults(resultSet));
        },
      });

      search.search(keyword);
    });
  }
}

export function searchBaiduPois(request: BaiduPoiSearchRequest) {
  return new BaiduPoiSearchProvider().search(request);
}

function readBaiduPoiSearchRuntime() {
  const runtime = readBaiduMapRuntime();

  return runtime?.api.LocalSearch ? (runtime as unknown as BaiduPoiSearchRuntime) : undefined;
}

function readPoiResults(resultSet: BaiduPoiResultSetLike): BaiduPoiResult[] {
  const count = resultSet.getCurrentNumPois?.() ?? resultSet.getNumPois?.() ?? 0;
  const results: BaiduPoiResult[] = [];

  for (let index = 0; index < count; index += 1) {
    const poi = resultSet.getPoi?.(index);
    const name = (poi?.title ?? poi?.name ?? "").trim();

    if (!poi || !name) {
      continue;
    }

    const coordinate = readCoordinate(poi.point);
    const address = poi.address?.trim() || null;
    const city = poi.city?.trim() || null;

    results.push({
      id: poi.uid?.trim() || `${city ?? "city"}:${name}:${address ?? "address"}:${index}`,
      name,
      address,
      city,
      lng: coordinate?.lng ?? null,
      lat: coordinate?.lat ?? null,
      source: "baidu",
    });
  }

  return results;
}

function readCoordinate(point: BaiduPointLike | null | undefined) {
  if (!point || !Number.isFinite(point.lng) || !Number.isFinite(point.lat)) {
    return null;
  }

  return {
    lng: point.lng as number,
    lat: point.lat as number,
  };
}
