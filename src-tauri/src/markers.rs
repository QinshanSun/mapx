use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::{
    db::AppRuntimeState,
    errors::AppError,
    validation::{
        ensure_active_project, ensure_record_belongs_to_project, validate_bd09_coordinate,
        validate_required_name,
    },
};

const COORDINATE_SYSTEM_BD09: &str = "BD09";

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MarkerRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub lng: f64,
    pub lat: f64,
    pub coordinate_system: String,
    pub address: Option<String>,
    pub category_id: Option<String>,
    pub note: Option<String>,
    pub source: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMarkersRequest {
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMarkerRequest {
    pub project_id: String,
    pub name: String,
    pub lng: f64,
    pub lat: f64,
    pub address: Option<String>,
    pub category_id: Option<String>,
    pub note: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMarkerRequest {
    pub project_id: String,
    pub marker_id: String,
    pub name: String,
    pub lng: f64,
    pub lat: f64,
    pub address: Option<String>,
    pub category_id: Option<String>,
    pub note: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftDeleteMarkerRequest {
    pub project_id: String,
    pub marker_id: String,
}

#[tauri::command]
pub async fn list_project_markers(
    state: tauri::State<'_, AppRuntimeState>,
    request: ListMarkersRequest,
) -> Result<Vec<MarkerRecord>, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    list_markers(&pool, &request.project_id).await
}

#[tauri::command]
pub async fn create_marker(
    state: tauri::State<'_, AppRuntimeState>,
    request: CreateMarkerRequest,
) -> Result<MarkerRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    insert_marker(&pool, request).await
}

#[tauri::command]
pub async fn update_marker(
    state: tauri::State<'_, AppRuntimeState>,
    request: UpdateMarkerRequest,
) -> Result<MarkerRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    save_marker(&pool, request).await
}

#[tauri::command]
pub async fn soft_delete_marker(
    state: tauri::State<'_, AppRuntimeState>,
    request: SoftDeleteMarkerRequest,
) -> Result<(), AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    delete_marker(&pool, &request.project_id, &request.marker_id).await
}

