export const TAURI_DEV_ORIGIN = "http://localhost:1420";
export const BROWSER_DEV_ORIGIN = "http://127.0.0.1:1420";
export const MACOS_PACKAGED_ORIGIN = "tauri://localhost";
export const WINDOWS_PACKAGED_ORIGINS = ["http://tauri.localhost", "https://tauri.localhost"];

export interface BaiduAkOriginGuidance {
  currentOrigin: string;
  devOrigins: string[];
  packagedOrigins: string[];
  failureChecks: string[];
}

export function buildBaiduAkOriginGuidance(currentOrigin = readCurrentOrigin()): BaiduAkOriginGuidance {
  return {
    currentOrigin,
    devOrigins: [MACOS_PACKAGED_ORIGIN, TAURI_DEV_ORIGIN, BROWSER_DEV_ORIGIN],
    packagedOrigins: [MACOS_PACKAGED_ORIGIN, ...WINDOWS_PACKAGED_ORIGINS],
    failureChecks: ["AK 是否正确", "白名单是否包含当前运行来源", "网络连接是否可用", "百度地图开放平台服务是否正常"],
  };
}

function readCurrentOrigin() {
  if (typeof window === "undefined") {
    return "未知";
  }

  return window.location.origin || `${window.location.protocol}//${window.location.host}`;
}
