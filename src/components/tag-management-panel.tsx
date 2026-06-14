import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { createTag, listProjectTags, softDeleteTag, updateTag } from "@/services/tag-service";
import type { TagRecord } from "@/types/tag";

interface TagManagementPanelProps {
  projectId: string;
  onError: (error: unknown) => void;
}

export function TagManagementPanel({ projectId, onError }: TagManagementPanelProps) {
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [pendingDeleteTagId, setPendingDeleteTagId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const pendingDeleteTag = tags.find((tagItem) => tagItem.id === pendingDeleteTagId) ?? null;
  const normalizedTagNames = useMemo(() => new Set(tags.map((tagItem) => tagItem.name.trim())), [tags]);

  useEffect(() => {
    let isActive = true;

    listProjectTags(projectId)
      .then((nextTags) => {
        if (isActive) {
          setTags(nextTags);
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
    const name = newTagName.trim();

    if (!name) {
      setLocalError("标签名称不能为空。");
      return;
    }

    if (normalizedTagNames.has(name)) {
      setLocalError("同一项目内标签名称不能重复。");
      return;
    }

    setIsSaving(true);
    try {
      const nextTag = await createTag(projectId, name);
      setTags((currentTags) => [...currentTags, nextTag].sort(compareTags));
      setNewTagName("");
      setLocalError(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRename(tagId: string) {
    const name = editingName.trim();
    const currentTag = tags.find((tagItem) => tagItem.id === tagId);

    if (!name) {
      setLocalError("标签名称不能为空。");
      return;
    }

    if (currentTag?.name !== name && normalizedTagNames.has(name)) {
      setLocalError("同一项目内标签名称不能重复。");
      return;
    }

    setIsSaving(true);
    try {
      const nextTag = await updateTag(projectId, tagId, name);
      setTags((currentTags) =>
        currentTags.map((tagItem) => (tagItem.id === tagId ? nextTag : tagItem)).sort(compareTags),
      );
      setEditingTagId(null);
      setEditingName("");
      setLocalError(null);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!pendingDeleteTag) {
      return;
    }

    setIsSaving(true);
    try {
      await softDeleteTag(projectId, pendingDeleteTag.id);
      setTags((currentTags) => currentTags.filter((tagItem) => tagItem.id !== pendingDeleteTag.id));
      setPendingDeleteTagId(null);
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
        <h3 className="text-sm font-semibold">项目标签</h3>
        <Tag className="size-4 text-muted-foreground" />
      </div>

      <form className="flex gap-2" onSubmit={handleCreate}>
        <input
          className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring"
          value={newTagName}
          placeholder="新标签"
          onChange={(event) => setNewTagName(event.target.value)}
        />
        <Button type="submit" size="sm" disabled={isSaving}>
          <Plus />
          添加
        </Button>
      </form>

      {localError ? <p className="mt-2 text-xs leading-5 text-red-600">{localError}</p> : null}

      <div className="mt-3 space-y-2">
        {isLoading ? <p className="text-xs text-muted-foreground">正在读取标签</p> : null}
        {!isLoading && tags.length === 0 ? <p className="text-xs text-muted-foreground">暂无标签</p> : null}
        {tags.map((tagItem) => {
          const isEditing = editingTagId === tagItem.id;

          return (
            <div key={tagItem.id} className="rounded-md border border-border bg-background p-2">
              {isEditing ? (
                <div className="flex gap-2">
                  <input
                    className="h-8 min-w-0 flex-1 rounded-md border border-input bg-white px-2 text-sm outline-none focus:border-primary"
                    value={editingName}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <Button type="button" size="icon" variant="ghost" disabled={isSaving} onClick={() => handleRename(tagItem.id)}>
                    <Check />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={isSaving}
                    onClick={() => {
                      setEditingTagId(null);
                      setEditingName("");
                    }}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{tagItem.name}</span>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`编辑标签 ${tagItem.name}`}
                      onClick={() => {
                        setEditingTagId(tagItem.id);
                        setEditingName(tagItem.name);
                        setPendingDeleteTagId(null);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`删除标签 ${tagItem.name}`}
                      onClick={() => {
                        setPendingDeleteTagId(tagItem.id);
                        setEditingTagId(null);
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

      {pendingDeleteTag ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm">
          <p className="font-medium text-red-700">确认删除“{pendingDeleteTag.name}”？</p>
          <p className="mt-1 text-xs leading-5 text-red-700">已有点位会解除该标签，点位不会被删除。</p>
          <div className="mt-3 flex justify-end gap-2">
            <Button type="button" size="sm" variant="outline" disabled={isSaving} onClick={() => setPendingDeleteTagId(null)}>
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

function compareTags(left: TagRecord, right: TagRecord) {
  return left.name.localeCompare(right.name, "zh-Hans-CN") || left.createdAt.localeCompare(right.createdAt);
}
