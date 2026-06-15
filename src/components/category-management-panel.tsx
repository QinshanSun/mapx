import {
  BadgeAlert,
  BriefcaseBusiness,
  Building2,
  Bus,
  Car,
  Check,
  Factory,
  Flag,
  HeartPulse,
  Home,
  Hospital,
  Landmark,
  MapPin,
  Package,
  Pencil,
  Plus,
  School,
  Shield,
  Star,
  Store,
  Train,
  Trash2,
  Trees,
  Truck,
  Users,
  Utensils,
  Warehouse,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  CATEGORY_ICON_OPTIONS,
  buildCategorySaveInput,
  categoryToFormState,
  isCategoryFormDirty,
  validateCategoryForm,
  type CategoryFormState,
} from "@/services/category-form";
import { createCategory, listProjectCategories, softDeleteCategory, updateCategory } from "@/services/category-service";
import { listProjectMarkers } from "@/services/marker-service";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";

interface CategoryManagementPanelProps {
  projectId: string;
  onError: (error: unknown) => void;
}

const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  MapPin,
  Building2,
  Store,
  Warehouse,
  Users,
  Flag,
  Star,
  BadgeAlert,
  Wrench,
  Truck,
  Car,
  Bus,
  Train,
  School,
  Hospital,
  Utensils,
  Factory,
  Home,
  BriefcaseBusiness,
  Landmark,
  Trees,
  Package,
  Shield,
  HeartPulse,
};

