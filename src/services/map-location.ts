export const DEFAULT_LOCATE_ME_ZOOM = 16;
export const DEFAULT_LOCATION_TIMEOUT_MS = 10_000;

const LOCATION_ERROR_CODES = new Set([
  "MAP_LOCATION_UNAVAILABLE",
  "MAP_LOCATION_PERMISSION_DENIED",
  "MAP_LOCATION_TIMEOUT",
  "MAP_LOCATION_FAILED",
]);

export function getMapLocationErrorCode(error: unknown) {
  if (error instanceof Error && LOCATION_ERROR_CODES.has(error.message)) {
    return error.message;
  }

  return "MAP_LOCATION_FAILED";
}

export function getMapLocationErrorMessage(error: unknown) {
  switch (getMapLocationErrorCode(error)) {
    case "MAP_LOCATION_UNAVAILABLE":
      return "当前环境不支持定位，可继续手动操作地图。";
    case "MAP_LOCATION_PERMISSION_DENIED":
      return "定位权限未开启，可在系统或浏览器设置中允许定位。";
    case "MAP_LOCATION_TIMEOUT":
      return "定位超时，可稍后重试或手动移动地图。";
    case "MAP_LOCATION_FAILED":
    default:
      return "定位失败，可继续手动操作地图。";
  }
}

export function getBrowserGeolocationErrorCode(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "MAP_LOCATION_PERMISSION_DENIED";
  }

  if (error.code === error.TIMEOUT) {
    return "MAP_LOCATION_TIMEOUT";
  }

  return "MAP_LOCATION_FAILED";
}
