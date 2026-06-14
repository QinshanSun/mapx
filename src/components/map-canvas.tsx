import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, RotateCcw, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createBaiduMapProvider } from "@/services/baidu-map-provider";
import { resolveMapCanvasOverlay, type MapCanvasActionId } from "@/services/map-canvas-state";
import type { MapMarkerItem, MapProvider } from "@/services/map-provider";
import type { ProjectMapSettings } from "@/types/project";

interface MapLoadResult {
  key: string;
  status: "ready" | "failed";
  message?: string;
}

interface MapCanvasProps {
  baiduAk: string | null;
  settings: ProjectMapSettings;
  markers: MapMarkerItem[];
  selectedMarkerId: string | null;
  onSelectMarker: (markerId: string) => void;
  onOpenSettings: () => void;
  onOpenLogDirectory: () => void | Promise<void>;
}

export function MapCanvas({
  baiduAk,
  settings,
  markers,
  selectedMarkerId,
  onSelectMarker,
  onOpenSettings,
  onOpenLogDirectory,
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
  const status = !ak ? "missing-ak" : loadResult?.key === loadKey ? loadResult.status : "loading";
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
    providerRef.current?.setMarkerClickHandler(onSelectMarker);

    return () => {
      providerRef.current?.setMarkerClickHandler(null);
    };
  }, [onSelectMarker]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      <div ref={containerRef} className="absolute inset-0" aria-label="百度地图画布" />
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
