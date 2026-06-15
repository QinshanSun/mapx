export type MapCanvasStatus = "missing-ak" | "loading" | "ready" | "failed";

export type MapCanvasActionId = "retry" | "settings" | "logs";

export type MapLocateStatus = "idle" | "loading" | "success" | "failed";

export interface MapCanvasAction {
  id: MapCanvasActionId;
  label: string;
}

export interface MapCanvasOverlayState {
  title: string;
  message: string;
  actions: MapCanvasAction[];
}

export function resolveMapCanvasOverlay(status: MapCanvasStatus, message?: string | null): MapCanvasOverlayState {
  switch (status) {
    case "missing-ak":
      return {
        title: "地图未启用",
        message: message ?? "请在设置中填写百度地图开放平台 AK。",
        actions: [{ id: "settings", label: "打开设置" }],
      };
    case "loading":
      return {
        title: "正在加载百度地图",
        message: message ?? "MapX 正在初始化当前项目的地图中心。",
        actions: [],
      };
    case "failed":
      return {
        title: "地图加载失败",
        message: message ?? "请检查 AK、白名单或网络连接。",
        actions: [
          { id: "retry", label: "重试" },
          { id: "settings", label: "打开设置" },
          { id: "logs", label: "打开日志目录" },
        ],
      };
    case "ready":
      return {
        title: "地图已加载",
        message: "",
        actions: [],
      };
  }
}

export function isMapZoomControlEnabled(status: MapCanvasStatus) {
  return status === "ready";
}

export function resolveLocateStatusMessage(status: MapLocateStatus, coordinate?: { lng: number; lat: number } | null, errorMessage?: string) {
  switch (status) {
    case "loading":
      return "正在定位...";
    case "success":
      return coordinate ? `已定位到当前位置：${coordinate.lng.toFixed(5)}, ${coordinate.lat.toFixed(5)}` : "已定位到当前位置。";
    case "failed":
      return `${errorMessage || "定位失败"}，可继续手动操作地图。`;
    case "idle":
      return null;
  }
}
