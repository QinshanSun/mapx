import {
  Building2,
  CircleHelp,
  FolderOpen,
  Check,
  Map as MapIcon,
  MapPinned,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Satellite,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

import { FirstLaunchFlow } from "@/components/first-launch-flow";
import { MapCanvas, type MapCanvasAvailability } from "@/components/map-canvas";
import { MarkerDetailPanel, type MarkerDirtyHandlers } from "@/components/marker-detail-panel";
import { MarkerListPanel } from "@/components/marker-list-panel";
import { SearchPanel } from "@/components/search-panel";
import { SettingsPanel } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { useWorkspaceActionEvents } from "@/hooks/use-workspace-action-events";
import { getBackendErrorMessage } from "@/services/backend-error";
import { getBootstrapStatus } from "@/services/bootstrap-service";
import { resolveDirtyGuardChoice, type DirtyGuardChoice } from "@/services/dirty-guard";
import {
  createPendingMarkerFromCenter,
  createPendingMarkerFromMapClick,
  createPendingMarkerFromPoi,
  type PendingMarkerCreation,
} from "@/services/marker-creation";
import type { BaiduPoiResult } from "@/services/baidu-poi-search-provider";
import type { MarkerListFilters } from "@/services/marker-list";
import { buildMapMarkerItems, findMarkerById } from "@/services/map-marker-render";
import type { MapCoordinate, MapMarkerItem, MapPoiPreview } from "@/services/map-provider";
import { cancelPoiPreview, replacePoiPreview } from "@/services/poi-preview";
import {
  createProject,
  getProjectWorkspace,
  renameProject,
  selectProject,
  softDeleteProject,
  updateProjectMapLayer,
  updateProjectSearchCity,
  validateProjectName,
} from "@/services/project-service";
import { getFirstLaunchSettings, openLogDirectory } from "@/services/settings-service";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { BootstrapStatus } from "@/types/bootstrap";
import type { CategoryRecord } from "@/types/category";
import type { MarkerRecord } from "@/types/marker";
import type { MapLayer, ProjectWorkspace } from "@/types/project";
import type { FirstLaunchSettings } from "@/types/settings";
import type { WorkspacePanel } from "@/types/workspace";
import type { WorkspaceActionId, WorkspaceActionSource } from "@/types/workspace-actions";

const navItems: Array<{ panel: WorkspacePanel; label: string; icon: LucideIcon }> = [
  { panel: "overview", label: "项目概览", icon: FolderOpen },
  { panel: "markers", label: "点位管理", icon: MapPinned },
  { panel: "search", label: "搜索", icon: Search },
  { panel: "settings", label: "设置", icon: Settings },
  { panel: "about", label: "关于", icon: CircleHelp },
];

function getDetailTitle(panel: WorkspacePanel) {
  switch (panel) {
    case "markers":
      return "点位详情";
    case "search":
      return "搜索结果";
    case "settings":
      return "设置入口";
    case "about":
      return "关于信息";
    case "overview":
      return "项目概览";
  }
}

interface PendingDirtyAction {
  message: string;
  run: () => void | Promise<void>;
}

interface DirtyPromptState {
  message: string;
  error: string | null;
  isSaving: boolean;
}

function App() {
  const [bootstrapStatus, setBootstrapStatus] = useState<BootstrapStatus | null>(null);
  const [firstLaunchSettings, setFirstLaunchSettings] = useState<FirstLaunchSettings | null>(null);
  const [projectWorkspace, setProjectWorkspace] = useState<ProjectWorkspace | null>(null);
  const [isProjectCreateOpen, setIsProjectCreateOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [isProjectRenameOpen, setIsProjectRenameOpen] = useState(false);
  const [projectRenameName, setProjectRenameName] = useState("");
  const [pendingDeleteProjectId, setPendingDeleteProjectId] = useState<string | null>(null);
  const [pendingMarker, setPendingMarker] = useState<PendingMarkerCreation | null>(null);
  const [isMarkerCreationMode, setIsMarkerCreationMode] = useState(false);
  const [projectActionError, setProjectActionError] = useState<string | null>(null);
  const [selectedMarkerRecord, setSelectedMarkerRecord] = useState<MarkerRecord | null>(null);
  const [filteredMarkerRecords, setFilteredMarkerRecords] = useState<MarkerRecord[]>([]);
  const [markerCategories, setMarkerCategories] = useState<CategoryRecord[]>([]);
  const [markerListFilters, setMarkerListFilters] = useState<MarkerListFilters>({
    categoryId: "all",
    tagId: "all",
    sortKey: "updatedDesc",
  });
  const [markerListRefreshKey, setMarkerListRefreshKey] = useState(0);
  const [mapAvailability, setMapAvailability] = useState<MapCanvasAvailability>("loading");
  const [poiPreview, setPoiPreview] = useState<MapPoiPreview | null>(null);
  const [coordinateEditMarkerId, setCoordinateEditMarkerId] = useState<string | null>(null);
  const [movedMarkerCoordinate, setMovedMarkerCoordinate] = useState<MapCoordinate | null>(null);
  const [dirtyPrompt, setDirtyPrompt] = useState<DirtyPromptState | null>(null);
  const [isProjectSaving, setIsProjectSaving] = useState(false);
  const [isProjectRenaming, setIsProjectRenaming] = useState(false);
  const [isProjectDeleting, setIsProjectDeleting] = useState(false);
  const [isMapLayerSaving, setIsMapLayerSaving] = useState(false);
  const [firstLaunchError, setFirstLaunchError] = useState<string | null>(null);
  const pendingDeleteProject = projectWorkspace?.projects.find((project) => project.id === pendingDeleteProjectId) ?? null;
  const markerDirtyHandlersRef = useRef<MarkerDirtyHandlers | null>(null);
  const pendingDirtyActionRef = useRef<PendingDirtyAction | null>(null);
  const mapMarkers = useMemo(() => {
    const markerItems: MapMarkerItem[] = buildMapMarkerItems(filteredMarkerRecords, markerCategories).map((markerItem) => {
      if (markerItem.id !== coordinateEditMarkerId || !movedMarkerCoordinate) {
        return markerItem;
      }

      return {
        ...markerItem,
        lng: movedMarkerCoordinate.lng,
        lat: movedMarkerCoordinate.lat,
      };
    });

    if (pendingMarker) {
      return [
        ...markerItems,
        {
          id: pendingMarker.id,
          name: pendingMarker.initialName ?? "待保存点位",
          lng: pendingMarker.lng,
          lat: pendingMarker.lat,
          color: "#dc2626",
          icon: "MapPin",
        },
      ];
    }

    return markerItems;
  }, [coordinateEditMarkerId, filteredMarkerRecords, markerCategories, movedMarkerCoordinate, pendingMarker]);
  const handleSettingsError = useCallback((error: unknown) => {
    setFirstLaunchError(getBackendErrorMessage(error));
  }, []);

  useEffect(() => {
    let isActive = true;

    getBootstrapStatus()
      .then((status) => {
        if (isActive) {
          setBootstrapStatus(status);
        }
      })
      .catch(() => {
        if (isActive) {
          setBootstrapStatus({
            ready: false,
            databasePath: null,
            message: "无法读取 MapX 启动状态。",
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!bootstrapStatus?.ready) {
      return;
    }

    let isActive = true;

    getFirstLaunchSettings()
      .then((settings) => {
        if (isActive) {
          setFirstLaunchSettings(settings);
        }
      })
      .catch((error) => {
        if (isActive) {
          setFirstLaunchError(getBackendErrorMessage(error));
        }
      });

    return () => {
      isActive = false;
    };
  }, [bootstrapStatus]);

  useEffect(() => {
    if (!firstLaunchSettings?.completed) {
      return;
    }

    let isActive = true;

    getProjectWorkspace()
      .then((workspace) => {
        if (isActive) {
          setProjectWorkspace(workspace);
        }
      })
      .catch((error) => {
        if (isActive) {
          setFirstLaunchError(getBackendErrorMessage(error));
        }
      });

    return () => {
      isActive = false;
    };
  }, [firstLaunchSettings]);

  const { activePanel, dispatchAction, lastActionNotice, selectedMarkerId, setActivePanel, selectMarker } =
    useWorkspaceStore();

  const runPendingDirtyAction = useCallback(() => {
    const nextAction = pendingDirtyActionRef.current;
    pendingDirtyActionRef.current = null;
    setDirtyPrompt(null);
    void nextAction?.run();
  }, []);

  const runWithMarkerDirtyGuard = useCallback(
    (action: PendingDirtyAction) => {
      if (markerDirtyHandlersRef.current?.isDirty()) {
        pendingDirtyActionRef.current = action;
        setDirtyPrompt({ message: action.message, error: null, isSaving: false });
        return false;
      }

      void action.run();
      return true;
    },
    [],
  );

  const handleMarkerDirtyHandlersChange = useCallback((handlers: MarkerDirtyHandlers | null) => {
    markerDirtyHandlersRef.current = handlers;
  }, []);

  const handleFilteredMarkersChange = useCallback((markers: MarkerRecord[], categories: CategoryRecord[]) => {
    setFilteredMarkerRecords(markers);
    setMarkerCategories(categories);
  }, []);

  const handleMapMarkerSelect = useCallback(
    (markerId: string) => {
      const marker = findMarkerById(filteredMarkerRecords, markerId);

      if (!marker) {
        return;
      }

      runWithMarkerDirtyGuard({
        message: "切换点位前，当前点位还有未保存的修改。",
        run: () => {
          setCoordinateEditMarkerId(null);
          setMovedMarkerCoordinate(null);
          selectMarker(marker.id);
          setSelectedMarkerRecord(marker);
        },
      });
    },
    [filteredMarkerRecords, runWithMarkerDirtyGuard, selectMarker],
  );

  const selectMarkerRecord = useCallback(
    (marker: MarkerRecord) => {
      setPoiPreview(cancelPoiPreview());
      setCoordinateEditMarkerId(null);
      setMovedMarkerCoordinate(null);
      selectMarker(marker.id);
      setSelectedMarkerRecord(marker);
    },
    [selectMarker],
  );

  const handlePreviewPoi = useCallback(
    (poi: BaiduPoiResult) => {
      const nextPreview = replacePoiPreview(poiPreview, poi);

      if (!nextPreview) {
        setProjectActionError("该百度地点没有可用坐标，暂不能预览。");
        return;
      }

      setPoiPreview(nextPreview);
      setSelectedMarkerRecord(null);
      selectMarker(null);
      setProjectActionError(null);
    },
    [poiPreview, selectMarker],
  );

  const handleCancelPoiPreview = useCallback(() => {
    setPoiPreview(cancelPoiPreview());
  }, []);

  const clearPendingMarker = useCallback(() => {
    setPendingMarker(null);
    setIsMarkerCreationMode(false);
    setCoordinateEditMarkerId(null);
    setMovedMarkerCoordinate(null);
  }, []);

  const startMarkerCreationMode = useCallback(() => {
    runWithMarkerDirtyGuard({
      message: "进入添加点位前，当前点位还有未保存的修改。",
      run: () => {
        setCoordinateEditMarkerId(null);
        setMovedMarkerCoordinate(null);
        setIsMarkerCreationMode(true);
        setActivePanel("markers");
      },
    });
  }, [runWithMarkerDirtyGuard, setActivePanel]);

  const cancelMarkerCreationMode = useCallback(() => {
    setPendingMarker(null);
    setIsMarkerCreationMode(false);
    setCoordinateEditMarkerId(null);
    setMovedMarkerCoordinate(null);
  }, []);

  const beginPendingMarkerCreation = useCallback(
    (nextPendingMarker: PendingMarkerCreation | null) => {
      if (!nextPendingMarker) {
        return;
      }

      runWithMarkerDirtyGuard({
        message: "新建点位前，当前点位还有未保存的修改。",
        run: () => {
          setPendingMarker(nextPendingMarker);
          setPoiPreview(cancelPoiPreview());
          setCoordinateEditMarkerId(null);
          setMovedMarkerCoordinate(null);
          setSelectedMarkerRecord(null);
          selectMarker(null);
          setActivePanel("markers");
          setProjectActionError(null);
        },
      });
    },
    [runWithMarkerDirtyGuard, selectMarker, setActivePanel],
  );

  const handleCreateMarkerAtCoordinate = useCallback(
    (coordinate: MapCoordinate) => {
      if (!projectWorkspace) {
        return;
      }

      beginPendingMarkerCreation(
        createPendingMarkerFromMapClick(projectWorkspace.currentProject.id, coordinate, isMarkerCreationMode),
      );
    },
    [beginPendingMarkerCreation, isMarkerCreationMode, projectWorkspace],
  );

  const handleCreateMarkerAtCenter = useCallback(
    (coordinate: MapCoordinate) => {
      if (!projectWorkspace) {
        return;
      }

      beginPendingMarkerCreation(createPendingMarkerFromCenter(projectWorkspace.currentProject.id, coordinate));
    },
    [beginPendingMarkerCreation, projectWorkspace],
  );

  const handleSavePoiPreviewAsMarker = useCallback(() => {
    if (!projectWorkspace || !poiPreview) {
      return;
    }

    beginPendingMarkerCreation(createPendingMarkerFromPoi(projectWorkspace.currentProject.id, poiPreview));
  }, [beginPendingMarkerCreation, poiPreview, projectWorkspace]);

  const handleMarkerEditModeChange = useCallback((isEditing: boolean, marker: MarkerRecord | null) => {
    if (isEditing && marker) {
      setCoordinateEditMarkerId(marker.id);
      setMovedMarkerCoordinate(null);
      return;
    }

    setCoordinateEditMarkerId(null);
    setMovedMarkerCoordinate(null);
  }, []);

  const handleMarkerDragged = useCallback((markerId: string, coordinate: MapCoordinate) => {
    setCoordinateEditMarkerId(markerId);
    setMovedMarkerCoordinate(coordinate);
  }, []);

  useEffect(() => {
    setFilteredMarkerRecords([]);
    setMarkerCategories([]);
    setPoiPreview(cancelPoiPreview());
    setCoordinateEditMarkerId(null);
    setMovedMarkerCoordinate(null);
    clearPendingMarker();
  }, [clearPendingMarker, projectWorkspace?.currentProject.id]);

  const handleDirtyPromptChoice = useCallback(
    async (choice: DirtyGuardChoice) => {
      const resolution = resolveDirtyGuardChoice(choice);

      if (resolution === "stay") {
        pendingDirtyActionRef.current = null;
        setDirtyPrompt(null);
        return;
      }

      if (resolution === "discardAndContinue") {
        markerDirtyHandlersRef.current?.discard();
        markerDirtyHandlersRef.current = null;
        runPendingDirtyAction();
        return;
      }

      setDirtyPrompt((currentPrompt) => currentPrompt && { ...currentPrompt, error: null, isSaving: true });
      try {
        const dirtyHandlers = markerDirtyHandlersRef.current;
        await dirtyHandlers?.save();
        markerDirtyHandlersRef.current = null;
        runPendingDirtyAction();
      } catch (error) {
        setDirtyPrompt((currentPrompt) =>
          currentPrompt && {
            ...currentPrompt,
            error: error instanceof Error ? error.message : "保存失败，请检查点位表单。",
            isSaving: false,
          },
        );
      }
    },
    [runPendingDirtyAction],
  );

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    let isActive = true;
    let unlisten: (() => void) | null = null;
    const appWindow = getCurrentWindow();

    appWindow
      .onCloseRequested((event) => {
        if (!markerDirtyHandlersRef.current?.isDirty()) {
          return;
        }

        event.preventDefault();
        runWithMarkerDirtyGuard({
          message: "关闭窗口前，当前点位还有未保存的修改。",
          run: () => appWindow.close(),
        });
      })
      .then((cleanup) => {
        if (isActive) {
          unlisten = cleanup;
        } else {
          cleanup();
        }
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
      unlisten?.();
    };
  }, [runWithMarkerDirtyGuard]);

  const openProjectCreateForm = useCallback(() => {
    setIsProjectCreateOpen(true);
    setIsProjectRenameOpen(false);
    setPendingDeleteProjectId(null);
    setProjectActionError(null);
    setActivePanel("overview");
  }, [setActivePanel]);

  const openProjectRenameForm = useCallback(() => {
    if (!projectWorkspace) {
      return;
    }

    setIsProjectRenameOpen(true);
    setIsProjectCreateOpen(false);
    setPendingDeleteProjectId(null);
    setProjectRenameName(projectWorkspace.currentProject.name);
    setProjectActionError(null);
  }, [projectWorkspace]);

  const openProjectDeleteConfirm = useCallback(
    (projectId: string) => {
      runWithMarkerDirtyGuard({
        message: "删除项目前，当前点位还有未保存的修改。",
        run: () => {
          setPendingDeleteProjectId(projectId);
          setIsProjectCreateOpen(false);
          setIsProjectRenameOpen(false);
          setProjectActionError(null);
        },
      });
    },
    [runWithMarkerDirtyGuard],
  );

  const runWorkspaceAction = useCallback(
    (actionId: WorkspaceActionId, source: WorkspaceActionSource) => {
      dispatchAction(actionId, source);

      if (actionId === "project.new") {
        openProjectCreateForm();
      }
    },
    [dispatchAction, openProjectCreateForm],
  );

  const handleWorkspaceAction = useCallback(
    (actionId: WorkspaceActionId, source: WorkspaceActionSource) => {
      if (actionId === "changes.save" && markerDirtyHandlersRef.current?.isDirty()) {
        void markerDirtyHandlersRef.current.save().then(() => dispatchAction(actionId, source));
        return false;
      }

      if (
        actionId === "project.new" ||
        actionId === "search.focus" ||
        actionId === "mode.cancel" ||
        actionId === "selection.delete" ||
        actionId === "view.overview" ||
        actionId === "view.settings" ||
        actionId === "help.about"
      ) {
        runWithMarkerDirtyGuard({
          message: "继续操作前，当前点位还有未保存的修改。",
          run: () => runWorkspaceAction(actionId, source),
        });
        return false;
      }

      return undefined;
    },
    [dispatchAction, runWithMarkerDirtyGuard, runWorkspaceAction],
  );

  useWorkspaceActionEvents(handleWorkspaceAction);

  const openProjectCreate = useCallback(
    (source: "button" | "menu" | "shortcut") => {
      runWithMarkerDirtyGuard({
        message: "新建项目前，当前点位还有未保存的修改。",
        run: () => runWorkspaceAction("project.new", source),
      });
    },
    [runWithMarkerDirtyGuard, runWorkspaceAction],
  );

  const handleProjectSelect = useCallback(
    (projectId: string) => {
      if (!projectWorkspace || projectWorkspace.currentProject.id === projectId) {
        return;
      }

      runWithMarkerDirtyGuard({
        message: "切换项目前，当前点位还有未保存的修改。",
        run: () => {
          selectProject(projectId, projectWorkspace)
            .then((workspace) => {
              setProjectWorkspace(workspace);
              setSelectedMarkerRecord(null);
              selectMarker(null);
              setIsProjectRenameOpen(false);
              setProjectRenameName("");
              setPendingDeleteProjectId(null);
              setActivePanel("overview");
              setProjectActionError(null);
            })
            .catch((error) => setProjectActionError(getBackendErrorMessage(error)));
        },
      });
    },
    [projectWorkspace, runWithMarkerDirtyGuard, selectMarker, setActivePanel],
  );

  const handleProjectCreate = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = newProjectName.trim();

      if (!name) {
        setProjectActionError("项目名称不能为空。");
        return;
      }

      setIsProjectSaving(true);
      createProject(name, projectWorkspace)
        .then((workspace) => {
          setProjectWorkspace(workspace);
          setSelectedMarkerRecord(null);
          selectMarker(null);
          setNewProjectName("");
          setIsProjectCreateOpen(false);
          setPendingDeleteProjectId(null);
          setProjectActionError(null);
          setActivePanel("overview");
        })
        .catch((error) => setProjectActionError(getBackendErrorMessage(error)))
        .finally(() => setIsProjectSaving(false));
    },
    [newProjectName, projectWorkspace, selectMarker, setActivePanel],
  );

  const handleProjectRename = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!projectWorkspace) {
        return;
      }

      const validationError = validateProjectName(projectRenameName);

      if (validationError) {
        setProjectActionError(validationError);
        return;
      }

      setIsProjectRenaming(true);
      renameProject(projectWorkspace.currentProject.id, projectRenameName, projectWorkspace)
        .then((workspace) => {
          setProjectWorkspace(workspace);
          setProjectRenameName(workspace.currentProject.name);
          setIsProjectRenameOpen(false);
          setPendingDeleteProjectId(null);
          setProjectActionError(null);
        })
        .catch((error) => setProjectActionError(getBackendErrorMessage(error)))
        .finally(() => setIsProjectRenaming(false));
    },
    [projectRenameName, projectWorkspace],
  );

  const handleProjectDeleteConfirmed = useCallback(() => {
    if (!projectWorkspace || !pendingDeleteProject) {
      return;
    }

    const isDeletingCurrentProject = pendingDeleteProject.id === projectWorkspace.currentProject.id;

    setIsProjectDeleting(true);
    softDeleteProject(pendingDeleteProject.id, projectWorkspace)
      .then((workspace) => {
        setProjectWorkspace(workspace);
        setPendingDeleteProjectId(null);
        setProjectActionError(null);

        if (isDeletingCurrentProject) {
          setSelectedMarkerRecord(null);
          selectMarker(null);
          setIsProjectRenameOpen(false);
          setProjectRenameName("");
          setActivePanel("overview");
        }
      })
      .catch((error) => setProjectActionError(getBackendErrorMessage(error)))
      .finally(() => setIsProjectDeleting(false));
  }, [pendingDeleteProject, projectWorkspace, selectMarker, setActivePanel]);

  const handleMapLayerChange = useCallback(
    (mapLayer: MapLayer) => {
      if (!projectWorkspace || projectWorkspace.settings.mapLayer === mapLayer) {
        return;
      }

      runWithMarkerDirtyGuard({
        message: "切换地图图层前，当前点位还有未保存的修改。",
        run: () => {
          setIsMapLayerSaving(true);
          updateProjectMapLayer(projectWorkspace.currentProject.id, mapLayer, projectWorkspace)
            .then(setProjectWorkspace)
            .catch((error) => setProjectActionError(getBackendErrorMessage(error)))
            .finally(() => setIsMapLayerSaving(false));
        },
      });
    },
    [projectWorkspace, runWithMarkerDirtyGuard],
  );

  const handleSearchCityChange = useCallback(
    (searchCity: string) => {
      if (!projectWorkspace || projectWorkspace.settings.searchCity === searchCity) {
        return Promise.resolve();
      }

      return updateProjectSearchCity(projectWorkspace.currentProject.id, searchCity, projectWorkspace)
        .then(setProjectWorkspace)
        .catch((error) => {
          const message = getBackendErrorMessage(error);
          setProjectActionError(message);
          throw new Error(message);
        });
    },
    [projectWorkspace],
  );

  const handlePanelSelect = useCallback(
    (panel: WorkspacePanel) => {
      if (activePanel === panel) {
        return;
      }

      runWithMarkerDirtyGuard({
        message: "切换视图前，当前点位还有未保存的修改。",
        run: () => setActivePanel(panel),
      });
    },
    [activePanel, runWithMarkerDirtyGuard, setActivePanel],
  );

  if (!bootstrapStatus) {
    return <BootstrapGate title="正在初始化本地数据库" message="MapX 正在准备本地 SQLite 工作区。" />;
  }

  if (!bootstrapStatus.ready) {
    return (
      <BootstrapGate
        title="本地数据库初始化失败"
        message={bootstrapStatus.message ?? "MapX 无法进入主界面，请检查本地数据目录后重启应用。"}
        detail="为了避免写入不完整数据，主界面已暂停加载。"
      />
    );
  }

  if (firstLaunchError) {
    return (
      <BootstrapGate
        title="应用设置读取失败"
        message={firstLaunchError}
        detail="为了避免写入不完整设置，主界面已暂停加载。"
      />
    );
  }

  if (!firstLaunchSettings) {
    return <BootstrapGate title="正在读取应用设置" message="MapX 正在准备首次启动配置。" />;
  }

  if (!firstLaunchSettings.completed) {
    return (
      <FirstLaunchFlow
        initialSettings={firstLaunchSettings}
        onComplete={setFirstLaunchSettings}
        onError={handleSettingsError}
      />
    );
  }

  if (!projectWorkspace) {
    return <BootstrapGate title="正在读取项目工作区" message="MapX 正在准备默认项目和项目设置。" />;
  }

  const detailTitle = getDetailTitle(activePanel);
  const akStatus = firstLaunchSettings.baiduAk ? "已配置" : "未配置";
  const mapLayerLabel = projectWorkspace.settings.mapLayer === "satellite" ? "卫星图" : "普通地图";

  return (
    <main className="flex min-h-screen bg-background text-foreground">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-white">
        <div className="border-b border-border p-5">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              MX
            </div>
            <div>
              <h1 className="text-lg font-semibold leading-6">MapX</h1>
              <p className="text-xs text-muted-foreground">项目制地图管理</p>
            </div>
          </div>
        </div>

        <section className="border-b border-border p-4" aria-label="项目切换器">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">项目</p>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="打开新建项目表单"
              onClick={() => openProjectCreate("button")}
            >
              <Plus />
            </Button>
          </div>

          <div className="space-y-2">
            {projectWorkspace.projects.map((project) => {
              const isCurrent = project.id === projectWorkspace.currentProject.id;

              if (isCurrent && isProjectRenameOpen) {
                return (
                  <form key={project.id} className="rounded-md border border-primary/30 bg-primary/5 p-2" onSubmit={handleProjectRename}>
                    <input
                      className="h-8 w-full rounded-md border border-input bg-white px-2 text-sm outline-none focus:border-primary"
                      value={projectRenameName}
                      onChange={(event) => setProjectRenameName(event.target.value)}
                      placeholder="项目名称"
                    />
                    <div className="mt-2 flex justify-end gap-1">
                      <Button type="button" size="icon" variant="ghost" disabled={isProjectRenaming} onClick={() => setProjectRenameName(project.name)}>
                        <RotateCcw />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={isProjectRenaming}
                        onClick={() => {
                          setIsProjectRenameOpen(false);
                          setProjectActionError(null);
                        }}
                      >
                        <X />
                      </Button>
                      <Button type="submit" size="icon" variant="ghost" disabled={isProjectRenaming}>
                        <Check />
                      </Button>
                    </div>
                  </form>
                );
              }

              return (
                <div
                  key={project.id}
                  className={`flex items-center rounded-md border transition ${
                    isCurrent
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "border-border text-foreground hover:border-primary/40 hover:bg-accent"
                  }`}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 px-3 py-2 text-left text-sm font-medium"
                    onClick={() => handleProjectSelect(project.id)}
                  >
                    <span className="block truncate">{project.name}</span>
                  </button>
                  <div className="flex shrink-0 gap-1 pr-1">
                    {isCurrent ? (
                      <Button type="button" size="icon" variant="ghost" aria-label={`重命名项目 ${project.name}`} onClick={openProjectRenameForm}>
                        <Pencil />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`删除项目 ${project.name}`}
                      onClick={() => openProjectDeleteConfirm(project.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {isProjectCreateOpen ? (
            <form className="mt-3 space-y-2" onSubmit={handleProjectCreate}>
              <input
                className="h-9 w-full rounded-md border border-input bg-white px-3 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary"
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="新项目名称"
              />
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="flex-1" disabled={isProjectSaving}>
                  <Plus />
                  保存
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setIsProjectCreateOpen(false);
                    setNewProjectName("");
                    setProjectActionError(null);
                  }}
                >
                  <X />
                  取消
                </Button>
              </div>
            </form>
          ) : null}

          {projectActionError ? <p className="mt-2 text-xs leading-5 text-red-600">{projectActionError}</p> : null}
        </section>

        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePanel === item.panel;

            return (
              <Button
                key={item.panel}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => handlePanelSelect(item.panel)}
              >
                <Icon />
                {item.label}
              </Button>
            );
          })}
        </nav>

        <div className="border-t border-border p-4 text-xs leading-5 text-muted-foreground">
          <p>默认城市：{firstLaunchSettings.defaultCity}</p>
          <p>搜索城市：{projectWorkspace.settings.searchCity}</p>
          <p>百度 AK：{akStatus}</p>
          <p>快捷键：Cmd/Ctrl+N/F/S、Esc、Delete</p>
        </div>
      </aside>

      <section className="grid min-w-0 flex-1 grid-cols-[minmax(420px,1fr)_340px]">
        <section className="flex min-w-0 flex-col bg-slate-50">
          <header className="flex h-16 items-center justify-between border-b border-border bg-white px-5">
            <div>
              <p className="text-xs text-muted-foreground">当前项目</p>
              <h2 className="text-base font-semibold">{projectWorkspace.currentProject.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 items-center rounded-md border border-input bg-white p-1" aria-label="地图图层">
                <button
                  type="button"
                  className={`flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition ${
                    projectWorkspace.settings.mapLayer === "normal"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                  disabled={isMapLayerSaving}
                  onClick={() => handleMapLayerChange("normal")}
                >
                  <MapIcon className="size-3.5" />
                  普通
                </button>
                <button
                  type="button"
                  className={`flex h-7 items-center gap-1 rounded px-2 text-xs font-medium transition ${
                    projectWorkspace.settings.mapLayer === "satellite"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                  disabled={isMapLayerSaving}
                  onClick={() => handleMapLayerChange("satellite")}
                >
                  <Satellite className="size-3.5" />
                  卫星
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  runWithMarkerDirtyGuard({
                    message: "打开搜索前，当前点位还有未保存的修改。",
                    run: () => runWorkspaceAction("search.focus", "button"),
                  })
                }
              >
                <Search />
                搜索
              </Button>
              <Button size="sm" onClick={() => openProjectCreate("button")}>
                <FolderOpen />
                新建项目
              </Button>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            {activePanel === "markers" ? (
              <MarkerListPanel
                projectId={projectWorkspace.currentProject.id}
                selectedMarkerId={selectedMarkerId}
                refreshKey={markerListRefreshKey}
                filters={markerListFilters}
                onSelectMarker={(marker) => {
                  runWithMarkerDirtyGuard({
                    message: "切换点位前，当前点位还有未保存的修改。",
                    run: () => selectMarkerRecord(marker),
                  });
                }}
                onFiltersChange={setMarkerListFilters}
                onFilteredMarkersChange={handleFilteredMarkersChange}
                onError={(error) => setProjectActionError(getBackendErrorMessage(error))}
              />
            ) : activePanel === "search" ? (
              <SearchPanel
                projectId={projectWorkspace.currentProject.id}
                baiduAk={firstLaunchSettings.baiduAk}
                searchCity={projectWorkspace.settings.searchCity}
                mapAvailability={mapAvailability}
                selectedMarkerId={selectedMarkerId}
                selectedPoiId={poiPreview?.id ?? null}
                onSearchCityChange={handleSearchCityChange}
                onSelectMarker={(marker) => {
                  runWithMarkerDirtyGuard({
                    message: "打开搜索结果前，当前点位还有未保存的修改。",
                    run: () => selectMarkerRecord(marker),
                  });
                }}
                onPreviewPoi={handlePreviewPoi}
                onCancelPoiPreview={handleCancelPoiPreview}
                onError={(error) => setProjectActionError(getBackendErrorMessage(error))}
              />
            ) : null}

            <div className="relative min-w-0 flex-1 overflow-hidden">
              <MapCanvas
                baiduAk={firstLaunchSettings.baiduAk}
                settings={projectWorkspace.settings}
                markers={mapMarkers}
                poiPreview={poiPreview}
                selectedMarkerId={pendingMarker?.id ?? selectedMarkerId}
                draggableMarkerId={coordinateEditMarkerId}
                isMarkerCreationMode={isMarkerCreationMode}
                pendingMarkerCoordinate={pendingMarker ? { lng: pendingMarker.lng, lat: pendingMarker.lat } : null}
                movedMarkerCoordinate={movedMarkerCoordinate}
                onSelectMarker={handleMapMarkerSelect}
                onMarkerDragged={handleMarkerDragged}
                onStartMarkerCreationMode={startMarkerCreationMode}
                onCancelMarkerCreationMode={cancelMarkerCreationMode}
                onCreateMarkerAtCoordinate={handleCreateMarkerAtCoordinate}
                onCreateMarkerAtCenter={handleCreateMarkerAtCenter}
                onOpenSettings={() =>
                  runWithMarkerDirtyGuard({
                    message: "打开设置前，当前点位还有未保存的修改。",
                    run: () => runWorkspaceAction("view.settings", "button"),
                  })
                }
                onOpenLogDirectory={() =>
                  openLogDirectory().catch((error) => setProjectActionError(getBackendErrorMessage(error)))
                }
                onAvailabilityChange={setMapAvailability}
              />
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col border-l border-border bg-white">
          <header className="border-b border-border p-5">
            <p className="text-xs text-muted-foreground">右侧详情</p>
            <h2 className="mt-1 text-base font-semibold">{detailTitle}</h2>
          </header>

          {activePanel === "markers" ? (
            <MarkerDetailPanel
              key={
                pendingMarker
                  ? `${pendingMarker.id}:${pendingMarker.source}:${pendingMarker.lng}:${pendingMarker.lat}:${pendingMarker.initialName ?? ""}`
                  : selectedMarkerRecord?.id ?? "empty-marker-detail"
              }
              projectId={projectWorkspace.currentProject.id}
              marker={selectedMarkerRecord}
              pendingMarker={pendingMarker}
              movedCoordinate={selectedMarkerRecord?.id === coordinateEditMarkerId ? movedMarkerCoordinate : null}
              onSaved={(marker) => {
                clearPendingMarker();
                setCoordinateEditMarkerId(null);
                setMovedMarkerCoordinate(null);
                setSelectedMarkerRecord(marker);
                selectMarker(marker.id);
                setMarkerListRefreshKey((currentKey) => currentKey + 1);
              }}
              onPendingCanceled={cancelMarkerCreationMode}
              onEditModeChange={handleMarkerEditModeChange}
              onCreateMarkerRequest={startMarkerCreationMode}
              onCreateCategoryRequest={() => setActivePanel("settings")}
              onCreateTagRequest={() => setActivePanel("settings")}
              onError={(error) => setProjectActionError(getBackendErrorMessage(error))}
              onDirtyHandlersChange={handleMarkerDirtyHandlersChange}
            />
          ) : activePanel === "search" ? (
            <div className="space-y-4 p-5">
              {poiPreview ? (
                <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">百度地点预览</p>
                      <h3 className="truncate text-sm font-semibold text-foreground">{poiPreview.name}</h3>
                    </div>
                    <Building2 className="size-4 shrink-0 text-primary" />
                  </div>
                  <dl className="space-y-2 text-muted-foreground">
                    <div>
                      <dt className="text-xs font-medium text-foreground">城市</dt>
                      <dd>{poiPreview.city ?? "未知城市"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-foreground">地址</dt>
                      <dd>{poiPreview.address ?? "无地址"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-foreground">坐标</dt>
                      <dd>
                        {poiPreview.lng.toFixed(5)}, {poiPreview.lat.toFixed(5)}
                      </dd>
                    </div>
                  </dl>
                  <Button type="button" size="sm" variant="outline" className="mt-4" onClick={handleCancelPoiPreview}>
                    <X />
                    取消预览
                  </Button>
                  <Button type="button" size="sm" className="ml-2 mt-4" onClick={handleSavePoiPreviewAsMarker}>
                    <Check />
                    保存为点位
                  </Button>
                </section>
              ) : null}
              <section className="rounded-lg border border-border p-4 text-sm leading-6 text-muted-foreground">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">我的点位</h3>
                  <Search className="size-4" />
                </div>
                <p>从左侧搜索结果选择点位后，MapX 会打开点位详情并同步地图选中态。</p>
              </section>
            </div>
          ) : activePanel === "settings" ? (
            <SettingsPanel
              settings={firstLaunchSettings}
              currentProjectId={projectWorkspace.currentProject.id}
              onChange={setFirstLaunchSettings}
              onError={handleSettingsError}
            />
          ) : (
            <div className="space-y-4 p-5">
              <section className="rounded-lg border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">项目设置</h3>
                  <Star className="size-4 text-amber-500" />
                </div>
                <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">搜索城市</dt>
                    <dd className="mt-1 font-medium">{projectWorkspace.settings.searchCity}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">图层</dt>
                    <dd className="mt-1 font-medium">{mapLayerLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">地图中心</dt>
                    <dd className="mt-1 font-medium">
                      {projectWorkspace.settings.mapCenterLng.toFixed(4)},{" "}
                      {projectWorkspace.settings.mapCenterLat.toFixed(4)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">缩放</dt>
                    <dd className="mt-1 font-medium">{projectWorkspace.settings.mapZoom}</dd>
                  </div>
                </dl>
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => runWorkspaceAction("view.settings", "button")}
                  >
                    <Settings />
                    打开设置
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="justify-start"
                    onClick={() => runWorkspaceAction("help.about", "button")}
                  >
                    <CircleHelp />
                    关于 MapX
                  </Button>
                </div>
              </section>

              <section className="rounded-lg border border-border bg-slate-50 p-4 text-sm leading-6">
                <h3 className="mb-2 font-semibold">最近动作</h3>
                {lastActionNotice ? (
                  <div>
                    <p className="font-medium">{lastActionNotice.label}</p>
                    <p className="text-muted-foreground">{lastActionNotice.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">来源：{lastActionNotice.source}</p>
                  </div>
                ) : (
                  <p className="text-muted-foreground">菜单和快捷键触发后会在这里显示占位状态。</p>
                )}
              </section>
            </div>
          )}
        </aside>
      </section>
      {dirtyPrompt ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6">
          <section className="w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-lg" role="dialog" aria-modal="true">
            <h2 className="text-base font-semibold">点位修改尚未保存</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{dirtyPrompt.message}</p>
            {dirtyPrompt.error ? <p className="mt-3 text-sm leading-6 text-red-600">{dirtyPrompt.error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                disabled={dirtyPrompt.isSaving}
                onClick={() => void handleDirtyPromptChoice("save")}
              >
                保存
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={dirtyPrompt.isSaving}
                onClick={() => void handleDirtyPromptChoice("discard")}
              >
                放弃更改
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={dirtyPrompt.isSaving}
                onClick={() => void handleDirtyPromptChoice("cancel")}
              >
                取消
              </Button>
            </div>
          </section>
        </div>
      ) : null}
      {pendingDeleteProject ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/35 p-6">
          <section className="w-full max-w-md rounded-lg border border-red-200 bg-white p-5 shadow-lg" role="dialog" aria-modal="true">
            <h2 className="text-base font-semibold text-red-700">确认删除“{pendingDeleteProject.name}”？</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              项目会从切换器隐藏，本地 SQLite 记录会保留并写入删除时间。
            </p>
            {pendingDeleteProject.id === projectWorkspace.currentProject.id ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                删除当前项目后，MapX 会切换到下一个可用项目；如果没有其他项目，会创建新的默认项目。
              </p>
            ) : null}
            {projectActionError ? <p className="mt-3 text-sm leading-6 text-red-600">{projectActionError}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isProjectDeleting}
                onClick={() => {
                  setPendingDeleteProjectId(null);
                  setProjectActionError(null);
                }}
              >
                <X />
                取消
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={isProjectDeleting}
                onClick={handleProjectDeleteConfirmed}
              >
                <Trash2 />
                删除项目
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function BootstrapGate({ title, message, detail }: { title: string; message: string; detail?: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-8 text-foreground">
      <section className="w-full max-w-lg rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            MX
          </div>
          <div>
            <h1 className="text-lg font-semibold">MapX</h1>
            <p className="text-xs text-muted-foreground">本地工作区启动检查</p>
          </div>
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{message}</p>
        {detail ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{detail}</p> : null}
      </section>
    </main>
  );
}

export default App;
