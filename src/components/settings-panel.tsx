import { Check, ExternalLink, FolderOpen, Info, KeyRound, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CategoryManagementPanel } from "@/components/category-management-panel";
import { TagManagementPanel } from "@/components/tag-management-panel";
import { Button } from "@/components/ui/button";
import { CHINA_CITIES, normalizeCityName } from "@/data/china-cities";
import { buildBaiduAkOriginGuidance } from "@/services/map-runtime";
import {
  getAppInfo,
  getBackupInfo,
  openBackupDirectory,
  openDataDirectory,
  openLogDirectory,
  updateAutoUpdateCheckOnStartup,
  updateBaiduAk,
  updateDefaultCity,
} from "@/services/settings-service";
import { openUpdateDownloadPage } from "@/services/update-service";
import type { AppInfo, BackupInfo, FirstLaunchSettings } from "@/types/settings";

export type ManualUpdateCheckFeedback =
  | { status: "latest" | "available"; message: string }
  | { status: "error"; message: string; canOpenDownloadPage: boolean };

interface SettingsPanelProps {
  settings: FirstLaunchSettings;
  currentProjectId: string;
  onChange: (settings: FirstLaunchSettings) => void;
  onError: (error: unknown) => void;
  onCheckForUpdate: () => Promise<ManualUpdateCheckFeedback>;
}

