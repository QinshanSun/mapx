use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::{
    db::AppRuntimeState,
    errors::AppError,
    validation::{ensure_active_project, ensure_record_belongs_to_project, validate_required_name},
};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListCategoriesRequest {
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCategoryRequest {
    pub project_id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCategoryRequest {
    pub project_id: String,
    pub category_id: String,
    pub name: String,
    pub color: String,
    pub icon: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftDeleteCategoryRequest {
    pub project_id: String,
    pub category_id: String,
}

pub const LUCIDE_CATEGORY_ICON_ALLOWLIST: &[&str] = &[
    "MapPin",
    "Building2",
    "Store",
    "Warehouse",
    "Users",
    "Flag",
    "Star",
    "BadgeAlert",
    "Wrench",
    "Truck",
    "Car",
    "Bus",
    "Train",
    "School",
    "Hospital",
    "Utensils",
    "Factory",
    "Home",
    "BriefcaseBusiness",
    "Landmark",
    "Trees",
    "Package",
    "Shield",
    "HeartPulse",
];

#[tauri::command]
pub async fn list_project_categories(
    state: tauri::State<'_, AppRuntimeState>,
    request: ListCategoriesRequest,
) -> Result<Vec<CategoryRecord>, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    list_categories(&pool, &request.project_id).await
}

#[tauri::command]
pub async fn create_category(
    state: tauri::State<'_, AppRuntimeState>,
    request: CreateCategoryRequest,
) -> Result<CategoryRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    insert_category(&pool, request).await
}

#[tauri::command]
pub async fn update_category(
    state: tauri::State<'_, AppRuntimeState>,
    request: UpdateCategoryRequest,
) -> Result<CategoryRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    save_category_changes(&pool, request).await
}

#[tauri::command]
pub async fn soft_delete_category(
    state: tauri::State<'_, AppRuntimeState>,
    request: SoftDeleteCategoryRequest,
) -> Result<(), AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    delete_category(&pool, &request.project_id, &request.category_id).await
}

