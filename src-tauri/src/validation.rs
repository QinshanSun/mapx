use sqlx::{Row, SqlitePool};

use crate::errors::AppError;

pub fn validate_required_name(name: &str) -> Result<String, AppError> {
    let trimmed = name.trim();

    if trimmed.is_empty() {
        return Err(AppError::validation("名称不能为空。"));
    }

    Ok(trimmed.to_string())
}

pub fn validate_bd09_coordinate(lng: f64, lat: f64) -> Result<(), AppError> {
    if !lng.is_finite() || !lat.is_finite() {
        return Err(AppError::validation("坐标必须是有效数字。"));
    }

    if !(-180.0..=180.0).contains(&lng) || !(-90.0..=90.0).contains(&lat) {
        return Err(AppError::validation("坐标超出有效范围。"));
    }

    Ok(())
}

pub async fn ensure_active_project(pool: &SqlitePool, project_id: &str) -> Result<(), AppError> {
    ensure_active_record(pool, "projects", project_id)
        .await
        .map_err(|error| match error.code {
            crate::errors::AppErrorCode::ProjectNotFound => AppError::project_not_found(),
            _ => error,
        })
}

pub async fn ensure_active_record(
    pool: &SqlitePool,
    table_name: &str,
    record_id: &str,
) -> Result<(), AppError> {
    if !matches!(table_name, "projects" | "markers" | "categories" | "tags") {
        return Err(AppError::validation("不支持的校验对象。"));
    }

    let query = format!("SELECT deleted_at FROM {table_name} WHERE id = ?");
    let row = sqlx::query(&query)
        .bind(record_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)?;

    match row {
        Some(row)
            if row
                .try_get::<Option<String>, _>("deleted_at")
                .map_err(AppError::from)?
                .is_none() =>
        {
            Ok(())
        }
        _ if table_name == "projects" => Err(AppError::project_not_found()),
        _ => Err(AppError::validation("记录不存在或已被删除。")),
    }
}

pub async fn ensure_record_belongs_to_project(
    pool: &SqlitePool,
    table_name: &str,
    record_id: &str,
    project_id: &str,
) -> Result<(), AppError> {
    if !matches!(table_name, "markers" | "categories" | "tags") {
        return Err(AppError::validation("不支持的项目引用校验对象。"));
    }

    let query = format!("SELECT project_id, deleted_at FROM {table_name} WHERE id = ?");
    let row = sqlx::query(&query)
        .bind(record_id)
        .fetch_optional(pool)
        .await
        .map_err(AppError::from)?;

    let Some(row) = row else {
        return Err(AppError::validation("记录不存在或已被删除。"));
    };

    if row
        .try_get::<Option<String>, _>("deleted_at")
        .map_err(AppError::from)?
        .is_some()
    {
        return Err(AppError::validation("记录不存在或已被删除。"));
    }

    let actual_project_id = row
        .try_get::<String, _>("project_id")
        .map_err(AppError::from)?;
    if actual_project_id != project_id {
        return Err(AppError::validation("记录不属于当前项目。"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::bootstrap_database_in;

    #[test]
    fn required_name_rejects_empty_values() {
        let error = validate_required_name("  ").expect_err("empty name should fail");

        assert_eq!(error.message, "名称不能为空。");
    }

    #[test]
    fn required_name_trims_valid_values() {
        let name = validate_required_name("  默认项目  ").expect("name should be valid");

        assert_eq!(name, "默认项目");
    }

    #[test]
    fn coordinate_rejects_out_of_range_values() {
        let error = validate_bd09_coordinate(181.0, 31.2).expect_err("invalid lng should fail");

        assert_eq!(error.message, "坐标超出有效范围。");
    }

    #[test]
    fn coordinate_rejects_non_finite_values() {
        let error = validate_bd09_coordinate(f64::NAN, 31.2).expect_err("NaN should fail");

        assert_eq!(error.message, "坐标必须是有效数字。");
    }

    #[tokio::test]
    async fn active_project_rejects_soft_deleted_project() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project(&pool, "project-1", Some(now())).await;

        let error = ensure_active_project(&pool, "project-1")
            .await
            .expect_err("soft-deleted project should fail");

        assert_eq!(error.message, "项目不存在或已被删除。");
    }

    #[tokio::test]
    async fn active_record_accepts_live_marker() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project(&pool, "project-1", None).await;
        insert_marker(&pool, "marker-1", "project-1", None).await;

        ensure_active_record(&pool, "markers", "marker-1")
            .await
            .expect("live marker should pass");
    }

    #[tokio::test]
    async fn project_reference_rejects_cross_project_records() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project(&pool, "project-1", None).await;
        insert_project(&pool, "project-2", None).await;
        insert_marker(&pool, "marker-1", "project-1", None).await;

        let error = ensure_record_belongs_to_project(&pool, "markers", "marker-1", "project-2")
            .await
            .expect_err("cross-project marker should fail");

        assert_eq!(error.message, "记录不属于当前项目。");
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }

    async fn insert_project(pool: &SqlitePool, project_id: &str, deleted_at: Option<&str>) {
        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at, deleted_at)
             VALUES (?, '测试项目', ?, ?, ?)",
        )
        .bind(project_id)
        .bind(now())
        .bind(now())
        .bind(deleted_at)
        .execute(pool)
        .await
        .expect("insert project");
    }

    async fn insert_marker(
        pool: &SqlitePool,
        marker_id: &str,
        project_id: &str,
        deleted_at: Option<&str>,
    ) {
        sqlx::query(
            "INSERT INTO markers (id, project_id, name, lng, lat, coordinate_system, address, category_id, note, source, created_at, updated_at, deleted_at)
             VALUES (?, ?, '测试点位', 121.4737, 31.2304, 'BD09', NULL, NULL, NULL, 'manual', ?, ?, ?)",
        )
        .bind(marker_id)
        .bind(project_id)
        .bind(now())
        .bind(now())
        .bind(deleted_at)
        .execute(pool)
        .await
        .expect("insert marker");
    }

    fn now() -> &'static str {
        "2026-06-14T09:30:00Z"
    }
}
