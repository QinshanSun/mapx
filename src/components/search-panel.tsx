import { MapPin, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { listProjectCategories } from "@/services/category-service";
import { searchProjectMarkers } from "@/services/marker-service";
import { listProjectTags } from "@/services/tag-service";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

interface SearchPanelProps {
  projectId: string;
  selectedMarkerId: string | null;
  onSelectMarker: (marker: MarkerRecord) => void;
  onError: (error: unknown) => void;
}

export function SearchPanel({ projectId, selectedMarkerId, onSelectMarker, onError }: SearchPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [keyword, setKeyword] = useState("");
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [results, setResults] = useState<MarkerRecord[]>([]);
  const [resultKeyword, setResultKeyword] = useState("");
  const trimmedKeyword = keyword.trim();
  const visibleResults = trimmedKeyword && trimmedKeyword === resultKeyword ? results : [];
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
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {trimmedKeyword ? `我的点位 ${visibleResults.length} 个结果` : "输入关键词搜索当前项目点位"}
        </p>
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
