import { KeyRound, MapPinned } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { buildCompleteFirstLaunchInput, completeFirstLaunch } from "@/services/settings-service";
import type { FirstLaunchSettings } from "@/types/settings";

interface FirstLaunchFlowProps {
  initialSettings: FirstLaunchSettings;
  onComplete: (settings: FirstLaunchSettings) => void;
  onError: (error: unknown) => void;
}

export function FirstLaunchFlow({ initialSettings, onComplete, onError }: FirstLaunchFlowProps) {
  const [defaultCity, setDefaultCity] = useState(initialSettings.defaultCity);
  const [baiduAk, setBaiduAk] = useState(initialSettings.baiduAk ?? "");
  const [isSaving, setIsSaving] = useState(false);

  async function submit(skipBaiduAk: boolean) {
    setIsSaving(true);
    try {
      const settings = await completeFirstLaunch(
        buildCompleteFirstLaunchInput({ defaultCity, baiduAk }, { skipBaiduAk }),
      );
      onComplete(settings);
    } catch (error) {
      onError(error);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-8 text-foreground">
      <section className="w-full max-w-xl rounded-lg border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <MapPinned className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">MapX 初始设置</h1>
            <p className="text-xs text-muted-foreground">项目制地图管理</p>
          </div>
        </div>

        <div className="space-y-5">
          <label className="block text-sm font-medium" htmlFor="default-city">
            默认城市
            <input
              id="default-city"
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
              value={defaultCity}
              onChange={(event) => setDefaultCity(event.target.value)}
            />
          </label>

          <label className="block text-sm font-medium" htmlFor="baidu-ak">
            百度地图 AK
            <div className="relative mt-2">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="baidu-ak"
                className="h-10 w-full rounded-md border border-input bg-background px-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
                value={baiduAk}
                onChange={(event) => setBaiduAk(event.target.value)}
                placeholder="可稍后在设置中填写"
              />
            </div>
          </label>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="outline" disabled={isSaving} onClick={() => submit(true)}>
              跳过 AK
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => submit(false)}>
              保存并进入
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
