import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, FolderOpen, MapPin, Plus, RotateCcw, Settings, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createBaiduMapProvider } from "@/services/baidu-map-provider";
import { resolveMapCanvasOverlay, type MapCanvasActionId } from "@/services/map-canvas-state";
import type { MapCoordinate, MapMarkerItem, MapPoiPreview, MapProvider } from "@/services/map-provider";
import type { ProjectMapSettings } from "@/types/project";

interface MapLoadResult {
  key: string;
  status: "ready" | "failed";
  message?: string;
}

export type MapCanvasAvailability = "missing-ak" | "loading" | "ready" | "failed";

interface MapCanvasProps {
  baiduAk: string | null;
  settings: ProjectMapSettings;
  markers: MapMarkerItem[];
  poiPreview: MapPoiPreview | null;
  selectedMarkerId: string | null;
  draggableMarkerId: string | null;
  isMarkerCreationMode: boolean;
  pendingMarkerCoordinate: MapCoordinate | null;
  movedMarkerCoordinate: MapCoordinate | null;
  onSelectMarker: (markerId: string) => void;
  onMarkerDragged: (markerId: string, coordinate: MapCoordinate) => void;
  onStartMarkerCreationMode: () => void;
  onCancelMarkerCreationMode: () => void;
  onCreateMarkerAtCoordinate: (coordinate: MapCoordinate) => void;
  onCreateMarkerAtCenter: (coordinate: MapCoordinate) => void;
  onOpenSettings: () => void;
  onOpenLogDirectory: () => void | Promise<void>;
  onAvailabilityChange?: (availability: MapCanvasAvailability) => void;
}

