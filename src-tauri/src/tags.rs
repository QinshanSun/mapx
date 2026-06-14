use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::{
    db::AppRuntimeState,
    errors::AppError,
    validation::{ensure_active_project, ensure_record_belongs_to_project, validate_required_name},
};

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct TagRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListTagsRequest {
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagRequest {
    pub project_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTagRequest {
    pub project_id: String,
    pub tag_id: String,
    pub name: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftDeleteTagRequest {
    pub project_id: String,
    pub tag_id: String,
}

#[tauri::command]
pub async fn list_project_tags(
    state: tauri::State<'_, AppRuntimeState>,
    request: ListTagsRequest,
) -> Result<Vec<TagRecord>, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    list_tags(&pool, &request.project_id).await
}

#[tauri::command]
pub async fn create_tag(
    state: tauri::State<'_, AppRuntimeState>,
    request: CreateTagRequest,
) -> Result<TagRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    insert_tag(&pool, request).await
}

#[tauri::command]
pub async fn update_tag(
    state: tauri::State<'_, AppRuntimeState>,
    request: UpdateTagRequest,
) -> Result<TagRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    rename_tag(&pool, request).await
}

#[tauri::command]
pub async fn soft_delete_tag(
    state: tauri::State<'_, AppRuntimeState>,
    request: SoftDeleteTagRequest,
) -> Result<(), AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    delete_tag(&pool, &request.project_id, &request.tag_id).await
}