export function SettingsPanel({ settings, currentProjectId, onChange, onError, onCheckForUpdate }: SettingsPanelProps) {
  const citySelectRef = useRef<HTMLSelectElement>(null);
  const [selectedCity, setSelectedCity] = useState(normalizeCityName(settings.defaultCity));
  const [akDraft, setAkDraft] = useState(settings.baiduAk ?? "");
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null);
  const [isCitySaving, setIsCitySaving] = useState(false);
  const [isAkSaving, setIsAkSaving] = useState(false);
  const [isOpeningDataDirectory, setIsOpeningDataDirectory] = useState(false);
  const [isOpeningBackupDirectory, setIsOpeningBackupDirectory] = useState(false);
  const [isOpeningLogDirectory, setIsOpeningLogDirectory] = useState(false);
  const [isAutoUpdateSaving, setIsAutoUpdateSaving] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<ManualUpdateCheckFeedback | null>(null);
  const originGuidance = buildBaiduAkOriginGuidance();
  const currentCity = CHINA_CITIES.find((city) => city.name === selectedCity) ?? CHINA_CITIES[0];
  const hasChanges = selectedCity !== normalizeCityName(settings.defaultCity);
  const hasAkChanges = akDraft.trim() !== (settings.baiduAk ?? "");

  useEffect(() => {
    let isActive = true;

    Promise.all([getAppInfo(), getBackupInfo()])
      .then(([nextAppInfo, nextBackupInfo]) => {
        if (isActive) {
          setAppInfo(nextAppInfo);
          setBackupInfo(nextBackupInfo);
        }
      })
      .catch(onError);

    return () => {
      isActive = false;
    };
  }, [onError]);

  async function saveCity() {
    setIsCitySaving(true);
    try {
      const cityToSave = normalizeCityName(citySelectRef.current?.value ?? selectedCity);
      const nextSettings = await updateDefaultCity(cityToSave, settings);
      onChange(nextSettings);
      setSelectedCity(nextSettings.defaultCity);
    } catch (error) {
      onError(error);
    } finally {
      setIsCitySaving(false);
    }
  }

  async function saveAk(nextValue: string | null) {
    setIsAkSaving(true);
    try {
      const nextSettings = await updateBaiduAk(nextValue, settings);
      onChange(nextSettings);
      setAkDraft(nextSettings.baiduAk ?? "");
    } catch (error) {
      onError(error);
    } finally {
      setIsAkSaving(false);
    }
  }

  async function openDataDir() {
    setIsOpeningDataDirectory(true);
    try {
      await openDataDirectory();
    } catch (error) {
      onError(error);
    } finally {
      setIsOpeningDataDirectory(false);
    }
  }

  async function openBackupDir() {
    setIsOpeningBackupDirectory(true);
    try {
      await openBackupDirectory();
    } catch (error) {
      onError(error);
    } finally {
      setIsOpeningBackupDirectory(false);
    }
  }

  async function openLogDir() {
    setIsOpeningLogDirectory(true);
    try {
      await openLogDirectory();
    } catch (error) {
      onError(error);
    } finally {
      setIsOpeningLogDirectory(false);
    }
  }

  async function saveAutoUpdateCheckOnStartup(enabled: boolean) {
    setIsAutoUpdateSaving(true);
    setUpdateFeedback(null);
    try {
      const nextSettings = await updateAutoUpdateCheckOnStartup(enabled, settings);
      onChange(nextSettings);
    } catch (error) {
      onError(error);
    } finally {
      setIsAutoUpdateSaving(false);
    }
  }

  async function checkForUpdate() {
    setIsCheckingUpdate(true);
    setUpdateFeedback(null);
    try {
      setUpdateFeedback(await onCheckForUpdate());
    } finally {
      setIsCheckingUpdate(false);
    }
  }

  async function openDownloadPage() {
    try {
      await openUpdateDownloadPage();
    } catch (error) {
      onError(error);
    }
  }

  return (
    <div className="space-y-4 p-5">
      <section className="rounded-lg border border-border p-4">
        <label className="block text-sm font-medium" htmlFor="settings-default-city">
          默认城市
          <select
            ref={citySelectRef}
            id="settings-default-city"
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
            value={selectedCity}
            onInput={(event) => setSelectedCity(event.currentTarget.value)}
            onChange={(event) => setSelectedCity(event.target.value)}
          >
            {CHINA_CITIES.map((city) => (
              <option key={city.name} value={city.name}>
                {city.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 rounded-md bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">
          <p>城市中心：{currentCity.centerLng.toFixed(4)}, {currentCity.centerLat.toFixed(4)}</p>
          <p>百度 AK：{settings.baiduAk ? "已配置" : "未配置"}</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!hasChanges || isCitySaving}
            onClick={() => setSelectedCity(normalizeCityName(settings.defaultCity))}
          >
            <RotateCcw />
            恢复
          </Button>
          <Button type="button" size="sm" disabled={!hasChanges || isCitySaving} onClick={saveCity}>
            <Check />
            保存城市
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <label className="block text-sm font-medium" htmlFor="settings-baidu-ak">
          百度地图 AK
          <div className="relative mt-2">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="settings-baidu-ak"
              className="h-10 w-full rounded-md border border-input bg-background px-9 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-ring"
              type="password"
              value={akDraft}
              placeholder="可留空，稍后再配置"
              onChange={(event) => setAkDraft(event.target.value)}
            />
          </div>
        </label>

        <div className="mt-3 space-y-2 rounded-md bg-slate-50 p-3 text-xs leading-5 text-muted-foreground">
          <p className="break-all">当前运行来源：{originGuidance.currentOrigin}</p>
          <p className="break-all">开发白名单：{originGuidance.devOrigins.join("、")}</p>
          <p className="break-all">打包白名单参考：{originGuidance.packagedOrigins.join("、")}</p>
          <p>地图无法加载时，请检查{originGuidance.failureChecks.join("、")}。</p>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isAkSaving || (!settings.baiduAk && !akDraft.trim())}
            onClick={() => saveAk(null)}
          >
            <Trash2 />
            清除
          </Button>
          <Button type="button" size="sm" disabled={isAkSaving || !hasAkChanges} onClick={() => saveAk(akDraft)}>
            <Check />
            保存 AK
          </Button>
        </div>
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">本地目录</h3>
          <FolderOpen className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-2 text-xs leading-5 text-muted-foreground">
          <p className="break-all">数据目录：{appInfo?.dataDirectory ?? "正在读取"}</p>
          <p className="break-all">备份目录：{backupInfo?.backupDirectory ?? "正在读取"}</p>
          <p>最近备份：{backupInfo?.latestBackupAt ?? "暂无备份"}</p>
          {backupInfo?.latestBackupPath ? <p className="break-all">备份文件：{backupInfo.latestBackupPath}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isOpeningBackupDirectory || !backupInfo}
            onClick={openBackupDir}
          >
            <FolderOpen />
            打开备份目录
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isOpeningLogDirectory}
            onClick={openLogDir}
          >
            <FolderOpen />
            打开日志目录
          </Button>
          <Button type="button" size="sm" disabled={isOpeningDataDirectory || !appInfo} onClick={openDataDir}>
            <FolderOpen />
            打开数据目录
          </Button>
        </div>
      </section>

      <CategoryManagementPanel projectId={currentProjectId} onError={onError} />

      <TagManagementPanel projectId={currentProjectId} onError={onError} />

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">关于 MapX</h3>
          <Info className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-2 text-xs leading-5 text-muted-foreground">
          <p>应用名称：{appInfo?.appName ?? "MapX"}</p>
          <p>版本：{appInfo?.version ?? "正在读取"}</p>
          <p className="break-all">数据库：{appInfo?.databasePath ?? "正在读取"}</p>
        </div>
        <div className="mt-4 rounded-md bg-slate-50 p-3">
          <label className="flex items-center justify-between gap-3 text-sm font-medium" htmlFor="settings-auto-update-check">
            <span>启动时自动检查更新</span>
            <input
              id="settings-auto-update-check"
              type="checkbox"
              className="size-4 accent-primary"
              checked={settings.autoUpdateCheckOnStartup}
              disabled={isAutoUpdateSaving}
              onChange={(event) => void saveAutoUpdateCheckOnStartup(event.currentTarget.checked)}
            />
          </label>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">后台检查失败只记录日志，不会影响进入主界面。</p>
          {updateFeedback ? (
            <p className={updateFeedback.status === "error" ? "mt-3 text-xs leading-5 text-red-600" : "mt-3 text-xs leading-5 text-emerald-700"}>
              {updateFeedback.message}
            </p>
          ) : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void openDownloadPage()}>
            <ExternalLink />
            打开下载页面
          </Button>
          <Button type="button" size="sm" disabled={isCheckingUpdate} onClick={() => void checkForUpdate()}>
            <RefreshCw className={isCheckingUpdate ? "animate-spin" : undefined} />
            检查更新
          </Button>
        </div>
      </section>
    </div>
  );
}