export function MapCanvas({
  baiduAk,
  settings,
  markers,
  poiPreview,
  selectedMarkerId,
  draggableMarkerId,
  isMarkerCreationMode,
  pendingMarkerCoordinate,
  movedMarkerCoordinate,
  onSelectMarker,
  onMarkerDragged,
  onStartMarkerCreationMode,
  onCancelMarkerCreationMode,
  onCreateMarkerAtCoordinate,
  onCreateMarkerAtCenter,
  onOpenSettings,
  onOpenLogDirectory,
  onAvailabilityChange,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<MapProvider | null>(null);
  const [loadResult, setLoadResult] = useState<MapLoadResult | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const ak = baiduAk?.trim() ?? "";
  const view = useMemo(
    () => ({
      center: {
        lng: settings.mapCenterLng,
        lat: settings.mapCenterLat,
      },
      zoom: settings.mapZoom,
    }),
    [settings.mapCenterLat, settings.mapCenterLng, settings.mapZoom],
  );
  const loadKey = `${ak}:${view.center.lng}:${view.center.lat}:${view.zoom}:${retryCount}`;
  const status: MapCanvasAvailability = !ak ? "missing-ak" : loadResult?.key === loadKey ? loadResult.status : "loading";
  const message = loadResult?.key === loadKey ? loadResult.message : null;
  const overlay = resolveMapCanvasOverlay(status, message);

  function handleAction(actionId: MapCanvasActionId) {
    if (actionId === "retry") {
      setLoadResult(null);
      setRetryCount((currentCount) => currentCount + 1);
      return;
    }

    if (actionId === "settings") {
      onOpenSettings();
      return;
    }

    void onOpenLogDirectory();
  }

  function handleCreateAtCenter() {
    onCreateMarkerAtCenter(providerRef.current?.getView()?.center ?? view.center);
  }

  useEffect(() => {
    onAvailabilityChange?.(status);
  }, [onAvailabilityChange, status]);

  useEffect(() => {
    let disposed = false;
    const container = containerRef.current;

    providerRef.current?.destroy();
    providerRef.current = null;

    if (!ak) {
      return;
    }

    if (!container) {
      return;
    }

    const provider = createBaiduMapProvider(ak);
    providerRef.current = provider;

    provider
      .init(container, view)
      .then(() => {
        if (!disposed) {
          setLoadResult({ key: loadKey, status: "ready" });
        }
      })
      .catch(() => {
        if (!disposed) {
          setLoadResult({ key: loadKey, status: "failed", message: "百度地图加载失败，请检查 AK、白名单或网络连接" });
        }
      });

    return () => {
      disposed = true;
      provider.destroy();
      if (providerRef.current === provider) {
        providerRef.current = null;
      }
    };
  }, [ak, loadKey, view]);

  useEffect(() => {
    providerRef.current?.setLayer(settings.mapLayer);
  }, [settings.mapLayer]);

  useEffect(() => {
    providerRef.current?.setMarkers(markers);
  }, [markers]);

  useEffect(() => {
    providerRef.current?.setSelectedMarker(selectedMarkerId);
  }, [selectedMarkerId]);

  useEffect(() => {
    providerRef.current?.setDraggableMarker(draggableMarkerId);
  }, [draggableMarkerId]);

  useEffect(() => {
    providerRef.current?.setPoiPreview(poiPreview);
  }, [poiPreview]);

  useEffect(() => {
    providerRef.current?.setMarkerClickHandler(onSelectMarker);

    return () => {
      providerRef.current?.setMarkerClickHandler(null);
    };
  }, [onSelectMarker]);

  useEffect(() => {
    providerRef.current?.setMarkerDragHandler(onMarkerDragged);

    return () => {
      providerRef.current?.setMarkerDragHandler(null);
    };
  }, [onMarkerDragged]);

  useEffect(() => {
    providerRef.current?.setMapClickHandler(isMarkerCreationMode ? onCreateMarkerAtCoordinate : null);

    return () => {
      providerRef.current?.setMapClickHandler(null);
    };
  }, [isMarkerCreationMode, onCreateMarkerAtCoordinate]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      <div ref={containerRef} className="absolute inset-0" aria-label="百度地图画布" />
      <div className="absolute left-4 top-4 z-20 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={isMarkerCreationMode ? "default" : "outline"}
          className="bg-white shadow-sm data-[active=true]:bg-primary data-[active=true]:text-primary-foreground"
          data-active={isMarkerCreationMode}
          onClick={isMarkerCreationMode ? onCancelMarkerCreationMode : onStartMarkerCreationMode}
        >
          {isMarkerCreationMode ? <X /> : <Plus />}
          {isMarkerCreationMode ? "取消添加" : "添加点位"}
        </Button>
        <Button type="button" size="sm" variant="outline" className="bg-white shadow-sm" onClick={handleCreateAtCenter}>
          <Crosshair />
          中心点
        </Button>
        {pendingMarkerCoordinate ? (
          <div className="flex h-9 items-center gap-2 rounded-md border border-primary/30 bg-white px-3 text-xs font-medium text-primary shadow-sm">
            <MapPin className="size-3.5" />
            {pendingMarkerCoordinate.lng.toFixed(5)}, {pendingMarkerCoordinate.lat.toFixed(5)}
          </div>
        ) : null}
        {movedMarkerCoordinate ? (
          <div className="flex h-9 items-center gap-2 rounded-md border border-amber-300 bg-white px-3 text-xs font-medium text-amber-700 shadow-sm">
            <MapPin className="size-3.5" />
            {movedMarkerCoordinate.lng.toFixed(5)}, {movedMarkerCoordinate.lat.toFixed(5)}
          </div>
        ) : null}
      </div>
      {status === "ready" ? null : (
        <div
          className="absolute inset-0 grid place-items-center bg-white/78 p-6 text-center backdrop-blur-sm"
          aria-live="polite"
          data-testid="map-canvas-overlay"
        >
          <div className="max-w-sm rounded-md border border-border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold">{overlay.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{overlay.message}</p>
            {overlay.actions.length > 0 ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {overlay.actions.map((action) => (
                  <Button
                    key={action.id}
                    type="button"
                    size="sm"
                    variant={action.id === "retry" ? "default" : "outline"}
                    data-testid={`map-canvas-action-${action.id}`}
                    onClick={() => handleAction(action.id)}
                  >
                    <MapCanvasActionIcon actionId={action.id} />
                    {action.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function MapCanvasActionIcon({ actionId }: { actionId: MapCanvasActionId }) {
  if (actionId === "retry") {
    return <RotateCcw />;
  }

  if (actionId === "settings") {
    return <Settings />;
  }

  return <FolderOpen />;
}
