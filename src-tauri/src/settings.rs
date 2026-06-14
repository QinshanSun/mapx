use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::{db::AppRuntimeState, errors::AppError};

const DEFAULT_CITY: &str = "上海";
const KEY_FIRST_LAUNCH_COMPLETED: &str = "first_launch_completed";
const KEY_DEFAULT_CITY: &str = "default_city";
const KEY_BAIDU_AK: &str = "baidu_ak";
const SUPPORTED_CITY_NAMES: &[&str] = &[
    "上海",
    "北京",
    "深圳",
    "广州",
    "杭州",
    "成都",
    "重庆",
    "武汉",
    "南京",
    "西安",
    "苏州",
    "天津",
    "青岛",
    "宁波",
    "厦门",
    "福州",
    "长沙",
    "郑州",
    "济南",
    "合肥",
    "昆明",
    "南宁",
    "贵阳",
    "南昌",
    "太原",
    "石家庄",
    "沈阳",
    "大连",
    "长春",
    "哈尔滨",
    "呼和浩特",
    "兰州",
    "西宁",
    "银川",
    "乌鲁木齐",
    "海口",
    "三亚",
    "拉萨",
    "无锡",
    "佛山",
    "东莞",
    "珠海",
    "惠州",
    "中山",
    "温州",
    "泉州",
    "烟台",
    "洛阳",
    "南通",
];

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FirstLaunchSettings {
    pub completed: bool,
    pub default_city: String,
    pub baidu_ak: Option<String>,
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
    let default_city = validate_default_city(&request.default_city)?;

    upsert_app_setting(&pool, KEY_DEFAULT_CITY, Some(default_city.as_str())).await?;

    load_first_launch_settings(&pool).await
}

async fn save_first_launch_settings(
    pool: &SqlitePool,
    request: CompleteFirstLaunchRequest,
) -> Result<FirstLaunchSettings, AppError> {
    let default_city = validate_default_city(&request.default_city)?;
    let baidu_ak = request
        .baidu_ak
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string);

    upsert_app_setting(&pool, KEY_DEFAULT_CITY, Some(default_city.as_str())).await?;
    upsert_app_setting(&pool, KEY_BAIDU_AK, baidu_ak.as_deref()).await?;
    upsert_app_setting(&pool, KEY_FIRST_LAUNCH_COMPLETED, Some("true")).await?;

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

fn validate_default_city(default_city: &str) -> Result<String, AppError> {
    let trimmed = default_city.trim();

    if trimmed.is_empty() {
        return Err(AppError::validation("默认城市不能为空。"));
    }

    if !SUPPORTED_CITY_NAMES.contains(&trimmed) {
        return Err(AppError::validation("默认城市不在支持列表中。"));
    }

    Ok(trimmed.to_string())
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

    #[test]
    fn default_city_cannot_be_empty() {
        let error = validate_default_city("  ").expect_err("empty city should fail");

        assert_eq!(error.message, "默认城市不能为空。");
    }

    #[test]
    fn default_city_must_be_supported() {
        let error = validate_default_city("浦东新区").expect_err("unsupported city should fail");

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
