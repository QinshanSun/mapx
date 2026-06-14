import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { TagRecord } from "@/types/tag";

export function searchLocalMarkers(
  markers: MarkerRecord[],
  categories: CategoryRecord[],
  tags: TagRecord[],
  keyword: string,
) {
  const normalizedKeyword = normalizeSearchKeyword(keyword);

  if (!normalizedKeyword) {
    return markers;
  }

  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const tagNames = new Map(tags.map((tag) => [tag.id, tag.name]));

  return markers.filter((marker) => {
    const searchableText = [
      marker.name,
      marker.address ?? "",
      marker.categoryId ? categoryNames.get(marker.categoryId) ?? "" : "",
      ...marker.tagIds.map((tagId) => tagNames.get(tagId) ?? ""),
    ];

    return searchableText.some((value) => normalizeSearchKeyword(value).includes(normalizedKeyword));
  });
}

export function normalizeSearchKeyword(keyword: string) {
  return keyword.trim().toLocaleLowerCase("zh-Hans-CN");
}
