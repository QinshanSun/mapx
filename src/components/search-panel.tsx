import { AlertCircle, Building2, Globe2, Loader2, MapPin, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { MapCanvasAvailability } from "@/components/map-canvas";
import { CHINA_CITIES } from "@/data/china-cities";
import {
  searchBaiduPois,
  type BaiduPoiResult,
  type BaiduPoiSearchScope,
} from "@/services/baidu-poi-search-provider";
import { listProjectCategories } from "@/services/category-service";
import { searchProjectMarkers } from "@/services/marker-service";
import { listProjectTags } from "@/services/tag-service";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

interface SearchPanelProps {
  projectId: string;
  baiduAk: string | null;
  searchCity: string;
  mapAvailability: MapCanvasAvailability;
  selectedMarkerId: string | null;
  selectedPoiId: string | null;
  onSearchCityChange: (city: string) => Promise<void>;
  onSelectMarker: (marker: MarkerRecord) => void;
  onPreviewPoi: (poi: BaiduPoiResult) => void;
  onCancelPoiPreview: () => void;
  onError: (error: unknown) => void;
}

type PoiSearchStatus = "idle" | "loading" | "success" | "unavailable" | "failed";

interface PoiSearchState {
  key: string;
  status: Extract<PoiSearchStatus, "success" | "failed">;
  results: BaiduPoiResult[];
  message: string;
}

export function SearchPanel({
  projectId,
  baiduAk,
  searchCity,
  mapAvailability,
  selectedMarkerId,
  selectedPoiId,
  onSearchCityChange,
  onSelectMarker,
  onPreviewPoi,
  onCancelPoiPreview,
  onError,
}: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [keyword, setKeyword] = useState("");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [results, setResults] = useState<MarkerRecord[]>([]);
  const [poiSearchState, setPoiSearchState] = useState<PoiSearchState | null>(null);
  const [isNationalScope, setIsNationalScope] = useState(false);
  const [isCitySaving, setIsCitySaving] = useState(false);
  const [resultKeyword, setResultKeyword] = useState("");
  const trimmedKeyword = keyword.trim();
  const visibleResults = trimmedKeyword && trimmedKeyword === resultKeyword ? results : [];
  const baiduUnavailableMessage = getBaiduUnavailableMessage(baiduAk, mapAvailability);
  const poiScope = useMemo<BaiduPoiSearchScope>(
    () => (isNationalScope ? { type: "national" } : { type: "city", city: searchCity }),
    [isNationalScope, searchCity],
  );
  const poiRequestKey = buildPoiRequestKey(trimmedKeyword, poiScope);
  const poiSearchMatches = poiSearchState?.key === poiRequestKey;
  const poiStatus: PoiSearchStatus = !trimmedKeyword
    ? "idle"
    : baiduUnavailableMessage
      ? "unavailable"
      : poiSearchMatches
        ? poiSearchState.status
        : "loading";
  const poiMessage = baiduUnavailableMessage ?? (poiSearchMatches ? poiSearchState.message : "");
  const poiResults = poiStatus === "success" && poiSearchMatches ? poiSearchState.results : [];
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const tagById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;

    Promise.all([listProjectCategories(projectId), listProjectTags(projectId)])
      .then(([nextCategories, nextTags]) => {
        if (isActive) {
          setCategories(nextCategories);
          setTags(nextTags);
        }
      })
      .catch(onError);

    return () => {
      isActive = false;
    };
  }, [onError, projectId]);

  useEffect(() => {
    let isActive = true;

    if (!trimmedKeyword) {
      return () => {
        isActive = false;
      };
    }

    searchProjectMarkers(projectId, trimmedKeyword)
      .then((nextResults) => {
        if (isActive) {
          setResults(nextResults);
          setResultKeyword(trimmedKeyword);
        }
      })
      .catch(onError);

    return () => {
      isActive = false;
    };
  }, [onError, projectId, trimmedKeyword]);

  useEffect(() => {
    let isActive = true;

    if (!trimmedKeyword || baiduUnavailableMessage) {
      return () => {
        isActive = false;
      };
    }

    searchBaiduPois({ baiduAk, keyword: trimmedKeyword, scope: poiScope })
      .then((nextResults) => {
        if (isActive) {
          setPoiSearchState({ key: poiRequestKey, status: "success", results: nextResults, message: "" });
        }
      })
      .catch((error) => {
        if (isActive) {
          setPoiSearchState({ key: poiRequestKey, status: "failed", results: [], message: getBaiduSearchErrorMessage(error) });
        }
      });

    return () => {
      isActive = false;
    };
  }, [baiduAk, baiduUnavailableMessage, poiRequestKey, poiScope, trimmedKeyword]);

  function handleKeywordChange(nextKeyword: string) {
    setKeyword(nextKeyword);
    setIsNationalScope(false);
    onCancelPoiPreview();
  }

  function handleSearchCityChange(nextCity: string) {
    setIsNationalScope(false);
    onCancelPoiPreview();
    setIsCitySaving(true);
    onSearchCityChange(nextCity)
      .catch(() => undefined)
      .finally(() => setIsCitySaving(false));
  }

  function expandToNationalSearch() {
    setIsNationalScope(true);
    onCancelPoiPreview();
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-white">
      <header className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">搜索</p>
            <h3 className="text-base font-semibold">搜索结果</h3>
          </div>
          <Search className="size-4 text-muted-foreground" />
        </div>

        <label className="text-xs font-medium text-muted-foreground" htmlFor="workspace-local-search">
          关键词
        </label>
        <div className="mt-2 flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2 focus-within:border-primary">
          <Search className="size-4 text-muted-foreground" />
          <input
            ref={inputRef}
            id="workspace-local-search"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            value={keyword}
            onChange={(event) => handleKeywordChange(event.target.value)}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {trimmedKeyword ? `我的点位 ${visibleResults.length} 个结果` : "输入关键词搜索当前项目点位"}
        </p>

        <div className="mt-4 grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="workspace-search-city">
            搜索城市
          </label>
          <select
            id="workspace-search-city"
            className="h-9 rounded-md border border-input bg-white px-2 text-sm outline-none focus:border-primary"
            value={searchCity}
            disabled={isCitySaving}
            onChange={(event) => handleSearchCityChange(event.target.value)}
          >
            {CHINA_CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        {trimmedKeyword ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">我的点位</h4>
              <span className="text-xs text-muted-foreground">{visibleResults.length}</span>
            </div>

            {visibleResults.length === 0 ? (
              <p className="rounded-md border border-border bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
                没有匹配的本地点位。
              </p>
            ) : null}

            <div className="space-y-2">
              {visibleResults.map((marker) => {
                const category = marker.categoryId ? categoryById.get(marker.categoryId) ?? null : null;
                const markerTags = marker.tagIds.map((tagId) => tagById.get(tagId)?.name).filter(Boolean);
                const isSelected = marker.id === selectedMarkerId;

                return (
                  <button
                    key={marker.id}
                    type="button"
                    className={`w-full rounded-md border p-3 text-left text-sm transition ${
                      isSelected
                        ? "border-primary/40 bg-primary/5 text-primary"
                        : "border-border bg-white hover:border-primary/40 hover:bg-accent"
                    }`}
                    onClick={() => onSelectMarker(marker)}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <MapPin className="size-4" style={{ color: category?.color ?? "#64748b" }} />
                      <span className="min-w-0 truncate">{marker.name}</span>
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {category?.name ?? "未分类"} · {marker.address ?? "无地址"}
                    </span>
                    {markerTags.length > 0 ? <span className="mt-2 block truncate text-xs text-muted-foreground">{markerTags.join(" / ")}</span> : null}
                  </button>
                );
              })}
            </div>

            <section className="mt-5 border-t border-border pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold">百度地点</h4>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {poiScope.type === "city" ? searchCity : "全国"}
                  </p>
                </div>
                {selectedPoiId ? (
                  <Button type="button" size="sm" variant="ghost" onClick={onCancelPoiPreview}>
                    <X />
                    取消预览
                  </Button>
                ) : poiScope.type === "city" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={poiStatus === "loading" || Boolean(baiduUnavailableMessage)}
                    onClick={expandToNationalSearch}
                  >
                    <Globe2 />
                    扩大到全国
                  </Button>
                ) : null}
              </div>

              {poiStatus === "loading" ? (
                <SearchNotice icon="loading" message="正在搜索百度 POI。" />
              ) : null}
              {poiStatus === "unavailable" || poiStatus === "failed" ? <SearchNotice icon="alert" message={poiMessage} /> : null}
              {poiStatus === "success" && poiResults.length === 0 ? <SearchNotice icon="empty" message="当前范围没有匹配的百度 POI。" /> : null}

              <div className="space-y-2">
                {poiResults.map((poi) => {
                  const coordinate = poi.lng !== null && poi.lat !== null ? { lng: poi.lng, lat: poi.lat } : null;
                  const isPreviewed = poi.id === selectedPoiId;

                  return (
                    <button
                      key={poi.id}
                      type="button"
                      className={`w-full rounded-md border p-3 text-left text-sm transition ${
                        isPreviewed
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "border-border bg-white hover:border-primary/40 hover:bg-accent"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      disabled={!coordinate}
                      onClick={() => onPreviewPoi(poi)}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Building2 className="size-4 text-primary" />
                        <span className="min-w-0 truncate">{poi.name}</span>
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {poi.city ?? "未知城市"} · {poi.address ?? "无地址"}
                      </span>
                      {coordinate ? (
                        <span className="mt-2 block text-xs text-muted-foreground">
                          {coordinate.lng.toFixed(5)}, {coordinate.lat.toFixed(5)}
                        </span>
                      ) : (
                        <span className="mt-2 block text-xs text-muted-foreground">暂无坐标，不能预览</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </section>
        ) : (
          <div className="rounded-md border border-border bg-slate-50 p-4 text-sm leading-6 text-muted-foreground">
            本地搜索会匹配点位名称、地址、分类和标签。
          </div>
        )}
      </div>
    </aside>
  );
}

function SearchNotice({ icon, message }: { icon: "alert" | "empty" | "loading"; message: string }) {
  const Icon = icon === "loading" ? Loader2 : icon === "alert" ? AlertCircle : Search;

  return (
    <p className="mb-3 flex items-start gap-2 rounded-md border border-border bg-slate-50 p-3 text-sm leading-6 text-muted-foreground">
      <Icon className={`mt-1 size-4 shrink-0 ${icon === "loading" ? "animate-spin" : ""}`} />
      <span>{message}</span>
    </p>
  );
}

function getBaiduUnavailableMessage(baiduAk: string | null, mapAvailability: MapCanvasAvailability) {
  if (!baiduAk?.trim()) {
    return "未配置百度地图 AK，百度 POI 暂不可用。";
  }

  if (mapAvailability === "loading") {
    return "百度地图加载中，暂不能搜索百度 POI。";
  }

  if (mapAvailability === "failed") {
    return "百度地图不可用，请检查 AK、白名单或网络连接。";
  }

  if (mapAvailability === "missing-ak") {
    return "未配置百度地图 AK，百度 POI 暂不可用。";
  }

  return null;
}

function buildPoiRequestKey(keyword: string, scope: BaiduPoiSearchScope) {
  return scope.type === "city" ? `${keyword}:city:${scope.city}` : `${keyword}:national`;
}

function getBaiduSearchErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("BAIDU_AK_MISSING")) {
    return "未配置百度地图 AK，百度 POI 暂不可用。";
  }

  if (message.includes("BAIDU_POI_SEARCH_FAILED")) {
    return "百度 POI 搜索失败，请稍后重试或扩大搜索范围。";
  }

  return "百度 POI 暂不可用，请检查 AK、白名单或网络连接。";
}
