import { Filter, ListFilter, MapPin, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { listProjectCategories } from "@/services/category-service";
import { filterAndSortMarkers, type MarkerListFilters, type MarkerSortKey } from "@/services/marker-list";
import { listProjectMarkers } from "@/services/marker-service";
import { listProjectTags } from "@/services/tag-service";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

const rowHeight = 78;
const viewportHeight = 520;
const overscan = 4;

interface MarkerListPanelProps {
  projectId: string;
  selectedMarkerId: string | null;
  refreshKey: number;
  filters: MarkerListFilters;
  onSelectMarker: (marker: MarkerRecord) => void;
  onFiltersChange: (filters: MarkerListFilters) => void;
  onFilteredMarkersChange: (markers: MarkerRecord[], categories: CategoryRecord[]) => void;
  onError: (error: unknown) => void;
}

export function MarkerListPanel({
  projectId,
  selectedMarkerId,
  refreshKey,
  filters,
  onSelectMarker,
  onFiltersChange,
  onFilteredMarkersChange,
  onError,
}: MarkerListPanelProps) {
  const [markers, setMarkers] = useState<MarkerRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [scrollTop, setScrollTop] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const filteredMarkers = useMemo(() => filterAndSortMarkers(markers, filters), [filters, markers]);
  const totalHeight = filteredMarkers.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(filteredMarkers.length, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  const visibleMarkers = filteredMarkers.slice(startIndex, endIndex);

  useEffect(() => {
    let isActive = true;

    Promise.all([listProjectMarkers(projectId), listProjectCategories(projectId), listProjectTags(projectId)])
      .then(([nextMarkers, nextCategories, nextTags]) => {
        if (isActive) {
          setMarkers(nextMarkers);
          setCategories(nextCategories);
          setTags(nextTags);
          setScrollTop(0);
        }
      })
      .catch(onError)
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [onError, projectId, refreshKey]);

  useEffect(() => {
    onFilteredMarkersChange(filteredMarkers, categories);
  }, [categories, filteredMarkers, onFilteredMarkersChange]);

  function updateFilter(nextFilters: Partial<MarkerListFilters>) {
    onFiltersChange({ ...filters, ...nextFilters });
    setScrollTop(0);
  }

  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-border bg-white">
      <header className="border-b border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">点位</p>
            <h3 className="text-base font-semibold">点位列表</h3>
          </div>
          <ListFilter className="size-4 text-muted-foreground" />
        </div>

        <div className="grid gap-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="marker-category-filter">
            分类
          </label>
          <select
            id="marker-category-filter"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            value={filters.categoryId}
            onChange={(event) => updateFilter({ categoryId: event.target.value })}
          >
            <option value="all">全部分类</option>
            <option value="uncategorized">未分类</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <label className="text-xs font-medium text-muted-foreground" htmlFor="marker-tag-filter">
            标签
          </label>
          <select
            id="marker-tag-filter"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
            value={filters.tagId}
            onChange={(event) => updateFilter({ tagId: event.target.value })}
          >
            <option value="all">全部标签</option>
            {tags.map((tagItem) => (
              <option key={tagItem.id} value={tagItem.id}>
                {tagItem.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" />
            <select
              className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
              value={filters.sortKey}
              onChange={(event) => updateFilter({ sortKey: event.target.value as MarkerSortKey })}
            >
              <option value="updatedDesc">最近更新</option>
              <option value="createdDesc">最近创建</option>
              <option value="nameAsc">名称 A-Z</option>
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{isLoading ? "正在读取" : `${filteredMarkers.length} / ${markers.length} 个点位`}</span>
          <Filter className="size-4" />
        </div>
      </header>

      <div
        className="relative flex-1 overflow-auto"
        style={{ maxHeight: viewportHeight }}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div style={{ height: totalHeight || viewportHeight }}>
          {visibleMarkers.map((marker, index) => {
            const category = categories.find((item) => item.id === marker.categoryId) ?? null;
            const isSelected = marker.id === selectedMarkerId;

            return (
              <button
                key={marker.id}
                type="button"
                className={`absolute left-0 right-0 mx-3 rounded-md border p-3 text-left text-sm transition ${
                  isSelected
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-border bg-white hover:border-primary/40 hover:bg-accent"
                }`}
                style={{ top: (startIndex + index) * rowHeight, height: rowHeight - 8 }}
                onClick={() => onSelectMarker(marker)}
              >
                <span className="flex items-center gap-2 font-medium">
                  <MapPin className="size-4" style={{ color: category?.color ?? "#64748b" }} />
                  <span className="min-w-0 truncate">{marker.name}</span>
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {category?.name ?? "未分类"} · {marker.address ?? "无地址"}
                </span>
              </button>
            );
          })}

          {!isLoading && filteredMarkers.length === 0 ? (
            <div className="p-5 text-sm leading-6 text-muted-foreground">当前筛选条件下没有点位。</div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}
