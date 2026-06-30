import {
  Check,
  CircleHelp,
  Database,
  Download,
  ExternalLink,
  FolderOpen,
  Info,
  KeyRound,
  Map,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

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
import { buildUpdateStatusViewModel, shouldShowManualUpdateError } from "@/services/update-state";
import type { AppInfo, BackupInfo, FirstLaunchSettings } from "@/types/settings";
import type { AppUpdateState } from "@/types/update";

interface SettingsPanelProps {
  settings: FirstLaunchSettings;
  updateState: AppUpdateState;
  onClose: () => void;
  onChange: (settings: FirstLaunchSettings) => void;
  onError: (error: unknown) => void;
  onCheckForUpdates: () => void;
  onDownloadUpdate: () => void;
  onRestartToInstallUpdate: () => void;
  onOpenDownloadPage: () => void;
}

type SettingsSectionId = "general" | "map" | "storage" | "about";

const settingsSections: Array<{ id: SettingsSectionId; label: string; icon: LucideIcon }> = [
  { id: "general", label: "通用", icon: Map },
  { id: "map", label: "地图服务", icon: KeyRound },
  { id: "storage", label: "本地数据", icon: Database },
  { id: "about", label: "关于", icon: CircleHelp },
];

export function SettingsPanel({
  settings,
  updateState,
  onClose,
  onChange,
  onError,
  onCheckForUpdates,
  onDownloadUpdate,
  onRestartToInstallUpdate,
  onOpenDownloadPage,
}: SettingsPanelProps) {
  const citySelectRef = useRef<HTMLSelectElement>(null);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>("general");
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

  async function saveAutoUpdatePreference(autoUpdateCheckOnStartup: boolean) {
    setIsAutoUpdateSaving(true);
    try {
      const nextSettings = await updateAutoUpdateCheckOnStartup(autoUpdateCheckOnStartup, settings);
      onChange(nextSettings);
    } catch (error) {
      onError(error);
    } finally {
      setIsAutoUpdateSaving(false);
    }
  }

  return (
    <div className="flex h-[min(660px,calc(100vh-64px))] w-[min(920px,calc(100vw-64px))] overflow-hidden rounded-lg border border-border bg-white shadow-2xl">
      <aside className="flex w-48 shrink-0 flex-col border-r border-border bg-slate-50">
        <div className="border-b border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">MapX</p>
          <h2 id="settings-dialog-title" className="mt-1 text-base font-semibold">
            设置
          </h2>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-3" aria-label="设置分类">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;

            return (
              <Button
                key={section.id}
                type="button"
                variant={isActive ? "secondary" : "ghost"}
                className="justify-start"
                onClick={() => setActiveSection(section.id)}
              >
                <Icon />
                <span className="min-w-0 flex-1 text-left">{section.label}</span>
              </Button>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 text-xs leading-5 text-muted-foreground">
          <p>默认城市：{settings.defaultCity}</p>
          <p>百度 AK：{settings.baiduAk ? "已配置" : "未配置"}</p>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
          <h3 className="text-sm font-semibold">{settingsSections.find((section) => section.id === activeSection)?.label}</h3>
          <Button type="button" size="icon" variant="ghost" aria-label="关闭设置" onClick={onClose}>
            <X />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {activeSection === "general" ? (
            <div className="space-y-4">
              <section className="rounded-lg border border-border p-4">
                <div className="mb-4 grid grid-cols-3 gap-3 text-sm">
                  <SummaryItem label="默认城市" value={settings.defaultCity} />
                  <SummaryItem label="地图服务" value={settings.baiduAk ? "已配置" : "未配置"} />
                  <SummaryItem label="最近备份" value={backupInfo?.latestBackupAt ?? "暂无备份"} />
                </div>
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
                  <p>
                    城市中心：{currentCity.centerLng.toFixed(4)}, {currentCity.centerLat.toFixed(4)}
                  </p>
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
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">运行信息</h3>
                  <Info className="size-4 text-muted-foreground" />
                </div>
                <dl className="grid grid-cols-2 gap-3 text-xs leading-5 text-muted-foreground">
                  <div className="min-w-0 rounded-md bg-slate-50 p-3">
                    <dt className="font-medium text-foreground">当前来源</dt>
                    <dd className="mt-1 break-all">{originGuidance.currentOrigin}</dd>
                  </div>
                  <div className="min-w-0 rounded-md bg-slate-50 p-3">
                    <dt className="font-medium text-foreground">应用版本</dt>
                    <dd className="mt-1">{appInfo?.version ?? "正在读取"}</dd>
                  </div>
                  <div className="min-w-0 rounded-md bg-slate-50 p-3">
                    <dt className="font-medium text-foreground">数据目录</dt>
                    <dd className="mt-1 break-all">{appInfo?.dataDirectory ?? "正在读取"}</dd>
                  </div>
                  <div className="min-w-0 rounded-md bg-slate-50 p-3">
                    <dt className="font-medium text-foreground">备份目录</dt>
                    <dd className="mt-1 break-all">{backupInfo?.backupDirectory ?? "正在读取"}</dd>
                  </div>
                </dl>
              </section>
            </div>
          ) : null}

          {activeSection === "map" ? (
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
          ) : null}

          {activeSection === "storage" ? (
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
                <Button type="button" variant="outline" size="sm" disabled={isOpeningLogDirectory} onClick={openLogDir}>
                  <FolderOpen />
                  打开日志目录
                </Button>
                <Button type="button" size="sm" disabled={isOpeningDataDirectory || !appInfo} onClick={openDataDir}>
                  <FolderOpen />
                  打开数据目录
                </Button>
              </div>
            </section>
          ) : null}

          {activeSection === "about" ? (
            <div className="space-y-4">
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
              </section>

              <UpdateSettingsSection
                state={updateState}
                isAutoUpdateEnabled={settings.autoUpdateCheckOnStartup}
                isAutoUpdateSaving={isAutoUpdateSaving}
                onAutoUpdateChange={saveAutoUpdatePreference}
                onCheckForUpdates={onCheckForUpdates}
                onDownloadUpdate={onDownloadUpdate}
                onRestartToInstallUpdate={onRestartToInstallUpdate}
                onOpenDownloadPage={onOpenDownloadPage}
              />
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function UpdateSettingsSection({
  state,
  isAutoUpdateEnabled,
  isAutoUpdateSaving,
  onAutoUpdateChange,
  onCheckForUpdates,
  onDownloadUpdate,
  onRestartToInstallUpdate,
  onOpenDownloadPage,
}: {
  state: AppUpdateState;
  isAutoUpdateEnabled: boolean;
  isAutoUpdateSaving: boolean;
  onAutoUpdateChange: (isEnabled: boolean) => void;
  onCheckForUpdates: () => void;
  onDownloadUpdate: () => void;
  onRestartToInstallUpdate: () => void;
  onOpenDownloadPage: () => void;
}) {
  const viewModel = buildUpdateStatusViewModel(state);
  const isChecking = state.status === "checking";
  const isDownloading = state.status === "downloading";
  const canDownload = state.status === "available";
  const canRestart = state.status === "waiting-for-restart";

  return (
    <section className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">应用更新</h3>
          <p className="mt-1 text-xs text-muted-foreground">检查 stable GitHub Release，并在确认后安装。</p>
        </div>
        <Download className="size-4 shrink-0 text-muted-foreground" />
      </div>

      <label className="flex items-center justify-between gap-3 rounded-md bg-slate-50 p-3 text-sm">
        <span>
          <span className="block font-medium">启动时自动检查更新</span>
          <span className="mt-1 block text-xs text-muted-foreground">失败时只记录状态，不会打断主界面。</span>
        </span>
        <input
          type="checkbox"
          className="size-4"
          checked={isAutoUpdateEnabled}
          disabled={isAutoUpdateSaving}
          onChange={(event) => onAutoUpdateChange(event.currentTarget.checked)}
        />
      </label>

      <div className={`mt-3 rounded-md p-3 text-xs leading-5 ${updateToneClassName(viewModel.tone)}`}>
        <p className="font-medium">{viewModel.title}</p>
        <p className="mt-1">{viewModel.detail}</p>
        {state.status === "available" ? <p className="mt-1">当前版本：{state.update.currentVersion}</p> : null}
        {state.status === "downloading" && state.progress?.percent !== null ? (
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/70">
            <div className="h-full rounded-full bg-primary" style={{ width: `${state.progress.percent}%` }} />
          </div>
        ) : null}
      </div>

      {shouldShowManualUpdateError(state) ? <p className="mt-2 text-xs leading-5 text-red-600">{state.error.message}</p> : null}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onOpenDownloadPage}>
          <ExternalLink />
          下载页面
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={isChecking || isDownloading} onClick={onCheckForUpdates}>
          <RefreshCw />
          {isChecking ? "检查中" : "检查更新"}
        </Button>
        {canDownload ? (
          <Button type="button" size="sm" onClick={onDownloadUpdate}>
            <Download />
            立即更新
          </Button>
        ) : null}
        {canRestart ? (
          <Button type="button" size="sm" onClick={onRestartToInstallUpdate}>
            <Check />
            重启安装
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function updateToneClassName(tone: string) {
  switch (tone) {
    case "success":
      return "bg-emerald-50 text-emerald-800";
    case "danger":
      return "bg-red-50 text-red-700";
    case "info":
      return "bg-primary/5 text-primary";
    default:
      return "bg-slate-50 text-muted-foreground";
  }
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}
