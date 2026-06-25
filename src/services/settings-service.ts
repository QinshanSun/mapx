import { isTauri } from "@tauri-apps/api/core";

import { normalizeCityName } from "@/data/china-cities";
import { callCommand } from "@/services/tauri-client";
import type {
  AppInfo,
  BackupInfo,
  CompleteFirstLaunchInput,
  FirstLaunchFormValues,
  FirstLaunchSettings,
  UpdateBaiduAkInput,
} from "@/types/settings";

export const DEFAULT_CITY = "上海";

export function getFirstLaunchSettings() {
  if (!isTauri()) {
    return Promise.resolve<FirstLaunchSettings>({
      completed: true,
      defaultCity: DEFAULT_CITY,
      baiduAk: null,
      autoUpdateCheckOnStartup: true,
    });
  }

  return callCommand<FirstLaunchSettings>("get_first_launch_settings");
}

export function completeFirstLaunch(input: CompleteFirstLaunchInput) {
  if (!isTauri()) {
    return Promise.resolve<FirstLaunchSettings>({
      completed: true,
      defaultCity: input.defaultCity,
      baiduAk: input.baiduAk,
      autoUpdateCheckOnStartup: true,
    });
  }

  return callCommand<FirstLaunchSettings>("complete_first_launch", { request: input });
}

export function updateDefaultCity(defaultCity: string, currentSettings: FirstLaunchSettings) {
  const input = { defaultCity: normalizeCityName(defaultCity) };

  if (!isTauri()) {
    return Promise.resolve<FirstLaunchSettings>({
      ...currentSettings,
      defaultCity: input.defaultCity,
    });
  }

  return callCommand<FirstLaunchSettings>("update_default_city", { request: input });
}

export function updateBaiduAk(baiduAk: string | null, currentSettings: FirstLaunchSettings) {
  const input = buildUpdateBaiduAkInput(baiduAk ?? "");

  if (!isTauri()) {
    return Promise.resolve<FirstLaunchSettings>({
      ...currentSettings,
      baiduAk: input.baiduAk,
    });
  }

  return callCommand<FirstLaunchSettings>("update_baidu_ak", { request: input });
}

export function updateAutoUpdateCheckOnStartup(enabled: boolean, currentSettings: FirstLaunchSettings) {
  const input = buildUpdateAutoUpdateCheckOnStartupInput(enabled);

  if (!isTauri()) {
    return Promise.resolve<FirstLaunchSettings>({
      ...currentSettings,
      autoUpdateCheckOnStartup: enabled,
    });
  }

  return callCommand<FirstLaunchSettings>("update_auto_update_check_on_startup", { request: input });
}

export function buildUpdateAutoUpdateCheckOnStartupInput(enabled: boolean) {
  return { enabled };
}

export function getAppInfo() {
  if (!isTauri()) {
    return Promise.resolve<AppInfo>({
      appName: "MapX",
      version: "0.1.0",
      dataDirectory: "浏览器预览模式",
      databasePath: "浏览器预览模式",
    });
  }

  return callCommand<AppInfo>("get_app_info");
}

export function getBackupInfo() {
  if (!isTauri()) {
    return Promise.resolve<BackupInfo>({
      backupDirectory: "浏览器预览模式",
      latestBackupAt: null,
      latestBackupPath: null,
    });
  }

  return callCommand<BackupInfo>("get_backup_info");
}

export function openDataDirectory() {
  if (!isTauri()) {
    return Promise.resolve<void>(undefined);
  }

  return callCommand<void>("open_data_directory");
}

export function openBackupDirectory() {
  if (!isTauri()) {
    return Promise.resolve<void>(undefined);
  }

  return callCommand<void>("open_backup_directory");
}

export function openLogDirectory() {
  if (!isTauri()) {
    return Promise.resolve<void>(undefined);
  }

  return callCommand<void>("open_log_directory");
}

export function buildCompleteFirstLaunchInput(
  values: FirstLaunchFormValues,
  options: { skipBaiduAk?: boolean } = {},
): CompleteFirstLaunchInput {
  const defaultCity = normalizeCityName(values.defaultCity, DEFAULT_CITY);
  const baiduAk = options.skipBaiduAk ? null : values.baiduAk.trim() || null;

  return {
    defaultCity,
    baiduAk,
  };
}

export function buildUpdateBaiduAkInput(baiduAk: string): UpdateBaiduAkInput {
  const trimmed = baiduAk.trim();

  return {
    baiduAk: trimmed || null,
  };
}
