import { describe, expect, it } from "vitest";

import {
  buildMarkerUpdate,
  isMarkerDetailFormDirty,
  markerToFormState,
  validateMarkerDetailForm,
} from "@/services/marker-detail-form";
import type { MarkerRecord } from "@/types/marker";

describe("marker detail form", () => {
  it("rejects empty marker names before save", () => {
    const formState = markerToFormState(marker());

    expect(validateMarkerDetailForm({ ...formState, name: "   " })).toBe("点位名称不能为空。");
  });

  it("builds a save request for non-coordinate fields while preserving coordinates", () => {
    const currentMarker = marker();
    const update = buildMarkerUpdate(currentMarker, {
      name: " 新名称 ",
      address: " 新地址 ",
      categoryId: "category-2",
      tagIds: ["tag-1", "tag-2"],
      note: " 备注 ",
    });

    expect(update).toMatchObject({
      projectId: "project-1",
      markerId: "marker-1",
      name: "新名称",
      lng: 121.4737,
      lat: 31.2304,
      address: "新地址",
      categoryId: "category-2",
      tagIds: ["tag-1", "tag-2"],
      note: "备注",
    });
  });

  it("resets form state from the current marker for cancel", () => {
    const currentMarker = marker();

    expect(markerToFormState(currentMarker)).toEqual({
      name: "原点位",
      address: "原地址",
      categoryId: "category-1",
      tagIds: ["tag-1"],
      note: "原备注",
    });
  });

  it("detects dirty form changes without treating tag order as a change", () => {
    const currentMarker = marker();

    expect(isMarkerDetailFormDirty(currentMarker, markerToFormState(currentMarker))).toBe(false);
    expect(
      isMarkerDetailFormDirty(currentMarker, {
        ...markerToFormState(currentMarker),
        tagIds: ["tag-2", "tag-1"],
      }),
    ).toBe(true);
    expect(
      isMarkerDetailFormDirty(
        { ...currentMarker, tagIds: ["tag-1", "tag-2"] },
        { ...markerToFormState(currentMarker), tagIds: ["tag-2", "tag-1"] },
      ),
    ).toBe(false);
  });
});

function marker(): MarkerRecord {
  return {
    id: "marker-1",
    projectId: "project-1",
    name: "原点位",
    lng: 121.4737,
    lat: 31.2304,
    coordinateSystem: "BD09",
    address: "原地址",
    categoryId: "category-1",
    tagIds: ["tag-1"],
    note: "原备注",
    source: "manual",
    createdAt: "2026-06-14T08:00:00Z",
    updatedAt: "2026-06-15T08:00:00Z",
  };
}