pub async fn list_tags(pool: &SqlitePool, project_id: &str) -> Result<Vec<TagRecord>, AppError> {
    ensure_active_project(pool, project_id).await?;

    let rows = sqlx::query(
        "SELECT id, project_id, name, created_at, updated_at
         FROM tags
         WHERE project_id = ?
           AND deleted_at IS NULL
         ORDER BY name ASC, created_at ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    rows.into_iter().map(tag_from_row).collect()
}

pub async fn insert_tag(
    pool: &SqlitePool,
    request: CreateTagRequest,
) -> Result<TagRecord, AppError> {
    let project_id = request.project_id;
    let name = validate_required_name(&request.name)?;
    ensure_active_project(pool, &project_id).await?;
    ensure_tag_name_available(pool, &project_id, &name, None).await?;
    let tag_id = new_sqlite_uuid(pool).await?;

    sqlx::query(
        "INSERT INTO tags (id, project_id, name, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(&tag_id)
    .bind(&project_id)
    .bind(name)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_tag_by_id(pool, &project_id, &tag_id).await
}

pub async fn rename_tag(
    pool: &SqlitePool,
    request: UpdateTagRequest,
) -> Result<TagRecord, AppError> {
    let project_id = request.project_id;
    let tag_id = request.tag_id;
    let name = validate_required_name(&request.name)?;
    ensure_active_project(pool, &project_id).await?;
    ensure_record_belongs_to_project(pool, "tags", &tag_id, &project_id).await?;
    ensure_tag_name_available(pool, &project_id, &name, Some(&tag_id)).await?;

    sqlx::query(
        "UPDATE tags
         SET name = ?,
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(name)
    .bind(&tag_id)
    .bind(&project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_tag_by_id(pool, &project_id, &tag_id).await
}

pub async fn delete_tag(pool: &SqlitePool, project_id: &str, tag_id: &str) -> Result<(), AppError> {
    ensure_active_project(pool, project_id).await?;
    ensure_record_belongs_to_project(pool, "tags", tag_id, project_id).await?;

    let mut transaction = pool.begin().await.map_err(AppError::from)?;

    sqlx::query(
        "UPDATE tags
         SET deleted_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(tag_id)
    .bind(project_id)
    .execute(&mut *transaction)
    .await
    .map_err(AppError::from)?;

    sqlx::query(
        "UPDATE marker_tags
         SET deleted_at = datetime('now'),
             updated_at = datetime('now')
         WHERE tag_id = ?
           AND deleted_at IS NULL",
    )
    .bind(tag_id)
    .execute(&mut *transaction)
    .await
    .map_err(AppError::from)?;

    transaction.commit().await.map_err(AppError::from)?;

    Ok(())
}

async fn load_tag_by_id(
    pool: &SqlitePool,
    project_id: &str,
    tag_id: &str,
) -> Result<TagRecord, AppError> {
    let row = sqlx::query(
        "SELECT id, project_id, name, created_at, updated_at
         FROM tags
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(tag_id)
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)?;

    tag_from_row(row)
}

async fn ensure_tag_name_available(
    pool: &SqlitePool,
    project_id: &str,
    name: &str,
    current_tag_id: Option<&str>,
) -> Result<(), AppError> {
    let existing_id: Option<String> = sqlx::query_scalar(
        "SELECT id
         FROM tags
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

    match (existing_id, current_tag_id) {
        (Some(existing_id), Some(current_id)) if existing_id == current_id => Ok(()),
        (Some(_), _) => Err(AppError::validation("同一项目内标签名称不能重复。")),
        (None, _) => Ok(()),
    }
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

fn tag_from_row(row: sqlx::sqlite::SqliteRow) -> Result<TagRecord, AppError> {
    Ok(TagRecord {
        id: row.try_get::<String, _>("id").map_err(AppError::from)?,
        project_id: row
            .try_get::<String, _>("project_id")
            .map_err(AppError::from)?,
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
    async fn creates_and_renames_project_tag() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;

        let tag = insert_tag(&pool, new_create_request("  重点客户  "))
            .await
            .expect("tag should be created");
        let renamed = rename_tag(
            &pool,
            UpdateTagRequest {
                project_id: "project-1".to_string(),
                tag_id: tag.id,
                name: " 待复访 ".to_string(),
            },
        )
        .await
        .expect("tag should rename");

        assert_eq!(renamed.name, "待复访");
        assert_eq!(list_tags(&pool, "project-1").await.unwrap().len(), 1);
    }

    #[tokio::test]
    async fn rejects_duplicate_active_tag_names() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        insert_tag(&pool, new_create_request("重点"))
            .await
            .expect("tag should be created");

        let error = insert_tag(&pool, new_create_request("重点"))
            .await
            .expect_err("duplicate tag should fail");

        assert_eq!(error.message, "同一项目内标签名称不能重复。");
    }

    #[tokio::test]
    async fn soft_delete_tag_hides_it_and_unlinks_markers() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        insert_marker_row(&pool, "marker-1", "project-1").await;
        let tag = insert_tag(&pool, new_create_request("重点"))
            .await
            .expect("tag should be created");
        insert_marker_tag_row(&pool, "marker-1", &tag.id).await;

        delete_tag(&pool, "project-1", &tag.id)
            .await
            .expect("tag should soft delete");

        let tags = list_tags(&pool, "project-1")
            .await
            .expect("tags should load");
        let marker_tag_deleted_at: Option<String> = sqlx::query_scalar(
            "SELECT deleted_at FROM marker_tags WHERE marker_id = 'marker-1' AND tag_id = ?",
        )
        .bind(tag.id)
        .fetch_one(&pool)
        .await
        .expect("marker tag row should remain");
        let marker_deleted_at: Option<String> =
            sqlx::query_scalar("SELECT deleted_at FROM markers WHERE id = 'marker-1'")
                .fetch_one(&pool)
                .await
                .expect("marker should remain");

        assert!(tags.is_empty());
        assert!(marker_tag_deleted_at.is_some());
        assert!(marker_deleted_at.is_none());
    }

    #[tokio::test]
    async fn allows_reusing_soft_deleted_tag_name() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let tag = insert_tag(&pool, new_create_request("重点"))
            .await
            .expect("tag should be created");
        delete_tag(&pool, "project-1", &tag.id)
            .await
            .expect("tag should soft delete");

        let recreated = insert_tag(&pool, new_create_request("重点"))
            .await
            .expect("soft-deleted tag name should be reusable");

        assert_eq!(recreated.name, "重点");
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }

    fn new_create_request(name: &str) -> CreateTagRequest {
        CreateTagRequest {
            project_id: "project-1".to_string(),
            name: name.to_string(),
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

    async fn insert_marker_row(pool: &SqlitePool, marker_id: &str, project_id: &str) {
        sqlx::query(
            "INSERT INTO markers (id, project_id, name, lng, lat, coordinate_system, address, category_id, note, source, created_at, updated_at, deleted_at)
             VALUES (?, ?, '测试点位', 121.4737, 31.2304, 'BD09', NULL, NULL, NULL, 'manual', datetime('now'), datetime('now'), NULL)",
        )
        .bind(marker_id)
        .bind(project_id)
        .execute(pool)
        .await
        .expect("insert marker");
    }

    async fn insert_marker_tag_row(pool: &SqlitePool, marker_id: &str, tag_id: &str) {
        sqlx::query(
            "INSERT INTO marker_tags (marker_id, tag_id, created_at, updated_at, deleted_at)
             VALUES (?, ?, datetime('now'), datetime('now'), NULL)",
        )
        .bind(marker_id)
        .bind(tag_id)
        .execute(pool)
        .await
        .expect("insert marker tag");
    }
}