pub async fn list_markers(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<Vec<MarkerRecord>, AppError> {
    ensure_active_project(pool, project_id).await?;

    let rows = sqlx::query(
        "SELECT id, project_id, name, lng, lat, coordinate_system, address, category_id, note, source, created_at, updated_at
         FROM markers
         WHERE project_id = ?
           AND deleted_at IS NULL
         ORDER BY updated_at DESC, created_at DESC, name ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    rows.into_iter().map(marker_from_row).collect()
}

pub async fn insert_marker(
    pool: &SqlitePool,
    request: CreateMarkerRequest,
) -> Result<MarkerRecord, AppError> {
    let project_id = request.project_id;
    let name = validate_required_name(&request.name)?;
    validate_bd09_coordinate(request.lng, request.lat)?;
    ensure_active_project(pool, &project_id).await?;
    let category_id = validate_optional_category(pool, &project_id, request.category_id).await?;
    let source = validate_marker_source(request.source.as_deref().unwrap_or("manual"))?;
    let marker_id = new_sqlite_uuid(pool).await?;

    sqlx::query(
        "INSERT INTO markers (
           id, project_id, name, lng, lat, coordinate_system, address, category_id, note, source,
           created_at, updated_at, deleted_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(&marker_id)
    .bind(&project_id)
    .bind(name)
    .bind(request.lng)
    .bind(request.lat)
    .bind(COORDINATE_SYSTEM_BD09)
    .bind(normalize_optional_text(request.address))
    .bind(category_id)
    .bind(normalize_optional_text(request.note))
    .bind(source)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_marker_by_id(pool, &project_id, &marker_id).await
}

pub async fn save_marker(
    pool: &SqlitePool,
    request: UpdateMarkerRequest,
) -> Result<MarkerRecord, AppError> {
    let project_id = request.project_id;
    let marker_id = request.marker_id;
    let name = validate_required_name(&request.name)?;
    validate_bd09_coordinate(request.lng, request.lat)?;
    ensure_active_project(pool, &project_id).await?;
    ensure_record_belongs_to_project(pool, "markers", &marker_id, &project_id).await?;
    let category_id = validate_optional_category(pool, &project_id, request.category_id).await?;
    let source = validate_marker_source(request.source.as_deref().unwrap_or("manual"))?;

    sqlx::query(
        "UPDATE markers
         SET name = ?,
             lng = ?,
             lat = ?,
             coordinate_system = ?,
             address = ?,
             category_id = ?,
             note = ?,
             source = ?,
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(name)
    .bind(request.lng)
    .bind(request.lat)
    .bind(COORDINATE_SYSTEM_BD09)
    .bind(normalize_optional_text(request.address))
    .bind(category_id)
    .bind(normalize_optional_text(request.note))
    .bind(source)
    .bind(&marker_id)
    .bind(&project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_marker_by_id(pool, &project_id, &marker_id).await
}

pub async fn delete_marker(
    pool: &SqlitePool,
    project_id: &str,
    marker_id: &str,
) -> Result<(), AppError> {
    ensure_active_project(pool, project_id).await?;
    ensure_record_belongs_to_project(pool, "markers", marker_id, project_id).await?;

    sqlx::query(
        "UPDATE markers
         SET deleted_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(marker_id)
    .bind(project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

async fn load_marker_by_id(
    pool: &SqlitePool,
    project_id: &str,
    marker_id: &str,
) -> Result<MarkerRecord, AppError> {
    let row = sqlx::query(
        "SELECT id, project_id, name, lng, lat, coordinate_system, address, category_id, note, source, created_at, updated_at
         FROM markers
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(marker_id)
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)?;

    marker_from_row(row)
}

async fn validate_optional_category(
    pool: &SqlitePool,
    project_id: &str,
    category_id: Option<String>,
) -> Result<Option<String>, AppError> {
    let Some(category_id) = normalize_optional_text(category_id) else {
        return Ok(None);
    };

    ensure_record_belongs_to_project(pool, "categories", &category_id, project_id).await?;

    Ok(Some(category_id))
}

fn validate_marker_source(source: &str) -> Result<&str, AppError> {
    match source {
        "manual" | "search" | "center" => Ok(source),
        _ => Err(AppError::validation("点位来源不支持。")),
    }
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim();

        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
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

fn marker_from_row(row: sqlx::sqlite::SqliteRow) -> Result<MarkerRecord, AppError> {
    Ok(MarkerRecord {
        id: row.try_get::<String, _>("id").map_err(AppError::from)?,
        project_id: row
            .try_get::<String, _>("project_id")
            .map_err(AppError::from)?,
        name: row.try_get::<String, _>("name").map_err(AppError::from)?,
        lng: row.try_get::<f64, _>("lng").map_err(AppError::from)?,
        lat: row.try_get::<f64, _>("lat").map_err(AppError::from)?,
        coordinate_system: row
            .try_get::<String, _>("coordinate_system")
            .map_err(AppError::from)?,
        address: row
            .try_get::<Option<String>, _>("address")
            .map_err(AppError::from)?,
        category_id: row
            .try_get::<Option<String>, _>("category_id")
            .map_err(AppError::from)?,
        note: row
            .try_get::<Option<String>, _>("note")
            .map_err(AppError::from)?,
        source: row.try_get::<String, _>("source").map_err(AppError::from)?,
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
    async fn creates_marker_with_bd09_coordinate_system() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        insert_category_row(&pool, "category-1", "project-1").await;

        let marker = insert_marker(&pool, new_create_request("门店A", Some("category-1")))
            .await
            .expect("marker should be created");

        assert_eq!(marker.name, "门店A");
        assert_eq!(marker.coordinate_system, "BD09");
        assert_eq!(marker.category_id, Some("category-1".to_string()));
        assert_eq!(marker.address, Some("上海市黄浦区".to_string()));
        assert_eq!(marker.source, "manual");
    }

    #[tokio::test]
    async fn allows_duplicate_marker_names_in_same_project() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;

        insert_marker(&pool, new_create_request("客户总部", None))
            .await
            .expect("first marker should be created");
        insert_marker(&pool, new_create_request("客户总部", None))
            .await
            .expect("duplicate marker name should be allowed");

        let markers = list_markers(&pool, "project-1")
            .await
            .expect("markers should load");

        assert_eq!(markers.len(), 2);
        assert!(markers.iter().all(|marker| marker.name == "客户总部"));
    }

    #[tokio::test]
    async fn updates_marker_fields() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let marker = insert_marker(&pool, new_create_request("旧名称", None))
            .await
            .expect("marker should be created");

        let updated = save_marker(
            &pool,
            UpdateMarkerRequest {
                project_id: "project-1".to_string(),
                marker_id: marker.id,
                name: " 新名称 ".to_string(),
                lng: 121.5,
                lat: 31.25,
                address: Some("  新地址  ".to_string()),
                category_id: None,
                note: Some("  重点跟进  ".to_string()),
                source: Some("search".to_string()),
            },
        )
        .await
        .expect("marker should update");

        assert_eq!(updated.name, "新名称");
        assert_eq!(updated.lng, 121.5);
        assert_eq!(updated.lat, 31.25);
        assert_eq!(updated.address, Some("新地址".to_string()));
        assert_eq!(updated.note, Some("重点跟进".to_string()));
        assert_eq!(updated.source, "search");
    }

    #[tokio::test]
    async fn soft_deleted_markers_are_hidden_from_list() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let marker = insert_marker(&pool, new_create_request("待删除点位", None))
            .await
            .expect("marker should be created");

        delete_marker(&pool, "project-1", &marker.id)
            .await
            .expect("marker should soft delete");
        let markers = list_markers(&pool, "project-1")
            .await
            .expect("markers should load");
        let deleted_at: Option<String> =
            sqlx::query_scalar("SELECT deleted_at FROM markers WHERE id = ? AND project_id = ?")
                .bind(marker.id)
                .bind("project-1")
                .fetch_one(&pool)
                .await
                .expect("deleted marker should remain in database");

        assert!(markers.is_empty());
        assert!(deleted_at.is_some());
    }

    #[tokio::test]
    async fn rejects_invalid_marker_coordinate() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let mut request = new_create_request("错误坐标", None);
        request.lat = 91.0;

        let error = insert_marker(&pool, request)
            .await
            .expect_err("invalid coordinate should fail");

        assert_eq!(error.message, "坐标超出有效范围。");
    }

    #[tokio::test]
    async fn rejects_category_from_another_project() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        insert_project_row(&pool, "project-2").await;
        insert_category_row(&pool, "category-2", "project-2").await;

        let error = insert_marker(&pool, new_create_request("跨项目分类", Some("category-2")))
            .await
            .expect_err("cross-project category should fail");

        assert_eq!(error.message, "记录不属于当前项目。");
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }

    fn new_create_request(name: &str, category_id: Option<&str>) -> CreateMarkerRequest {
        CreateMarkerRequest {
            project_id: "project-1".to_string(),
            name: name.to_string(),
            lng: 121.4737,
            lat: 31.2304,
            address: Some(" 上海市黄浦区 ".to_string()),
            category_id: category_id.map(str::to_string),
            note: None,
            source: None,
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

    async fn insert_category_row(pool: &SqlitePool, category_id: &str, project_id: &str) {
        sqlx::query(
            "INSERT INTO categories (id, project_id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, '#2563eb', 'MapPin', 10, datetime('now'), datetime('now'), NULL)",
        )
        .bind(category_id)
        .bind(project_id)
        .bind(format!("分类-{category_id}"))
        .execute(pool)
        .await
        .expect("insert category");
    }
}
