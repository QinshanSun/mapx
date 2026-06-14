import { describe, expect, it } from "vitest";

import {
  buildCategorySaveInput,
  categoryToFormState,
  validateCategoryForm,
} from "@/services/category-form";
import type { CategoryRecord } from "@/types/category";

describe("category form", () => {
  it("rejects empty and duplicate category names before save", () => {
    const categories = [category("category-1", "客户")];

    expect(validateCategoryForm({ ...categoryToFormState(), name: "   " }, categories)).toBe("分类名称不能为空。");
    expect(validateCategoryForm({ ...categoryToFormState(), name: "客户" }, categories)).toBe(
      "同一项目内分类名称不能重复。",
    );
  });

  it("validates HEX colors and category icon allowlist", () => {
    expect(validateCategoryForm({ name: "商圈", color: "2563eb", icon: "Users" }, [])).toBe(
      "分类颜色必须是 #RRGGBB 格式。",
    );
    expect(validateCategoryForm({ name: "商圈", color: "#2563eb", icon: "Circle" }, [])).toBe(
      "请选择可用的分类图标。",
    );
  });

  it("builds a trimmed save input and normalizes color casing", () => {
    expect(buildCategorySaveInput({ name: " 新分类 ", color: " #ABCDEF ", icon: "MapPin" })).toEqual({
      name: "新分类",
      color: "#abcdef",
      icon: "MapPin",
    });
  });
});

function category(id: string, name: string): CategoryRecord {
  return {
    id,
    projectId: "project-1",
    name,
    color: "#2563eb",
    icon: "Users",
    sortOrder: 10,
    createdAt: "2026-06-14T00:00:00Z",
    updatedAt: "2026-06-14T00:00:00Z",
  };
}
