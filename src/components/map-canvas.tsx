import { useEffect, useMemo, useRef, useState } from "react";

import { createBaiduMapProvider } from "@/services/baidu-map-provider";
import type { MapProvider } from "@/services/map-provider";
import type { ProjectMapSettings } from "@/types/project";

type MapCanvasStatus = "missing-ak" | "loading" | "ready" | "failed";

interface MapLoadResult {
  key: string;
  status: "ready" | "failed";
  message?: string;
}

interface MapCanvasProps {
  baiduAk: string | null;
  settings: ProjectMapSettings;
}

export function MapCanvas({ baiduAk, settings }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const providerRef = useRef<MapProvider | null>(null);
  const [loadResult, setLoadResult] = useState<MapLoadResult | null>(null);
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
  const loadKey = `${ak}:${view.center.lng}:${view.center.lat}:${view.zoom}`;
  const status: MapCanvasStatus = !ak ? "missing-ak" : loadResult?.key === loadKey ? loadResult.status : "loading";
  const message = loadResult?.key === loadKey ? loadResult.message : null;

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-100">
      <div ref={containerRef} className="absolute inset-0" aria-label="百度地图画布" />
      {status === "ready" ? null : (
        <div className="absolute inset-0 grid place-items-center bg-white/78 p-6 text-center backdrop-blur-sm">
          <div className="max-w-sm rounded-md border border-border bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold">{getStatusTitle(status)}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{message ?? getStatusMessage(status)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function getStatusTitle(status: MapCanvasStatus) {
  switch (status) {
    case "missing-ak":
      return "地图未启用";
    case "loading":
      return "正在加载百度地图";
    case "failed":
      return "地图加载失败";
    case "ready":
      return "地图已加载";
  }
}

function getStatusMessage(status: MapCanvasStatus) {
  switch (status) {
    case "missing-ak":
      return "请在设置中填写百度地图开放平台 AK。";
    case "loading":
      return "MapX 正在初始化当前项目的地图中心。";
    case "failed":
      return "请检查 AK、白名单或网络连接。";
    case "ready":
      return "";
  }
}