pub async fn list_categories(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<Vec<CategoryRecord>, AppError> {
    ensure_active_project(pool, project_id).await?;

    let rows = sqlx::query(
        "SELECT id, project_id, name, color, icon, sort_order, created_at, updated_at
         FROM categories
         WHERE project_id = ?
           AND deleted_at IS NULL
         ORDER BY sort_order ASC, name ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    rows.into_iter().map(category_from_row).collect()
}

pub fn is_allowed_category_icon(icon: &str) -> bool {
    LUCIDE_CATEGORY_ICON_ALLOWLIST.contains(&icon)
}

pub async fn insert_category(
    pool: &SqlitePool,
    request: CreateCategoryRequest,
) -> Result<CategoryRecord, AppError> {
    let project_id = request.project_id;
    let name = validate_required_name(&request.name)?;
    let color = validate_category_color(&request.color)?;
    let icon = validate_category_icon(&request.icon)?;
    ensure_active_project(pool, &project_id).await?;
    ensure_category_name_available(pool, &project_id, &name, None).await?;
    let category_id = new_sqlite_uuid(pool).await?;
    let sort_order = next_category_sort_order(pool, &project_id).await?;

    sqlx::query(
        "INSERT INTO categories (id, project_id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(&category_id)
    .bind(&project_id)
    .bind(name)
    .bind(color)
    .bind(icon)
    .bind(sort_order)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_category_by_id(pool, &project_id, &category_id).await
}

pub async fn save_category_changes(
    pool: &SqlitePool,
    request: UpdateCategoryRequest,
) -> Result<CategoryRecord, AppError> {
    let project_id = request.project_id;
    let category_id = request.category_id;
    let name = validate_required_name(&request.name)?;
    let color = validate_category_color(&request.color)?;
    let icon = validate_category_icon(&request.icon)?;
    ensure_active_project(pool, &project_id).await?;
    ensure_record_belongs_to_project(pool, "categories", &category_id, &project_id).await?;
    ensure_category_name_available(pool, &project_id, &name, Some(&category_id)).await?;

    sqlx::query(
        "UPDATE categories
         SET name = ?,
             color = ?,
             icon = ?,
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(name)
    .bind(color)
    .bind(icon)
    .bind(&category_id)
    .bind(&project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_category_by_id(pool, &project_id, &category_id).await
}

pub async fn delete_category(
    pool: &SqlitePool,
    project_id: &str,
    category_id: &str,
) -> Result<(), AppError> {
    ensure_active_project(pool, project_id).await?;
    ensure_record_belongs_to_project(pool, "categories", category_id, project_id).await?;

    let mut transaction = pool.begin().await.map_err(AppError::from)?;

    sqlx::query(
        "UPDATE categories
         SET deleted_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(category_id)
    .bind(project_id)
    .execute(&mut *transaction)
    .await
    .map_err(AppError::from)?;

    sqlx::query(
        "UPDATE markers
         SET category_id = NULL,
             updated_at = datetime('now')
         WHERE project_id = ?
           AND category_id = ?
           AND deleted_at IS NULL",
    )
    .bind(project_id)
    .bind(category_id)
    .execute(&mut *transaction)
    .await
    .map_err(AppError::from)?;

    transaction.commit().await.map_err(AppError::from)?;

    Ok(())
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

async fn load_category_by_id(
    pool: &SqlitePool,
    project_id: &str,
    category_id: &str,
) -> Result<CategoryRecord, AppError> {
    let row = sqlx::query(
        "SELECT id, project_id, name, color, icon, sort_order, created_at, updated_at
         FROM categories
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(category_id)
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)?;

    category_from_row(row)
}

async fn ensure_category_name_available(
    pool: &SqlitePool,
    project_id: &str,
    name: &str,
    current_category_id: Option<&str>,
) -> Result<(), AppError> {
    let existing_id: Option<String> = sqlx::query_scalar(
        "SELECT id
         FROM categories
         WHERE project_id = ?
           AND name = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(project_id)
    .bind(name)
    .fetch_optional(pool)
    .await
    .map_err(AppError::from)?;

    match (existing_id, current_category_id) {
        (Some(existing_id), Some(current_id)) if existing_id == current_id => Ok(()),
        (Some(_), _) => Err(AppError::validation("同一项目内分类名称不能重复。")),
        (None, _) => Ok(()),
    }
}

async fn next_category_sort_order(pool: &SqlitePool, project_id: &str) -> Result<i64, AppError> {
    let current_max: Option<i64> = sqlx::query_scalar(
        "SELECT MAX(sort_order)
         FROM categories
         WHERE project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)?;

    Ok(current_max.unwrap_or(0) + 10)
}

fn validate_category_icon(icon: &str) -> Result<String, AppError> {
    if !is_allowed_category_icon(icon) {
        return Err(AppError::validation("分类图标不在允许列表中。"));
    }

    Ok(icon.to_string())
}

fn validate_category_color(color: &str) -> Result<String, AppError> {
    let color = color.trim();
    let is_hex_color = color.starts_with('#')
        && color.len() == 7
        && color.chars().skip(1).all(|char| char.is_ascii_hexdigit());

    if !is_hex_color {
        return Err(AppError::validation("分类颜色必须是 #RRGGBB 格式。"));
    }

    Ok(color.to_ascii_lowercase())
}

fn category_from_row(row: sqlx::sqlite::SqliteRow) -> Result<CategoryRecord, AppError> {
    Ok(CategoryRecord {
        id: row.try_get::<String, _>("id").map_err(AppError::from)?,
        project_id: row
            .try_get::<String, _>("project_id")
            .map_err(AppError::from)?,
        name: row.try_get::<String, _>("name").map_err(AppError::from)?,
        color: row.try_get::<String, _>("color").map_err(AppError::from)?,
        icon: row.try_get::<String, _>("icon").map_err(AppError::from)?,
        sort_order: row
            .try_get::<i64, _>("sort_order")
            .map_err(AppError::from)?,
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

    #[test]
    fn category_icon_allowlist_matches_user_defined_style_controls() {
        assert_eq!(LUCIDE_CATEGORY_ICON_ALLOWLIST.len(), 24);
        assert!(is_allowed_category_icon("MapPin"));
        assert!(is_allowed_category_icon("Building2"));
        assert!(is_allowed_category_icon("Truck"));
        assert!(is_allowed_category_icon("Hospital"));
        assert!(!is_allowed_category_icon("Circle"));
    }

    #[tokio::test]
    async fn creates_and_updates_project_category() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;

        let category = insert_category(&pool, new_create_request("  新客户  ", "#ABCDEF", "Users"))
            .await
            .expect("category should be created");
        let updated = save_category_changes(
            &pool,
            UpdateCategoryRequest {
                project_id: "project-1".to_string(),
                category_id: category.id,
                name: " 门店A ".to_string(),
                color: "#16A34A".to_string(),
                icon: "Store".to_string(),
            },
        )
        .await
        .expect("category should update");

        assert_eq!(updated.name, "门店A");
        assert_eq!(updated.color, "#16a34a");
        assert_eq!(updated.icon, "Store");
    }

    #[tokio::test]
    async fn rejects_duplicate_active_category_names() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        insert_category(&pool, new_create_request("客户", "#2563eb", "Users"))
            .await
            .expect("category should be created");

        let error = insert_category(&pool, new_create_request("客户", "#16a34a", "Store"))
            .await
            .expect_err("duplicate category should fail");

        assert_eq!(error.message, "同一项目内分类名称不能重复。");
    }

    #[tokio::test]
    async fn allows_reusing_soft_deleted_category_name() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let category = insert_category(&pool, new_create_request("客户", "#2563eb", "Users"))
            .await
            .expect("category should be created");
        soft_delete_category_row(&pool, &category.id).await;

        let recreated = insert_category(&pool, new_create_request("客户", "#16a34a", "Store"))
            .await
            .expect("soft-deleted category name should be reusable");

        assert_eq!(recreated.name, "客户");
    }

    #[tokio::test]
    async fn rejects_invalid_color_and_icon() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;

        let color_error = insert_category(&pool, new_create_request("客户", "2563eb", "Users"))
            .await
            .expect_err("invalid color should fail");
        let icon_error = insert_category(&pool, new_create_request("客户", "#2563eb", "Circle"))
            .await
            .expect_err("invalid icon should fail");

        assert_eq!(color_error.message, "分类颜色必须是 #RRGGBB 格式。");
        assert_eq!(icon_error.message, "分类图标不在允许列表中。");
    }

    #[tokio::test]
    async fn deleting_category_uncategorizes_markers_without_deleting_them() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let category = insert_category(&pool, new_create_request("客户", "#2563eb", "Users"))
            .await
            .expect("category should be created");
        insert_marker_row(&pool, "marker-1", "project-1", Some(&category.id)).await;

        delete_category(&pool, "project-1", &category.id)
            .await
            .expect("category should soft delete");

        let categories = list_categories(&pool, "project-1")
            .await
            .expect("categories should load");
        let marker_row = sqlx::query(
            "SELECT category_id, deleted_at
             FROM markers
             WHERE id = ?
               AND project_id = ?",
        )
        .bind("marker-1")
        .bind("project-1")
        .fetch_one(&pool)
        .await
        .expect("marker should remain in database");

        assert!(categories.is_empty());
        assert_eq!(
            marker_row
                .try_get::<Option<String>, _>("category_id")
                .expect("category id should read"),
            None
        );
        assert_eq!(
            marker_row
                .try_get::<Option<String>, _>("deleted_at")
                .expect("deleted_at should read"),
            None
        );
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }

    fn new_create_request(name: &str, color: &str, icon: &str) -> CreateCategoryRequest {
        CreateCategoryRequest {
            project_id: "project-1".to_string(),
            name: name.to_string(),
            color: color.to_string(),
            icon: icon.to_string(),
        }
    }

    async fn insert_project_row(pool: &SqlitePool, project_id: &str) {
        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at, deleted_at)
             VALUES (?, '测试项目', datetime('now'), datetime('now'), NULL)",
        )
        .bind(project_id)
        .execute(pool)
        .await
        .expect("insert project");
    }

    async fn soft_delete_category_row(pool: &SqlitePool, category_id: &str) {
        sqlx::query(
            "UPDATE categories
             SET deleted_at = datetime('now')
             WHERE id = ?",
        )
        .bind(category_id)
        .execute(pool)
        .await
        .expect("soft delete category row");
    }

    async fn insert_marker_row(
        pool: &SqlitePool,
        marker_id: &str,
        project_id: &str,
        category_id: Option<&str>,
    ) {
        sqlx::query(
            "INSERT INTO markers (id, project_id, name, lng, lat, coordinate_system, address, category_id, note, source, created_at, updated_at, deleted_at)
             VALUES (?, ?, '测试点位', 121.4737, 31.2304, 'BD09', NULL, ?, NULL, 'manual', datetime('now'), datetime('now'), NULL)",
        )
        .bind(marker_id)
        .bind(project_id)
        .bind(category_id)
        .execute(pool)
        .await
        .expect("insert marker");
    }
}
