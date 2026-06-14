import type { CategoryRecord } from "@/types/category";

export const CATEGORY_ICON_OPTIONS = [
  { name: "Users", label: "客户" },
  { name: "Store", label: "门店" },
  { name: "Warehouse", label: "仓库" },
  { name: "BadgeAlert", label: "竞品" },
  { name: "MapPin", label: "候选点" },
] as const;

export interface CategoryFormState {
  name: string;
  color: string;
  icon: string;
}

export interface CategorySaveInput {
  name: string;
  color: string;
  icon: string;
}

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

const ALLOWED_CATEGORY_ICONS = new Set<string>(CATEGORY_ICON_OPTIONS.map((option) => option.name));

export function categoryToFormState(category?: CategoryRecord | null): CategoryFormState {
  return {
    name: category?.name ?? "",
    color: category?.color ?? "#2563eb",
    icon: category?.icon ?? CATEGORY_ICON_OPTIONS[0].name,
  };
}

export function validateCategoryForm(
  formState: CategoryFormState,
  categories: CategoryRecord[],
  currentCategoryId?: string,
) {
  const name = formState.name.trim();
  const color = formState.color.trim();

  if (!name) {
    return "分类名称不能为空。";
  }

  if (categories.some((category) => category.id !== currentCategoryId && category.name.trim() === name)) {
    return "同一项目内分类名称不能重复。";
  }

  if (!HEX_COLOR_PATTERN.test(color)) {
    return "分类颜色必须是 #RRGGBB 格式。";
  }

  if (!ALLOWED_CATEGORY_ICONS.has(formState.icon)) {
    return "请选择可用的分类图标。";
  }

  return null;
}

export function buildCategorySaveInput(formState: CategoryFormState): CategorySaveInput {
  return {
    name: formState.name.trim(),
    color: formState.color.trim().toLowerCase(),
    icon: formState.icon,
  };
}

export function isCategoryFormDirty(category: CategoryRecord, formState: CategoryFormState) {
  const input = buildCategorySaveInput(formState);

  return category.name !== input.name || category.color !== input.color || category.icon !== input.icon;
}
