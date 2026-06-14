import { FolderOpen, MapPin, Plus, Settings, Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { listProjectCategories } from "@/services/category-service";
import { buildMarkerOverviewSnapshot } from "@/services/marker-overview";
import { listProjectMarkers } from "@/services/marker-service";
import { listProjectTags } from "@/services/tag-service";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

interface MarkerOverviewPanelProps {
  projectId: string;
  onCreateMarkerRequest: () => void;
  onCreateCategoryRequest: () => void;
  onCreateTagRequest: () => void;
  onError: (error: unknown) => void;
}

export function MarkerOverviewPanel({
  projectId,
  onCreateMarkerRequest,
  onCreateCategoryRequest,
  onCreateTagRequest,
  onError,
}: MarkerOverviewPanelProps) {
  const [markers, setMarkers] = useState<MarkerRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const snapshot = useMemo(() => buildMarkerOverviewSnapshot(markers, categories, tags), [categories, markers, tags]);

  useEffect(() => {
    let isActive = true;

    Promise.all([listProjectMarkers(projectId), listProjectCategories(projectId), listProjectTags(projectId)])
      .then(([nextMarkers, nextCategories, nextTags]) => {
        if (isActive) {
          setMarkers(nextMarkers);
          setCategories(nextCategories);
          setTags(nextTags);
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
  }, [onError, projectId]);

  return (
    <div className="space-y-4 p-5">
      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">项目概览</h3>
          <FolderOpen className="size-4 text-muted-foreground" />
        </div>

        <dl className="grid grid-cols-3 gap-2 text-sm">
          <OverviewStat label="点位" value={isLoading ? "-" : snapshot.markerCount.toString()} />
          <OverviewStat label="分类" value={isLoading ? "-" : snapshot.categoryCount.toString()} />
          <OverviewStat label="标签" value={isLoading ? "-" : snapshot.tagCount.toString()} />
        </dl>
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">快速操作</h3>
          <Plus className="size-4 text-muted-foreground" />
        </div>
        <div className="grid gap-2">
          <Button type="button" size="sm" className="justify-start" onClick={onCreateMarkerRequest}>
            <MapPin />
            新建点位
          </Button>
          <Button type="button" size="sm" variant="outline" className="justify-start" onClick={onCreateCategoryRequest}>
            <Settings />
            新建分类
          </Button>
          <Button type="button" size="sm" variant="outline" className="justify-start" onClick={onCreateTagRequest}>
            <Tag />
            新建标签
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">最近添加</h3>
          <MapPin className="size-4 text-muted-foreground" />
        </div>

        {isLoading ? <p className="text-xs text-muted-foreground">正在读取点位</p> : null}
        {!isLoading && snapshot.recentMarkers.length === 0 ? <p className="text-xs text-muted-foreground">暂无点位</p> : null}
        <div className="space-y-2">
          {snapshot.recentMarkers.map((marker) => (
            <div key={marker.id} className="rounded-md border border-border bg-slate-50 px-3 py-2">
              <p className="truncate text-sm font-medium">{marker.name}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">{marker.address ?? "无地址"}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-slate-50 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-lg font-semibold leading-6">{value}</dd>
    </div>
  );
}
