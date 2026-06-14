import { isTauri } from "@tauri-apps/api/core";

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

export function buildCompleteFirstLaunchInput(
  values: FirstLaunchFormValues,
  options: { skipBaiduAk?: boolean } = {},
): CompleteFirstLaunchInput {
  const defaultCity = values.defaultCity.trim() || DEFAULT_CITY;
  const baiduAk = options.skipBaiduAk ? null : values.baiduAk.trim() || null;

  return {
    defaultCity,
    baiduAk,
  };
}
