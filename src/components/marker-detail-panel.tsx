import { Check, MapPin, Pencil, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { MarkerOverviewPanel } from "@/components/marker-overview-panel";
import { Button } from "@/components/ui/button";
import { listProjectCategories } from "@/services/category-service";
import {
  buildMarkerDraftFromPending,
  isPendingMarkerDirty,
  pendingMarkerToFormState,
  type PendingMarkerCreation,
} from "@/services/marker-creation";
import {
  buildMarkerUpdate,
  isMarkerDetailFormDirty,
  markerToFormState,
  validateMarkerDetailForm,
  type MarkerDetailFormState,
} from "@/services/marker-detail-form";
import { createMarker, updateMarker } from "@/services/marker-service";
import { listProjectTags } from "@/services/tag-service";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

export interface MarkerDirtyHandlers {
  isDirty: () => boolean;
  save: () => Promise<MarkerRecord>;
  discard: () => void;
}

interface MarkerDetailPanelProps {
  projectId: string;
  marker: MarkerRecord | null;
  pendingMarker: PendingMarkerCreation | null;
  onSaved: (marker: MarkerRecord) => void;
  onPendingCanceled: () => void;
  onCreateMarkerRequest: () => void;
  onCreateCategoryRequest: () => void;
  onCreateTagRequest: () => void;
  onError: (error: unknown) => void;
  onDirtyHandlersChange: (handlers: MarkerDirtyHandlers | null) => void;
}

export function MarkerDetailPanel({
  projectId,
  marker,
  pendingMarker,
  onSaved,
  onPendingCanceled,
  onCreateMarkerRequest,
  onCreateCategoryRequest,
  onCreateTagRequest,
  onError,
  onDirtyHandlersChange,
}: MarkerDetailPanelProps) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [formState, setFormState] = useState<MarkerDetailFormState>(() =>
    pendingMarker ? pendingMarkerToFormState(pendingMarker) : markerToFormState(marker),
  );
  const category = categories.find((item) => item.id === marker?.categoryId) ?? null;
  const markerTags = useMemo(
    () => tags.filter((tagItem) => marker?.tagIds.includes(tagItem.id)),
    [marker?.tagIds, tags],
  );
  const isDirty = pendingMarker ? isPendingMarkerDirty(pendingMarker) : marker ? isEditing && isMarkerDetailFormDirty(marker, formState) : false;

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
    if (pendingMarker) {
      onDirtyHandlersChange({
        isDirty: () => isDirty,
        save: savePendingMarker,
        discard: cancelPendingMarker,
      });
      return;
    }

    if (!marker) {
      onDirtyHandlersChange(null);
      return;
    }

    onDirtyHandlersChange({
      isDirty: () => isDirty,
      save: saveCurrentMarker,
      discard: discardChanges,
    });
  });

  useEffect(() => () => onDirtyHandlersChange(null), [onDirtyHandlersChange]);

  async function saveCurrentMarker() {
    if (!marker) {
      throw new Error("没有可保存的点位。");
    }

    const validationError = validateMarkerDetailForm(formState);

    if (validationError) {
      setLocalError(validationError);
      throw new Error(validationError);
    }

    setIsSaving(true);
    try {
      const nextMarker = await updateMarker(buildMarkerUpdate(marker, formState));
      onSaved(nextMarker);
      setFormState(markerToFormState(nextMarker));
      setIsEditing(false);
      setLocalError(null);

      return nextMarker;
    } catch (error) {
      onError(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  async function savePendingMarker() {
    if (!pendingMarker) {
      throw new Error("没有可保存的新点位。");
    }

    const validationError = validateMarkerDetailForm(formState);

    if (validationError) {
      setLocalError(validationError);
      throw new Error(validationError);
    }

    setIsSaving(true);
    try {
      const nextMarker = await createMarker(buildMarkerDraftFromPending(pendingMarker, formState));
      onSaved(nextMarker);
      setLocalError(null);

      return nextMarker;
    } catch (error) {
      onError(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }

  function discardChanges() {
    setFormState(markerToFormState(marker));
    setIsEditing(false);
    setLocalError(null);
  }

  function cancelPendingMarker() {
    setLocalError(null);
    onPendingCanceled();
  }

  if (pendingMarker) {
    return (
      <form className="space-y-4 p-5" onSubmit={handleSave}>
        <section className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">待保存点位</p>
              <h3 className="mt-1 text-sm font-semibold">新建点位</h3>
            </div>
            <MapPin className="size-4 text-primary" />
          </div>

          <MarkerFormFields
            formState={formState}
            categories={categories}
            tags={tags}
            onUpdate={updateForm}
            onToggleTag={toggleTag}
          />

          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">坐标</dt>
              <dd className="mt-1 font-medium">
                {pendingMarker.lng.toFixed(6)}, {pendingMarker.lat.toFixed(6)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">来源</dt>
              <dd className="mt-1 font-medium">{getPendingMarkerSourceLabel(pendingMarker.source)}</dd>
            </div>
          </dl>

          {localError ? <p className="mt-3 text-xs leading-5 text-red-600">{localError}</p> : null}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={cancelPendingMarker}>
              <X />
              取消
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

  if (!marker) {
    return (
      <MarkerOverviewPanel
        projectId={projectId}
        onCreateMarkerRequest={onCreateMarkerRequest}
        onCreateCategoryRequest={onCreateCategoryRequest}
        onCreateTagRequest={onCreateTagRequest}
        onError={onError}
      />
    );
  }

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
    await (pendingMarker ? savePendingMarker() : saveCurrentMarker()).catch(() => undefined);
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
          <MarkerFormFields
            formState={formState}
            categories={categories}
            tags={tags}
            onUpdate={updateForm}
            onToggleTag={toggleTag}
          />
        </div>

        {localError ? <p className="mt-3 text-xs leading-5 text-red-600">{localError}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={isSaving}
            onClick={discardChanges}
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

function getPendingMarkerSourceLabel(source: PendingMarkerCreation["source"]) {
  if (source === "center") {
    return "地图中心";
  }

  if (source === "search") {
    return "百度搜索";
  }

  return "地图点击";
}

interface MarkerFormFieldsProps {
  formState: MarkerDetailFormState;
  categories: CategoryRecord[];
  tags: TagRecord[];
  onUpdate: (nextState: Partial<MarkerDetailFormState>) => void;
  onToggleTag: (tagId: string) => void;
}

function MarkerFormFields({ formState, categories, tags, onUpdate, onToggleTag }: MarkerFormFieldsProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="marker-detail-name">
        名称
        <input
          id="marker-detail-name"
          className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          value={formState.name}
          onChange={(event) => onUpdate({ name: event.target.value })}
        />
      </label>

      <label className="block text-sm font-medium" htmlFor="marker-detail-address">
        地址
        <input
          id="marker-detail-address"
          className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          value={formState.address}
          onChange={(event) => onUpdate({ address: event.target.value })}
        />
      </label>

      <label className="block text-sm font-medium" htmlFor="marker-detail-category">
        分类
        <select
          id="marker-detail-category"
          className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          value={formState.categoryId}
          onChange={(event) => onUpdate({ categoryId: event.target.value })}
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
                <input type="checkbox" checked={formState.tagIds.includes(tagItem.id)} onChange={() => onToggleTag(tagItem.id)} />
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
          onChange={(event) => onUpdate({ note: event.target.value })}
        />
      </label>
    </div>
  );
}
