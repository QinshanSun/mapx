use std::{fs, path::PathBuf, process::Command};

use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};
use tauri::Manager;

use crate::{
    backup::{self, BackupInfo},
    cities::{validate_city_name, DEFAULT_CITY},
    db::AppRuntimeState,
    errors::AppError,
    projects,
};

const KEY_FIRST_LAUNCH_COMPLETED: &str = "first_launch_completed";
const KEY_DEFAULT_CITY: &str = "default_city";
const KEY_BAIDU_AK: &str = "baidu_ak";

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FirstLaunchSettings {
    pub completed: bool,
    pub default_city: String,
    pub baidu_ak: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub app_name: String,
    pub version: String,
    pub data_directory: String,
    pub database_path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteFirstLaunchRequest {
    pub default_city: String,
    pub baidu_ak: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDefaultCityRequest {
    pub default_city: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBaiduAkRequest {
    pub baidu_ak: Option<String>,
}

#[tauri::command]
pub async fn get_first_launch_settings(
    state: tauri::State<'_, AppRuntimeState>,
) -> Result<FirstLaunchSettings, AppError> {
    let pool = require_pool(&state)?;

    load_first_launch_settings(&pool).await
}

#[tauri::command]
pub async fn complete_first_launch(
    state: tauri::State<'_, AppRuntimeState>,
    request: CompleteFirstLaunchRequest,
) -> Result<FirstLaunchSettings, AppError> {
    let pool = require_pool(&state)?;

    save_first_launch_settings(&pool, request).await
}

#[tauri::command]
pub async fn update_default_city(
    state: tauri::State<'_, AppRuntimeState>,
    request: UpdateDefaultCityRequest,
) -> Result<FirstLaunchSettings, AppError> {
    let pool = require_pool(&state)?;
    let default_city = validate_city_name(&request.default_city)?;

    upsert_app_setting(&pool, KEY_DEFAULT_CITY, Some(default_city.as_str())).await?;

    load_first_launch_settings(&pool).await
}

#[tauri::command]
pub async fn update_baidu_ak(
    state: tauri::State<'_, AppRuntimeState>,
    request: UpdateBaiduAkRequest,
) -> Result<FirstLaunchSettings, AppError> {
    let pool = require_pool(&state)?;
    let baidu_ak = normalize_baidu_ak(request.baidu_ak.as_deref());

    upsert_app_setting(&pool, KEY_BAIDU_AK, baidu_ak.as_deref()).await?;

    load_first_launch_settings(&pool).await
}

#[tauri::command]
pub fn get_app_info(state: tauri::State<'_, AppRuntimeState>) -> Result<AppInfo, AppError> {
    let database_path = database_path_from_state(&state)?;
    let data_directory = data_directory_from_database_path(&database_path)?;

    Ok(AppInfo {
        app_name: "MapX".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        data_directory: data_directory.display().to_string(),
        database_path,
    })
}

#[tauri::command]
pub async fn get_backup_info(
    state: tauri::State<'_, AppRuntimeState>,
) -> Result<BackupInfo, AppError> {
    let pool = require_pool(&state)?;
    let database_path = PathBuf::from(database_path_from_state(&state)?);

    backup::load_backup_info(&pool, database_path)
        .await
        .map_err(|_| AppError::db())
}

#[tauri::command]
pub fn open_data_directory(state: tauri::State<'_, AppRuntimeState>) -> Result<(), AppError> {
    let database_path = database_path_from_state(&state)?;
    let data_directory = data_directory_from_database_path(&database_path)?;

    open_path(&data_directory)
}

#[tauri::command]
pub fn open_backup_directory(state: tauri::State<'_, AppRuntimeState>) -> Result<(), AppError> {
    let database_path = PathBuf::from(database_path_from_state(&state)?);
    let backup_directory =
        backup::backup_directory_from_database_path(&database_path).map_err(|_| AppError::db())?;

    fs::create_dir_all(&backup_directory).map_err(|_| AppError::db())?;
    open_path(&backup_directory)
}

#[tauri::command]
pub fn open_log_directory(app: tauri::AppHandle) -> Result<(), AppError> {
    let log_directory = app.path().app_log_dir().map_err(|_| AppError::db())?;

    fs::create_dir_all(&log_directory).map_err(|_| AppError::db())?;
    open_path(&log_directory)
}

async fn save_first_launch_settings(
    pool: &SqlitePool,
    request: CompleteFirstLaunchRequest,
) -> Result<FirstLaunchSettings, AppError> {
    let default_city = validate_city_name(&request.default_city)?;
    let baidu_ak = request
        .baidu_ak
        .as_deref()
        .and_then(|value| normalize_baidu_ak(Some(value)));

    upsert_app_setting(&pool, KEY_DEFAULT_CITY, Some(default_city.as_str())).await?;
    upsert_app_setting(&pool, KEY_BAIDU_AK, baidu_ak.as_deref()).await?;
    upsert_app_setting(&pool, KEY_FIRST_LAUNCH_COMPLETED, Some("true")).await?;
    projects::ensure_default_project(&pool, &default_city).await?;

    Ok(FirstLaunchSettings {
        completed: true,
        default_city,
        baidu_ak,
    })
}

async fn load_first_launch_settings(pool: &SqlitePool) -> Result<FirstLaunchSettings, AppError> {
    let rows = sqlx::query(
        "SELECT key, value
         FROM app_settings
         WHERE deleted_at IS NULL
           AND key IN (?, ?, ?)",
    )
    .bind(KEY_FIRST_LAUNCH_COMPLETED)
    .bind(KEY_DEFAULT_CITY)
    .bind(KEY_BAIDU_AK)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    let mut completed = false;
    let mut default_city = DEFAULT_CITY.to_string();
    let mut baidu_ak = None;

    for row in rows {
        let key = row.try_get::<String, _>("key").map_err(AppError::from)?;
        let value = row
            .try_get::<Option<String>, _>("value")
            .map_err(AppError::from)?;

        match (key.as_str(), value) {
            (KEY_FIRST_LAUNCH_COMPLETED, Some(value)) => completed = value == "true",
            (KEY_DEFAULT_CITY, Some(value)) if !value.trim().is_empty() => default_city = value,
            (KEY_BAIDU_AK, Some(value)) if !value.trim().is_empty() => baidu_ak = Some(value),
            _ => {}
        }
    }

    Ok(FirstLaunchSettings {
        completed,
        default_city,
        baidu_ak,
    })
}

async fn upsert_app_setting(
    pool: &SqlitePool,
    key: &str,
    value: Option<&str>,
) -> Result<(), AppError> {
    sqlx::query(
        "INSERT INTO app_settings (id, key, value, created_at, updated_at, deleted_at)
         VALUES (
           lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
           ?,
           ?,
           datetime('now'),
           datetime('now'),
           NULL
         )
         ON CONFLICT(key) WHERE deleted_at IS NULL DO UPDATE SET
           value = excluded.value,
           updated_at = excluded.updated_at",
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

fn normalize_baidu_ak(baidu_ak: Option<&str>) -> Option<String> {
    baidu_ak
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn database_path_from_state(state: &AppRuntimeState) -> Result<String, AppError> {
    state
        .bootstrap_status
        .database_path
        .clone()
        .ok_or_else(AppError::db)
}

fn data_directory_from_database_path(database_path: &str) -> Result<PathBuf, AppError> {
    PathBuf::from(database_path)
        .parent()
        .map(PathBuf::from)
        .ok_or_else(AppError::db)
}

fn open_path(path: &PathBuf) -> Result<(), AppError> {
    let mut command = if cfg!(target_os = "macos") {
        let mut command = Command::new("open");
        command.arg(path);
        command
    } else if cfg!(target_os = "windows") {
        let mut command = Command::new("explorer");
        command.arg(path);
        command
    } else {
        let mut command = Command::new("xdg-open");
        command.arg(path);
        command
    };

    command.spawn().map_err(|_| AppError::db())?;
    Ok(())
}

fn require_pool(state: &AppRuntimeState) -> Result<SqlitePool, AppError> {
    state.pool.clone().ok_or_else(AppError::db)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::bootstrap_database_in;

    #[tokio::test]
    async fn first_launch_settings_default_to_shanghai_before_completion() {
        let (_temp_dir, pool) = create_test_pool().await;

        let settings = load_first_launch_settings(&pool)
            .await
            .expect("settings should load");

        assert_eq!(
            settings,
            FirstLaunchSettings {
                completed: false,
                default_city: "上海".to_string(),
                baidu_ak: None,
            }
        );
    }

    #[tokio::test]
    async fn complete_first_launch_allows_skipping_baidu_ak() {
        let (_temp_dir, pool) = create_test_pool().await;

        save_first_launch_settings(
            &pool,
            CompleteFirstLaunchRequest {
                default_city: " 上海 ".to_string(),
                baidu_ak: None,
            },
        )
        .await
        .expect("first launch save should succeed");

        let settings = load_first_launch_settings(&pool)
            .await
            .expect("settings should load");

        assert_eq!(settings.default_city, "上海");
        assert_eq!(settings.baidu_ak, None);
        assert!(settings.completed);
    }

    #[tokio::test]
    async fn complete_first_launch_creates_default_project() {
        let (_temp_dir, pool) = create_test_pool().await;

        save_first_launch_settings(
            &pool,
            CompleteFirstLaunchRequest {
                default_city: "杭州".to_string(),
                baidu_ak: None,
            },
        )
        .await
        .expect("first launch save should succeed");

        let project_name: String =
            sqlx::query_scalar("SELECT name FROM projects WHERE deleted_at IS NULL LIMIT 1")
                .fetch_one(&pool)
                .await
                .expect("default project should exist");
        let settings = sqlx::query(
            "SELECT search_city, map_layer, map_center_lng, map_center_lat, map_zoom
             FROM project_settings
             WHERE deleted_at IS NULL
             LIMIT 1",
        )
        .fetch_one(&pool)
        .await
        .expect("default project settings should exist");

        assert_eq!(project_name, "我的项目");
        assert_eq!(
            settings.try_get::<String, _>("search_city").unwrap(),
            "杭州"
        );
        assert_eq!(
            settings.try_get::<String, _>("map_layer").unwrap(),
            "normal"
        );
        assert_eq!(
            settings.try_get::<f64, _>("map_center_lng").unwrap(),
            120.1551
        );
        assert_eq!(
            settings.try_get::<f64, _>("map_center_lat").unwrap(),
            30.2741
        );
        assert_eq!(settings.try_get::<f64, _>("map_zoom").unwrap(), 12.0);
    }

    #[tokio::test]
    async fn baidu_ak_can_be_saved_modified_and_cleared() {
        let (_temp_dir, pool) = create_test_pool().await;

        upsert_app_setting(
            &pool,
            KEY_BAIDU_AK,
            normalize_baidu_ak(Some(" first-ak ")).as_deref(),
        )
        .await
        .expect("first ak save should succeed");
        assert_eq!(
            load_first_launch_settings(&pool)
                .await
                .expect("settings should load")
                .baidu_ak,
            Some("first-ak".to_string())
        );

        upsert_app_setting(
            &pool,
            KEY_BAIDU_AK,
            normalize_baidu_ak(Some(" second-ak ")).as_deref(),
        )
        .await
        .expect("second ak save should succeed");
        assert_eq!(
            load_first_launch_settings(&pool)
                .await
                .expect("settings should load")
                .baidu_ak,
            Some("second-ak".to_string())
        );

        upsert_app_setting(
            &pool,
            KEY_BAIDU_AK,
            normalize_baidu_ak(Some("   ")).as_deref(),
        )
        .await
        .expect("ak clear should succeed");
        assert_eq!(
            load_first_launch_settings(&pool)
                .await
                .expect("settings should load")
                .baidu_ak,
            None
        );
    }

    #[test]
    fn app_info_paths_derive_data_directory_from_database_path() {
        let database_path = "/tmp/MapX/mapx.sqlite";
        let data_directory = data_directory_from_database_path(database_path)
            .expect("data directory should derive from db path");

        assert!(data_directory.ends_with("MapX"));
    }

    #[test]
    fn default_city_cannot_be_empty() {
        let error = validate_city_name("  ").expect_err("empty city should fail");

        assert_eq!(error.message, "默认城市不能为空。");
    }

    #[test]
    fn default_city_must_be_supported() {
        let error = validate_city_name("浦东新区").expect_err("unsupported city should fail");

        assert_eq!(error.message, "默认城市不在支持列表中。");
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }
}
