use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::{
    cities::{city_center_for, default_city_center, validate_city_name, DEFAULT_CITY},
    db::AppRuntimeState,
    errors::AppError,
    taxonomy::create_default_categories_for_project,
    validation::{ensure_active_project, validate_required_name},
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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectRequest {
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectProjectRequest {
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameProjectRequest {
    pub project_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftDeleteProjectRequest {
    pub project_id: String,
    pub current_project_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateProjectMapLayerRequest {
    pub project_id: String,
    pub map_layer: String,
}

#[tauri::command]
pub async fn get_project_workspace(
    state: tauri::State<'_, AppRuntimeState>,
) -> Result<ProjectWorkspace, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;
    let default_city = load_default_city(&pool).await?;

    load_project_workspace(&pool, &default_city, None).await
}

#[tauri::command]
pub async fn create_project(
    state: tauri::State<'_, AppRuntimeState>,
    request: CreateProjectRequest,
) -> Result<ProjectWorkspace, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;
    let default_city = load_default_city(&pool).await?;
    let project = insert_project_with_settings(&pool, &request.name, &default_city).await?;

    load_project_workspace(&pool, &default_city, Some(project.id.as_str())).await
}

#[tauri::command]
pub async fn select_project_workspace(
    state: tauri::State<'_, AppRuntimeState>,
    request: SelectProjectRequest,
) -> Result<ProjectWorkspace, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;
    let default_city = load_default_city(&pool).await?;

    ensure_active_project(&pool, &request.project_id).await?;
    load_project_workspace(&pool, &default_city, Some(request.project_id.as_str())).await
}

#[tauri::command]
pub async fn rename_project(
    state: tauri::State<'_, AppRuntimeState>,
    request: RenameProjectRequest,
) -> Result<ProjectWorkspace, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;
    let default_city = load_default_city(&pool).await?;

    update_project_name(&pool, &request.project_id, &request.name).await?;
    load_project_workspace(&pool, &default_city, Some(request.project_id.as_str())).await
}

#[tauri::command]
pub async fn soft_delete_project(
    state: tauri::State<'_, AppRuntimeState>,
    request: SoftDeleteProjectRequest,
) -> Result<ProjectWorkspace, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;
    let default_city = load_default_city(&pool).await?;

    delete_project(&pool, &request.project_id).await?;
    let next_project_id = request
        .current_project_id
        .as_deref()
        .filter(|current_project_id| *current_project_id != request.project_id);

    load_project_workspace(&pool, &default_city, next_project_id).await
}

#[tauri::command]
pub async fn update_project_map_layer(
    state: tauri::State<'_, AppRuntimeState>,
    request: UpdateProjectMapLayerRequest,
) -> Result<ProjectWorkspace, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;
    let default_city = load_default_city(&pool).await?;

    update_map_layer(&pool, &request.project_id, &request.map_layer).await?;
    load_project_workspace(&pool, &default_city, Some(request.project_id.as_str())).await
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
    selected_project_id: Option<&str>,
) -> Result<ProjectWorkspace, AppError> {
    ensure_default_project(pool, default_city).await?;

    let projects = load_active_projects(pool).await?;
    let current_project = selected_project_id
        .and_then(|project_id| {
            projects
                .iter()
                .find(|project| project.id == project_id)
                .cloned()
        })
        .or_else(|| projects.first().cloned())
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
    insert_project_with_settings(pool, DEFAULT_PROJECT_NAME, default_city).await?;

    Ok(())
}

