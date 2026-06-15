import type { CategoryRecord } from "@/types/category";

export const CATEGORY_ICON_OPTIONS = [
  { name: "MapPin", label: "点位" },
  { name: "Building2", label: "建筑" },
  { name: "Store", label: "商店" },
  { name: "Warehouse", label: "仓库" },
  { name: "Users", label: "人员" },
  { name: "Flag", label: "旗标" },
  { name: "Star", label: "星标" },
  { name: "BadgeAlert", label: "告警" },
  { name: "Wrench", label: "工具" },
  { name: "Truck", label: "货车" },
  { name: "Car", label: "车辆" },
  { name: "Bus", label: "公交" },
  { name: "Train", label: "轨道" },
  { name: "School", label: "学校" },
  { name: "Hospital", label: "医院" },
  { name: "Utensils", label: "餐饮" },
  { name: "Factory", label: "工厂" },
  { name: "Home", label: "住宅" },
  { name: "BriefcaseBusiness", label: "办公" },
  { name: "Landmark", label: "机构" },
  { name: "Trees", label: "园区" },
  { name: "Package", label: "包裹" },
  { name: "Shield", label: "安防" },
  { name: "HeartPulse", label: "健康" },
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
