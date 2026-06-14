use serde::Serialize;
use sqlx::{Row, SqlitePool};

use crate::{
    cities::{city_center_for, default_city_center, validate_city_name, DEFAULT_CITY},
    db::AppRuntimeState,
    errors::AppError,
};

const DEFAULT_PROJECT_NAME: &str = "我的项目";
const DEFAULT_MAP_LAYER: &str = "normal";
const DEFAULT_MAP_ZOOM: f64 = 12.0;
const KEY_DEFAULT_CITY: &str = "default_city";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    pub id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMapSettings {
    pub search_city: String,
    pub map_layer: String,
    pub map_center_lng: f64,
    pub map_center_lat: f64,
    pub map_zoom: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectWorkspace {
    pub projects: Vec<ProjectSummary>,
    pub current_project: ProjectSummary,
    pub settings: ProjectMapSettings,
}

#[tauri::command]
pub async fn get_project_workspace(
    state: tauri::State<'_, AppRuntimeState>,
) -> Result<ProjectWorkspace, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;
    let default_city = load_default_city(&pool).await?;

    load_project_workspace(&pool, &default_city).await
}

pub async fn ensure_default_project(pool: &SqlitePool, default_city: &str) -> Result<(), AppError> {
    let default_city = validate_city_name(default_city)?;

    if load_first_active_project(pool).await?.is_none() {
        insert_default_project(pool, &default_city).await?;
        return Ok(());
    }

    ensure_settings_for_first_project(pool, &default_city).await
}

async fn load_project_workspace(
    pool: &SqlitePool,
    default_city: &str,
) -> Result<ProjectWorkspace, AppError> {
    ensure_default_project(pool, default_city).await?;

    let projects = load_active_projects(pool).await?;
    let current_project = projects
        .first()
        .cloned()
        .ok_or_else(AppError::project_not_found)?;
    let settings = load_project_settings(pool, &current_project.id).await?;

    Ok(ProjectWorkspace {
        projects,
        current_project,
        settings,
    })
}

