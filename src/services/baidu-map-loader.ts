const BAIDU_MAP_SCRIPT_ID = "mapx-baidu-map-gl-script";
const BAIDU_MAP_CALLBACK = "__mapxBaiduMapLoaded";
const DEFAULT_TIMEOUT_MS = 15_000;

export type BaiduMapLoadStatus = "missing-ak" | "loading" | "loaded" | "failed";

export interface BaiduMapLoadResult {
  status: Exclude<BaiduMapLoadStatus, "loading">;
  code?: "BAIDU_AK_MISSING" | "BAIDU_MAP_LOAD_FAILED";
  message?: string;
}

interface BaiduMapLoaderOptions {
  document?: Document;
  timeoutMs?: number;
}

let activeLoad: Promise<BaiduMapLoadResult> | null = null;
let activeAk: string | null = null;

export function loadBaiduMapScript(baiduAk: string | null | undefined, options: BaiduMapLoaderOptions = {}) {
  const ak = baiduAk?.trim();

  if (!ak) {
    return Promise.resolve<BaiduMapLoadResult>({
      status: "missing-ak",
      code: "BAIDU_AK_MISSING",
      message: "未配置百度地图 AK",
    });
  }

  const doc = options.document ?? document;
  const win = doc.defaultView ?? window;
  const existing = doc.getElementById(BAIDU_MAP_SCRIPT_ID) as HTMLScriptElement | null;

  if (isBaiduMapReady(win)) {
    return Promise.resolve<BaiduMapLoadResult>({ status: "loaded" });
  }

  if (activeLoad && activeAk === ak) {
    return activeLoad;
  }

  if (existing) {
    existing.remove();
  }

  activeAk = ak;
  activeLoad = injectBaiduMapScript(ak, doc, options.timeoutMs ?? DEFAULT_TIMEOUT_MS).finally(() => {
    activeLoad = null;
  });

  return activeLoad;
}

export function buildBaiduMapScriptUrl(baiduAk: string, callbackName = BAIDU_MAP_CALLBACK) {
  const url = new URL("https://api.map.baidu.com/api");
  url.searchParams.set("v", "1.0");
  url.searchParams.set("type", "webgl");
  url.searchParams.set("ak", baiduAk);
  url.searchParams.set("callback", callbackName);
  return url.toString();
}

function injectBaiduMapScript(baiduAk: string, doc: Document, timeoutMs: number) {
  return new Promise<BaiduMapLoadResult>((resolve) => {
    const script = doc.createElement("script");
    const win = doc.defaultView ?? window;
    const callbackHost = win as unknown as Window & Record<string, unknown>;
    let settled = false;

    function finish(result: BaiduMapLoadResult) {
      if (settled) {
        return;
      }

      settled = true;
      win.clearTimeout(timeoutId);
      delete callbackHost[BAIDU_MAP_CALLBACK];
      resolve(result);
    }

    callbackHost[BAIDU_MAP_CALLBACK] = () => {
      finish({ status: "loaded" });
    };

    script.id = BAIDU_MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = buildBaiduMapScriptUrl(baiduAk);
    script.onerror = () => {
      script.remove();
      finish({
        status: "failed",
        code: "BAIDU_MAP_LOAD_FAILED",
        message: "百度地图加载失败，请检查 AK、白名单或网络连接",
      });
    };

    const timeoutId = win.setTimeout(() => {
      script.remove();
      finish({
        status: "failed",
        code: "BAIDU_MAP_LOAD_FAILED",
        message: "百度地图加载超时，请检查 AK、白名单或网络连接",
      });
    }, timeoutMs);

    doc.body.appendChild(script);
  });
}

function isBaiduMapReady(win: Window) {
  if (!win) {
    return false;
  }

  return Boolean((win as Window & { BMapGL?: unknown }).BMapGL);
}
