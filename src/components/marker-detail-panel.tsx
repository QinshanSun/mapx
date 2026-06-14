import { Check, MapPin, Pencil, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { listProjectCategories } from "@/services/category-service";
import {
  buildMarkerUpdate,
  markerToFormState,
  validateMarkerDetailForm,
  type MarkerDetailFormState,
} from "@/services/marker-detail-form";
import { updateMarker } from "@/services/marker-service";
import { listProjectTags } from "@/services/tag-service";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

interface MarkerDetailPanelProps {
  projectId: string;
  marker: MarkerRecord | null;
  onSaved: (marker: MarkerRecord) => void;
  onError: (error: unknown) => void;
}

export function MarkerDetailPanel({ projectId, marker, onSaved, onError }: MarkerDetailPanelProps) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [formState, setFormState] = useState<MarkerDetailFormState>(() => markerToFormState(marker));
  const category = categories.find((item) => item.id === marker?.categoryId) ?? null;
  const markerTags = useMemo(
    () => tags.filter((tagItem) => marker?.tagIds.includes(tagItem.id)),
    [marker?.tagIds, tags],
  );

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

  if (!marker) {
    return (
      <div className="space-y-4 p-5">
        <section className="rounded-lg border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
          <MapPin className="mb-3 size-5 text-muted-foreground" />
          <p>从左侧点位列表选择一个点位后，这里会显示详情和编辑入口。</p>
        </section>
      </div>
    );
  }

  const currentMarker = marker;

  function updateForm(nextState: Partial<MarkerDetailFormState>) {
    setFormState((currentState) => ({ ...currentState, ...nextState }));
  }

  function toggleTag(tagId: string) {
    setFormState((currentState) => ({
      ...currentState,
      tagIds: currentState.tagIds.includes(tagId)
        ? currentState.tagIds.filter((currentTagId) => currentTagId !== tagId)
        : [...currentState.tagIds, tagId],
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateMarkerDetailForm(formState);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const nextMarker = await updateMarker(buildMarkerUpdate(currentMarker, formState));
      onSaved(nextMarker);
      setFormState(markerToFormState(nextMarker));
      setIsEditing(false);
      setLocalError(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    return (
      <div className="space-y-4 p-5">
        <section className="rounded-lg border border-border p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">点位</p>
              <h3 className="mt-1 truncate text-base font-semibold">{marker.name}</h3>
            </div>
            <Button type="button" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil />
              编辑
            </Button>
          </div>

          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">地址</dt>
              <dd className="mt-1 leading-6">{marker.address ?? "未填写"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">分类</dt>
              <dd className="mt-1 flex items-center gap-2">
                <span className="inline-block size-2 rounded-full" style={{ backgroundColor: category?.color ?? "#64748b" }} />
                {category?.name ?? "未分类"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">标签</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {markerTags.length > 0 ? (
                  markerTags.map((tagItem) => (
                    <span key={tagItem.id} className="rounded-md border border-border bg-slate-50 px-2 py-1 text-xs">
                      {tagItem.name}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">无标签</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">备注</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-6">{marker.note ?? "未填写"}</dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-muted-foreground">坐标</dt>
                <dd className="mt-1 font-medium">
                  {marker.lng.toFixed(6)}, {marker.lat.toFixed(6)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">坐标系</dt>
                <dd className="mt-1 font-medium">{marker.coordinateSystem}</dd>
              </div>
            </div>
          </dl>
        </section>
      </div>
    );
  }

  return (
    <form className="space-y-4 p-5" onSubmit={handleSave}>
      <section className="rounded-lg border border-border p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">编辑点位</h3>
          <MapPin className="size-4 text-muted-foreground" />
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="marker-detail-name">
            名称
            <input
              id="marker-detail-name"
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              value={formState.name}
              onChange={(event) => updateForm({ name: event.target.value })}
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="marker-detail-address">
            地址
            <input
              id="marker-detail-address"
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              value={formState.address}
              onChange={(event) => updateForm({ address: event.target.value })}
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="marker-detail-category">
            分类
            <select
              id="marker-detail-category"
              className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
              value={formState.categoryId}
              onChange={(event) => updateForm({ categoryId: event.target.value })}
            >
              <option value="">未分类</option>
              {categories.map((categoryItem) => (
                <option key={categoryItem.id} value={categoryItem.id}>
                  {categoryItem.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="text-sm font-medium">标签</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.length > 0 ? (
                tags.map((tagItem) => (
                  <label key={tagItem.id} className="flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
                    <input
                      type="checkbox"
                      checked={formState.tagIds.includes(tagItem.id)}
                      onChange={() => toggleTag(tagItem.id)}
                    />
                    {tagItem.name}
                  </label>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">暂无标签，可在设置中创建。</p>
              )}
            </div>
          </div>

          <label className="block text-sm font-medium" htmlFor="marker-detail-note">
            备注
            <textarea
              id="marker-detail-note"
              className="mt-2 min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              value={formState.note}
              onChange={(event) => updateForm({ note: event.target.value })}
            />
          </label>
        </div>

        {localError ? <p className="mt-3 text-xs leading-5 text-red-600">{localError}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={() => {
              setFormState(markerToFormState(marker));
              setIsEditing(false);
              setLocalError(null);
            }}
          >
            <X />
            取消
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => setFormState(markerToFormState(marker))}>
            <RotateCcw />
            恢复
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            <Check />
            保存
          </Button>
        </div>
      </section>
    </form>
  );
}
