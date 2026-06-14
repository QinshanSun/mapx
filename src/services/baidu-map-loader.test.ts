import { describe, expect, it, vi } from "vitest";

import { buildBaiduMapScriptUrl, loadBaiduMapScript } from "@/services/baidu-map-loader";

const CALLBACK_NAME = "__mapxBaiduMapLoaded";

describe("baidu map script loader", () => {
  it("does not inject a script when the AK is missing", async () => {
    const fake = createFakeDocument();

    await expect(loadBaiduMapScript("  ", { document: fake.document })).resolves.toEqual({
      status: "missing-ak",
      code: "BAIDU_AK_MISSING",
      message: "未配置百度地图 AK",
    });

    expect(fake.appendChild).not.toHaveBeenCalled();
  });

  it("injects the Baidu WebGL script when an AK is present", async () => {
    const fake = createFakeDocument();
    const loading = loadBaiduMapScript(" test-ak ", { document: fake.document });

    expect(fake.appendChild).toHaveBeenCalledTimes(1);
    expect(fake.script?.src).toBe(buildBaiduMapScriptUrl("test-ak"));
    expect(fake.script?.async).toBe(true);
    expect(fake.script?.defer).toBe(true);

    fake.resolveBaiduCallback();

    await expect(loading).resolves.toEqual({ status: "loaded" });
  });

  it("reuses the active load when the same AK is requested twice", async () => {
    const fake = createFakeDocument();
    const firstLoad = loadBaiduMapScript("same-ak", { document: fake.document });
    const secondLoad = loadBaiduMapScript("same-ak", { document: fake.document });

    expect(secondLoad).toBe(firstLoad);
    expect(fake.appendChild).toHaveBeenCalledTimes(1);

    fake.resolveBaiduCallback();

    await expect(firstLoad).resolves.toEqual({ status: "loaded" });
  });

  it("returns a structured failure when the script errors", async () => {
    const fake = createFakeDocument();
    const loading = loadBaiduMapScript("bad-ak", { document: fake.document });

    fake.script?.onerror?.(new Event("error"));

    await expect(loading).resolves.toEqual({
      status: "failed",
      code: "BAIDU_MAP_LOAD_FAILED",
      message: "百度地图加载失败，请检查 AK、白名单或网络连接",
    });
    expect(fake.script?.remove).toHaveBeenCalledTimes(1);
  });

  it("returns a structured failure when loading times out", async () => {
    const fake = createFakeDocument();
    const loading = loadBaiduMapScript("slow-ak", { document: fake.document, timeoutMs: 1 });

    fake.runTimeout();

    await expect(loading).resolves.toEqual({
      status: "failed",
      code: "BAIDU_MAP_LOAD_FAILED",
      message: "百度地图加载超时，请检查 AK、白名单或网络连接",
    });
    expect(fake.script?.remove).toHaveBeenCalledTimes(1);
  });
});

function createFakeDocument() {
  let script: FakeScript | null = null;
  let timeoutHandler: (() => void) | null = null;
  const elements = new Map<string, FakeScript>();
  const win = {
    setTimeout: vi.fn((handler: () => void) => {
      timeoutHandler = handler;
      return 1;
    }),
    clearTimeout: vi.fn(),
  } as unknown as Window & Record<string, unknown>;
  const appendChild = vi.fn((element: FakeScript) => {
    script = element;
    elements.set(element.id, element);
  });
  const document = {
    defaultView: win,
    body: { appendChild },
    createElement: vi.fn(() => new FakeScript(elements)),
    getElementById: vi.fn((id: string) => elements.get(id) ?? null),
  } as unknown as Document;

  return {
    document,
    appendChild,
    get script() {
      return script;
    },
    resolveBaiduCallback() {
      const callback = win[CALLBACK_NAME] as (() => void) | undefined;
      callback?.();
    },
    runTimeout() {
      timeoutHandler?.();
    },
  };
}

class FakeScript {
  id = "";
  async = false;
  defer = false;
  src = "";
  onerror: ((event: Event) => void) | null = null;

  constructor(private readonly elements: Map<string, FakeScript>) {}

  remove = vi.fn(() => {
    this.elements.delete(this.id);
  });
}
