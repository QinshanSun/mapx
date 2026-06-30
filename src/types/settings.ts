export interface FirstLaunchSettings {
  completed: boolean;
  defaultCity: string;
  baiduAk: string | null;
  autoUpdateCheckOnStartup: boolean;
}

export interface AppInfo {
  appName: string;
  version: string;
  dataDirectory: string;
  databasePath: string;
}

export interface BackupInfo {
  backupDirectory: string;
  latestBackupAt: string | null;
  latestBackupPath: string | null;
}

export interface FirstLaunchFormValues {
  defaultCity: string;
  baiduAk: string;
}

export interface CompleteFirstLaunchInput {
  defaultCity: string;
  baiduAk: string | null;
}

export interface UpdateBaiduAkInput {
  baiduAk: string | null;
}