async fn insert_project_with_settings(
    pool: &SqlitePool,
    name: &str,
    default_city: &str,
) -> Result<ProjectSummary, AppError> {
    let name = validate_required_name(name)?;
    let default_city = validate_city_name(default_city)?;
    let project_id = new_sqlite_uuid(pool).await?;
    let settings_id = new_sqlite_uuid(pool).await?;
    let center = city_center_for(&default_city).unwrap_or_else(default_city_center);

    sqlx::query(
        "INSERT INTO projects (id, name, created_at, updated_at, deleted_at)
         VALUES (?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(&project_id)
    .bind(name)
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
    .bind(&project_id)
    .bind(&default_city)
    .bind(DEFAULT_MAP_LAYER)
    .bind(center.lng)
    .bind(center.lat)
    .bind(DEFAULT_MAP_ZOOM)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    create_default_categories_for_project(pool, &project_id).await?;

    load_project_by_id(pool, &project_id).await
}

async fn update_project_name(
    pool: &SqlitePool,
    project_id: &str,
    name: &str,
) -> Result<ProjectSummary, AppError> {
    let name = validate_required_name(name)?;
    ensure_active_project(pool, project_id).await?;

    sqlx::query(
        "UPDATE projects
         SET name = ?,
             updated_at = datetime('now')
         WHERE id = ?
           AND deleted_at IS NULL",
    )
    .bind(name)
    .bind(project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_project_by_id(pool, project_id).await
}

async fn delete_project(pool: &SqlitePool, project_id: &str) -> Result<(), AppError> {
    ensure_active_project(pool, project_id).await?;

    sqlx::query(
        "UPDATE projects
         SET deleted_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?
           AND deleted_at IS NULL",
    )
    .bind(project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

async fn update_map_layer(
    pool: &SqlitePool,
    project_id: &str,
    map_layer: &str,
) -> Result<(), AppError> {
    let map_layer = validate_map_layer(map_layer)?;
    ensure_active_project(pool, project_id).await?;

    sqlx::query(
        "UPDATE project_settings
         SET map_layer = ?,
             updated_at = datetime('now')
         WHERE project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(map_layer)
    .bind(project_id)
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

async fn load_project_by_id(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<ProjectSummary, AppError> {
    let row = sqlx::query(
        "SELECT id, name, created_at, updated_at
         FROM projects
         WHERE id = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)?;

    project_from_row(row)
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

fn validate_map_layer(map_layer: &str) -> Result<&'static str, AppError> {
    match map_layer.trim() {
        "normal" => Ok("normal"),
        "satellite" => Ok("satellite"),
        _ => Err(AppError::validation("地图图层只能是普通地图或卫星图。")),
    }
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
        let workspace = load_project_workspace(&pool, "杭州", None)
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
        let category_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM categories WHERE deleted_at IS NULL")
                .fetch_one(&pool)
                .await
                .expect("category count should load");

        assert_eq!(project_count, 1);
        assert_eq!(settings_count, 1);
        assert_eq!(category_count, 5);
    }

    #[tokio::test]
    async fn create_project_returns_new_project_as_current() {
        let (_temp_dir, pool) = create_test_pool().await;
        ensure_default_project(&pool, "上海")
            .await
            .expect("default project should exist");

        let project = insert_project_with_settings(&pool, "  客户项目  ", "上海")
            .await
            .expect("project should be created");
        let workspace = load_project_workspace(&pool, "上海", Some(project.id.as_str()))
            .await
            .expect("workspace should load");

        assert_eq!(workspace.projects.len(), 2);
        assert_eq!(workspace.current_project.name, "客户项目");
        assert_eq!(workspace.settings.search_city, "上海");
        assert_eq!(workspace.settings.map_layer, "normal");
    }

    #[tokio::test]
    async fn new_project_receives_default_categories() {
        let (_temp_dir, pool) = create_test_pool().await;

        let project = insert_project_with_settings(&pool, "客户项目", "上海")
            .await
            .expect("project should be created");
        let rows = sqlx::query(
            "SELECT name, color, icon, sort_order
             FROM categories
             WHERE project_id = ?
               AND deleted_at IS NULL
             ORDER BY sort_order ASC",
        )
        .bind(project.id)
        .fetch_all(&pool)
        .await
        .expect("categories should load");

        let categories: Vec<(String, String, String, i64)> = rows
            .into_iter()
            .map(|row| {
                (
                    row.try_get::<String, _>("name").unwrap(),
                    row.try_get::<String, _>("color").unwrap(),
                    row.try_get::<String, _>("icon").unwrap(),
                    row.try_get::<i64, _>("sort_order").unwrap(),
                )
            })
            .collect();

        assert_eq!(
            categories,
            vec![
                (
                    "客户".to_string(),
                    "#2563eb".to_string(),
                    "Users".to_string(),
                    10
                ),
                (
                    "门店".to_string(),
                    "#16a34a".to_string(),
                    "Store".to_string(),
                    20
                ),
                (
                    "仓库".to_string(),
                    "#f59e0b".to_string(),
                    "Warehouse".to_string(),
                    30,
                ),
                (
                    "竞品".to_string(),
                    "#dc2626".to_string(),
                    "BadgeAlert".to_string(),
                    40,
                ),
                (
                    "候选点".to_string(),
                    "#7c3aed".to_string(),
                    "MapPin".to_string(),
                    50,
                ),
            ]
        );
        assert!(!categories.iter().any(|category| category.0 == "未分类"));
    }

    #[tokio::test]
    async fn project_workspace_excludes_soft_deleted_projects() {
        let (_temp_dir, pool) = create_test_pool().await;
        ensure_default_project(&pool, "上海")
            .await
            .expect("default project should exist");

        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at, deleted_at)
             VALUES ('deleted-project', '已删除项目', datetime('now'), datetime('now'), datetime('now'))",
        )
        .execute(&pool)
        .await
        .expect("soft-deleted project should insert");

        let workspace = load_project_workspace(&pool, "上海", None)
            .await
            .expect("workspace should load");

        assert_eq!(workspace.projects.len(), 1);
        assert_eq!(workspace.projects[0].name, "我的项目");
    }

    #[tokio::test]
    async fn renames_project_and_updates_timestamp() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_with_settings(&pool, "原项目", "上海")
            .await
            .expect("project should be created");
        sqlx::query(
            "UPDATE projects
             SET updated_at = '2026-01-01T00:00:00Z'
             WHERE id = (SELECT id FROM projects LIMIT 1)",
        )
        .execute(&pool)
        .await
        .expect("project timestamp should update");
        let project_id: String = sqlx::query_scalar("SELECT id FROM projects LIMIT 1")
            .fetch_one(&pool)
            .await
            .expect("project id should load");

        let renamed = update_project_name(&pool, &project_id, "  新项目  ")
            .await
            .expect("project should rename");

        assert_eq!(renamed.name, "新项目");
        assert_ne!(renamed.updated_at, "2026-01-01T00:00:00Z");
    }

    #[tokio::test]
    async fn rename_project_rejects_empty_name() {
        let (_temp_dir, pool) = create_test_pool().await;
        let project = insert_project_with_settings(&pool, "原项目", "上海")
            .await
            .expect("project should be created");

        let error = update_project_name(&pool, &project.id, "   ")
            .await
            .expect_err("empty project name should fail");

        assert_eq!(error.message, "名称不能为空。");
    }

    #[tokio::test]
    async fn updates_project_map_layer_per_project() {
        let (_temp_dir, pool) = create_test_pool().await;
        let first_project = insert_project_with_settings(&pool, "项目一", "上海")
            .await
            .expect("first project should be created");
        let second_project = insert_project_with_settings(&pool, "项目二", "上海")
            .await
            .expect("second project should be created");

        update_map_layer(&pool, &first_project.id, "satellite")
            .await
            .expect("map layer should update");

        let first_workspace =
            load_project_workspace(&pool, "上海", Some(first_project.id.as_str()))
                .await
                .expect("first workspace should load");
        let second_workspace =
            load_project_workspace(&pool, "上海", Some(second_project.id.as_str()))
                .await
                .expect("second workspace should load");

        assert_eq!(first_workspace.settings.map_layer, "satellite");
        assert_eq!(second_workspace.settings.map_layer, "normal");
    }

    #[tokio::test]
    async fn map_layer_rejects_traffic_layer() {
        let (_temp_dir, pool) = create_test_pool().await;
        let project = insert_project_with_settings(&pool, "项目", "上海")
            .await
            .expect("project should be created");

        let error = update_map_layer(&pool, &project.id, "traffic")
            .await
            .expect_err("unsupported layer should fail");

        assert_eq!(error.message, "地图图层只能是普通地图或卫星图。");
    }

    #[tokio::test]
    async fn soft_delete_project_hides_it_and_keeps_record() {
        let (_temp_dir, pool) = create_test_pool().await;
        let first_project = insert_project_with_settings(&pool, "项目一", "上海")
            .await
            .expect("first project should be created");
        let second_project = insert_project_with_settings(&pool, "项目二", "上海")
            .await
            .expect("second project should be created");

        delete_project(&pool, &first_project.id)
            .await
            .expect("project should soft delete");

        let workspace = load_project_workspace(&pool, "上海", Some(second_project.id.as_str()))
            .await
            .expect("workspace should load");
        let deleted_at: Option<String> =
            sqlx::query_scalar("SELECT deleted_at FROM projects WHERE id = ?")
                .bind(first_project.id)
                .fetch_one(&pool)
                .await
                .expect("deleted project should remain in database");

        assert_eq!(workspace.projects.len(), 1);
        assert_eq!(workspace.current_project.id, second_project.id);
        assert_eq!(workspace.projects[0].name, "项目二");
        assert!(deleted_at.is_some());
    }

    #[tokio::test]
    async fn workspace_falls_back_after_current_project_is_deleted() {
        let (_temp_dir, pool) = create_test_pool().await;
        let first_project = insert_project_with_settings(&pool, "项目一", "上海")
            .await
            .expect("first project should be created");
        let second_project = insert_project_with_settings(&pool, "项目二", "上海")
            .await
            .expect("second project should be created");

        delete_project(&pool, &first_project.id)
            .await
            .expect("current project should soft delete");
        let workspace = load_project_workspace(&pool, "上海", Some(first_project.id.as_str()))
            .await
            .expect("workspace should load");

        assert_eq!(workspace.projects.len(), 1);
        assert_eq!(workspace.current_project.id, second_project.id);
    }

    #[tokio::test]
    async fn workspace_creates_default_after_last_project_is_deleted() {
        let (_temp_dir, pool) = create_test_pool().await;
        let project = insert_project_with_settings(&pool, "唯一项目", "上海")
            .await
            .expect("project should be created");

        delete_project(&pool, &project.id)
            .await
            .expect("last project should soft delete");
        let workspace = load_project_workspace(&pool, "上海", Some(project.id.as_str()))
            .await
            .expect("workspace should load");
        let deleted_at: Option<String> =
            sqlx::query_scalar("SELECT deleted_at FROM projects WHERE id = ?")
                .bind(project.id)
                .fetch_one(&pool)
                .await
                .expect("deleted project should remain in database");

        assert_eq!(workspace.projects.len(), 1);
        assert_eq!(workspace.current_project.name, "我的项目");
        assert!(deleted_at.is_some());
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }
}
