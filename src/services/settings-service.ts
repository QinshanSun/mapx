import { isTauri } from "@tauri-apps/api/core";

import { normalizeCityName } from "@/data/china-cities";
import { callCommand } from "@/services/tauri-client";
import type { CompleteFirstLaunchInput, FirstLaunchFormValues, FirstLaunchSettings } from "@/types/settings";

export const DEFAULT_CITY = "上海";

export function getFirstLaunchSettings() {
  if (!isTauri()) {
    return Promise.resolve<FirstLaunchSettings>({
      completed: true,
      defaultCity: DEFAULT_CITY,
      baiduAk: null,
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
