export interface FirstLaunchSettings {
  completed: boolean;
  defaultCity: string;
  baiduAk: string | null;
}

export interface FirstLaunchFormValues {
  defaultCity: string;
  baiduAk: string;
}

export interface CompleteFirstLaunchInput {
  defaultCity: string;
  baiduAk: string | null;
}