async fn load_default_city(pool: &SqlitePool) -> Result<String, AppError> {
    let default_city = sqlx::query_scalar::<_, Option<String>>(
        "SELECT value
         FROM app_settings
         WHERE key = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(KEY_DEFAULT_CITY)
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?
    .flatten()
    .unwrap_or_else(|| DEFAULT_CITY.to_string());

    validate_city_name(&default_city)
}

async fn load_first_active_project(pool: &SqlitePool) -> Result<Option<ProjectSummary>, AppError> {
    let row = sqlx::query(
        "SELECT id, name, created_at, updated_at
         FROM projects
         WHERE deleted_at IS NULL
         ORDER BY created_at ASC, name ASC
         LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?;

    row.map(project_from_row).transpose()
}

async fn load_active_projects(pool: &SqlitePool) -> Result<Vec<ProjectSummary>, AppError> {
    let rows = sqlx::query(
        "SELECT id, name, created_at, updated_at
         FROM projects
         WHERE deleted_at IS NULL
         ORDER BY created_at ASC, name ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    rows.into_iter().map(project_from_row).collect()
}

async fn insert_default_project(pool: &SqlitePool, default_city: &str) -> Result<(), AppError> {
    let project_id = new_sqlite_uuid(pool).await?;
    let settings_id = new_sqlite_uuid(pool).await?;
    let center = city_center_for(default_city).unwrap_or_else(default_city_center);

    sqlx::query(
        "INSERT INTO projects (id, name, created_at, updated_at, deleted_at)
         VALUES (?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(&project_id)
    .bind(DEFAULT_PROJECT_NAME)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    sqlx::query(
        "INSERT INTO project_settings (
           id, project_id, search_city, map_layer, map_center_lng, map_center_lat, map_zoom,
           created_at, updated_at, deleted_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(settings_id)
    .bind(project_id)
    .bind(default_city)
    .bind(DEFAULT_MAP_LAYER)
    .bind(center.lng)
    .bind(center.lat)
    .bind(DEFAULT_MAP_ZOOM)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

async fn ensure_settings_for_first_project(
    pool: &SqlitePool,
    default_city: &str,
) -> Result<(), AppError> {
    let project = load_first_active_project(pool)
        .await?
        .ok_or_else(AppError::project_not_found)?;

    let existing_settings: Option<String> = sqlx::query_scalar(
        "SELECT id
         FROM project_settings
         WHERE project_id = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(&project.id)
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?;

    if existing_settings.is_some() {
        return Ok(());
    }

    let settings_id = new_sqlite_uuid(pool).await?;
    let center = city_center_for(default_city).unwrap_or_else(default_city_center);

    sqlx::query(
        "INSERT INTO project_settings (
           id, project_id, search_city, map_layer, map_center_lng, map_center_lat, map_zoom,
           created_at, updated_at, deleted_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(settings_id)
    .bind(project.id)
    .bind(default_city)
    .bind(DEFAULT_MAP_LAYER)
    .bind(center.lng)
    .bind(center.lat)
    .bind(DEFAULT_MAP_ZOOM)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

async fn load_project_settings(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<ProjectMapSettings, AppError> {
    let row = sqlx::query(
        "SELECT search_city, map_layer, map_center_lng, map_center_lat, map_zoom
         FROM project_settings
         WHERE project_id = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)?;

    let search_city = row
        .try_get::<String, _>("search_city")
        .map_err(AppError::from)?;
    let center = city_center_for(&search_city).unwrap_or_else(default_city_center);

    Ok(ProjectMapSettings {
        search_city,
        map_layer: row
            .try_get::<String, _>("map_layer")
            .map_err(AppError::from)?,
        map_center_lng: row
            .try_get::<Option<f64>, _>("map_center_lng")
            .map_err(AppError::from)?
            .unwrap_or(center.lng),
        map_center_lat: row
            .try_get::<Option<f64>, _>("map_center_lat")
            .map_err(AppError::from)?
            .unwrap_or(center.lat),
        map_zoom: row
            .try_get::<Option<f64>, _>("map_zoom")
            .map_err(AppError::from)?
            .unwrap_or(DEFAULT_MAP_ZOOM),
    })
}

async fn new_sqlite_uuid(pool: &SqlitePool) -> Result<String, AppError> {
    sqlx::query_scalar(
        "SELECT lower(hex(randomblob(4))) || '-' ||
                lower(hex(randomblob(2))) || '-' ||
                lower(hex(randomblob(2))) || '-' ||
                lower(hex(randomblob(2))) || '-' ||
                lower(hex(randomblob(6)))",
    )
    .fetch_one(pool)
    .await
    .map_err(AppError::from)
}

fn project_from_row(row: sqlx::sqlite::SqliteRow) -> Result<ProjectSummary, AppError> {
    Ok(ProjectSummary {
        id: row.try_get::<String, _>("id").map_err(AppError::from)?,
        name: row.try_get::<String, _>("name").map_err(AppError::from)?,
        created_at: row
            .try_get::<String, _>("created_at")
            .map_err(AppError::from)?,
        updated_at: row
            .try_get::<String, _>("updated_at")
            .map_err(AppError::from)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::bootstrap_database_in;

    #[tokio::test]
    async fn creates_default_project_with_city_based_settings() {
        let (_temp_dir, pool) = create_test_pool().await;

        ensure_default_project(&pool, "杭州")
            .await
            .expect("default project should be created");
        let workspace = load_project_workspace(&pool, "杭州")
            .await
            .expect("workspace should load");

        assert_eq!(workspace.projects.len(), 1);
        assert_eq!(workspace.current_project.name, "我的项目");
        assert_eq!(workspace.settings.search_city, "杭州");
        assert_eq!(workspace.settings.map_layer, "normal");
        assert_eq!(workspace.settings.map_center_lng, 120.1551);
        assert_eq!(workspace.settings.map_center_lat, 30.2741);
        assert_eq!(workspace.settings.map_zoom, 12.0);
    }

    #[tokio::test]
    async fn default_project_creation_is_idempotent() {
        let (_temp_dir, pool) = create_test_pool().await;

        ensure_default_project(&pool, "上海")
            .await
            .expect("first ensure should succeed");
        ensure_default_project(&pool, "上海")
            .await
            .expect("second ensure should succeed");

        let project_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM projects WHERE deleted_at IS NULL")
                .fetch_one(&pool)
                .await
                .expect("project count should load");
        let settings_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM project_settings WHERE deleted_at IS NULL")
                .fetch_one(&pool)
                .await
                .expect("settings count should load");

        assert_eq!(project_count, 1);
        assert_eq!(settings_count, 1);
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }
}