export function CategoryManagementPanel({ projectId, onError }: CategoryManagementPanelProps) {
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [markers, setMarkers] = useState<MarkerRecord[]>([]);
  const [newCategoryForm, setNewCategoryForm] = useState<CategoryFormState>(() => categoryToFormState());
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CategoryFormState>(() => categoryToFormState());
  const [pendingDeleteCategoryId, setPendingDeleteCategoryId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const pendingDeleteCategory = categories.find((category) => category.id === pendingDeleteCategoryId) ?? null;
  const affectedMarkerCount = pendingDeleteCategoryId
    ? markers.filter((marker) => marker.categoryId === pendingDeleteCategoryId).length
    : 0;

  useEffect(() => {
    let isActive = true;

    Promise.all([listProjectCategories(projectId), listProjectMarkers(projectId)])
      .then(([nextCategories, nextMarkers]) => {
        if (isActive) {
          setCategories(nextCategories);
          setMarkers(nextMarkers);
          setLocalError(null);
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

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateCategoryForm(newCategoryForm, categories);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const nextCategory = await createCategory(projectId, buildCategorySaveInput(newCategoryForm));
      setCategories((currentCategories) => [...currentCategories, nextCategory].sort(compareCategories));
      setNewCategoryForm(categoryToFormState());
      setLocalError(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(category: CategoryRecord) {
    const validationError = validateCategoryForm(editingForm, categories, category.id);

    if (validationError) {
      setLocalError(validationError);
      return;
    }

    if (!isCategoryFormDirty(category, editingForm)) {
      setEditingCategoryId(null);
      setLocalError(null);
      return;
    }

    setIsSaving(true);
    try {
      const nextCategory = await updateCategory(projectId, category.id, buildCategorySaveInput(editingForm));
      setCategories((currentCategories) =>
        currentCategories.map((categoryItem) => (categoryItem.id === category.id ? nextCategory : categoryItem)).sort(compareCategories),
      );
      setEditingCategoryId(null);
      setLocalError(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDeleteCategory) {
      return;
    }

    setIsSaving(true);
    try {
      await softDeleteCategory(projectId, pendingDeleteCategory.id);
      setCategories((currentCategories) => currentCategories.filter((category) => category.id !== pendingDeleteCategory.id));
      setMarkers((currentMarkers) =>
        currentMarkers.map((marker) =>
          marker.categoryId === pendingDeleteCategory.id ? { ...marker, categoryId: null } : marker,
        ),
      );
      setPendingDeleteCategoryId(null);
      setLocalError(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">项目分类</h3>
        <MapPin className="size-4 text-muted-foreground" />
      </div>

      <form className="space-y-3" onSubmit={handleCreate}>
        <input
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring"
          value={newCategoryForm.name}
          placeholder="新分类"
          onChange={(event) => setNewCategoryForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
        />
        <CategoryFields formState={newCategoryForm} onChange={setNewCategoryForm} />
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={isSaving}>
            <Plus />
            添加分类
          </Button>
        </div>
      </form>

      {localError ? <p className="mt-2 text-xs leading-5 text-red-600">{localError}</p> : null}

      <div className="mt-4 space-y-2">
        {isLoading ? <p className="text-xs text-muted-foreground">正在读取分类</p> : null}
        {!isLoading && categories.length === 0 ? <p className="text-xs text-muted-foreground">暂无分类</p> : null}
        {categories.map((category) => {
          const isEditing = editingCategoryId === category.id;
          const Icon = CATEGORY_ICON_MAP[category.icon] ?? MapPin;

          return (
            <div key={category.id} className="rounded-md border border-border bg-background p-2">
              {isEditing ? (
                <div className="space-y-2">
                  <input
                    className="h-8 w-full rounded-md border border-input bg-white px-2 text-sm outline-none focus:border-primary"
                    value={editingForm.name}
                    onChange={(event) => setEditingForm((currentForm) => ({ ...currentForm, name: event.target.value }))}
                  />
                  <CategoryFields formState={editingForm} onChange={setEditingForm} compact />
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="icon" variant="ghost" disabled={isSaving} onClick={() => handleUpdate(category)}>
                      <Check />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={isSaving}
                      onClick={() => {
                        setEditingCategoryId(null);
                        setEditingForm(categoryToFormState());
                        setLocalError(null);
                      }}
                    >
                      <X />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-md text-white" style={{ backgroundColor: category.color }}>
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-muted-foreground">{category.color}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`编辑分类 ${category.name}`}
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setEditingForm(categoryToFormState(category));
                        setPendingDeleteCategoryId(null);
                        setLocalError(null);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`删除分类 ${category.name}`}
                      onClick={() => {
                        setPendingDeleteCategoryId(category.id);
                        setEditingCategoryId(null);
                        setLocalError(null);
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {pendingDeleteCategory ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-medium text-red-700">确认删除“{pendingDeleteCategory.name}”？</p>
          <p className="mt-1 text-xs leading-5 text-red-700">
            将有 {affectedMarkerCount} 个点位变为未分类，点位不会被删除。
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => setPendingDeleteCategoryId(null)}>
              <X />
              取消
            </Button>
            <Button type="button" size="sm" disabled={isSaving} onClick={handleDeleteConfirmed}>
              <Trash2 />
              删除
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function CategoryFields({
  formState,
  onChange,
  compact = false,
}: {
  formState: CategoryFormState;
  onChange: (formState: CategoryFormState) => void;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "grid grid-cols-[56px,1fr] gap-2" : "grid grid-cols-[64px,1fr] gap-2"}>
      <label className="block text-xs font-medium text-muted-foreground" htmlFor={compact ? "edit-category-color" : "new-category-color"}>
        颜色
        <input
          id={compact ? "edit-category-color" : "new-category-color"}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background p-1"
          type="color"
          value={formState.color}
          onChange={(event) => onChange({ ...formState, color: event.target.value })}
        />
      </label>
      <label className="block text-xs font-medium text-muted-foreground" htmlFor={compact ? "edit-category-icon" : "new-category-icon"}>
        图标
        <select
          id={compact ? "edit-category-icon" : "new-category-icon"}
          className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus:border-primary"
          value={formState.icon}
          onChange={(event) => onChange({ ...formState, icon: event.target.value })}
        >
          {CATEGORY_ICON_OPTIONS.map((option) => (
            <option key={option.name} value={option.name}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function compareCategories(left: CategoryRecord, right: CategoryRecord) {
  return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "zh-Hans-CN");
}
