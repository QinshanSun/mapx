use std::{fs, path::PathBuf};

use serde::Serialize;
use sqlx::{
    migrate::Migrator,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use tauri::Manager;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

const APP_DATA_DIR_NAME: &str = "MapX";
const DATABASE_FILE_NAME: &str = "mapx.sqlite";

#[derive(Clone)]
pub struct AppRuntimeState {
    pub bootstrap_status: BootstrapStatus,
    pub pool: Option<SqlitePool>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapStatus {
    pub ready: bool,
    pub database_path: Option<String>,
    pub message: Option<String>,
}

pub struct BootstrappedDatabase {
    pub database_path: PathBuf,
    pub pool: SqlitePool,
}

impl BootstrapStatus {
    pub fn ready(database_path: PathBuf) -> Self {
        Self {
            ready: true,
            database_path: Some(database_path.display().to_string()),
            message: None,
        }
    }

    pub fn failed(message: impl Into<String>) -> Self {
        Self {
            ready: false,
            database_path: None,
            message: Some(message.into()),
        }
    }
}

pub async fn bootstrap_database(app: &tauri::AppHandle) -> Result<BootstrappedDatabase, String> {
    let base_data_dir = app
        .path()
        .data_dir()
        .map_err(|_| "无法获取系统应用数据目录。".to_string())?;

    bootstrap_database_in(base_data_dir).await
}

pub async fn bootstrap_database_in(base_data_dir: PathBuf) -> Result<BootstrappedDatabase, String> {
    let app_data_dir = base_data_dir.join(APP_DATA_DIR_NAME);
    fs::create_dir_all(&app_data_dir).map_err(|_| "无法创建 MapX 数据目录。".to_string())?;

    let database_path = app_data_dir.join(DATABASE_FILE_NAME);
    let options = SqliteConnectOptions::new()
        .filename(&database_path)
        .create_if_missing(true)
        .foreign_keys(true);
    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await
        .map_err(|_| "无法打开 MapX 本地数据库。".to_string())?;

    MIGRATOR
        .run(&pool)
        .await
        .map_err(|_| "MapX 数据库迁移失败。".to_string())?;

    Ok(BootstrappedDatabase {
        database_path,
        pool,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn bootstrap_creates_empty_database_and_runs_migrations() {
        let temp_dir = tempfile::tempdir().expect("temp dir");

        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        assert!(database.database_path.ends_with("MapX/mapx.sqlite"));
        assert!(database.database_path.exists());

        let migration_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM _sqlx_migrations")
            .fetch_one(&database.pool)
            .await
            .expect("migration table should exist");

        assert_eq!(migration_count, 2);
    }

    #[tokio::test]
    async fn bootstrap_creates_v1_core_tables_only() {
        let (_temp_dir, database) = create_test_database().await;
        let table_names: Vec<String> = sqlx::query_scalar(
            "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '_sqlx_%' ORDER BY name",
        )
        .fetch_all(&database.pool)
        .await
        .expect("schema tables should be readable");

        assert_eq!(
            table_names,
            vec![
                "app_settings",
                "backup_metadata",
                "categories",
                "marker_tags",
                "markers",
                "project_settings",
                "projects",
                "tags",
            ]
        );

        let tables_with_deleted_at: Vec<String> = sqlx::query_scalar(
            "SELECT m.name
             FROM sqlite_master m
             WHERE m.type = 'table'
               AND m.name NOT LIKE '_sqlx_%'
               AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'created_at')
               AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'updated_at')
               AND EXISTS (SELECT 1 FROM pragma_table_info(m.name) WHERE name = 'deleted_at')
             ORDER BY m.name",
        )
        .fetch_all(&database.pool)
        .await
        .expect("timestamp fields should be inspectable");

        assert_eq!(tables_with_deleted_at, table_names);
    }

    #[tokio::test]
    async fn category_and_tag_names_are_unique_per_project_until_soft_deleted() {
        let (_temp_dir, database) = create_test_database().await;
        insert_project(&database.pool, "project-1").await;

        insert_category(&database.pool, "category-1", "project-1", "客户", None).await;
        let duplicate_category = sqlx::query(
            "INSERT INTO categories (id, project_id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
             VALUES ('category-2', 'project-1', '客户', '#2563eb', 'Building2', 2, ?, ?, NULL)",
        )
        .bind(now())
        .bind(now())
        .execute(&database.pool)
        .await;

        assert!(duplicate_category.is_err());

        sqlx::query("UPDATE categories SET deleted_at = ? WHERE id = 'category-1'")
            .bind(now())
            .execute(&database.pool)
            .await
            .expect("soft delete category");
        insert_category(&database.pool, "category-3", "project-1", "客户", None).await;

        insert_tag(&database.pool, "tag-1", "project-1", "重点", None).await;
        let duplicate_tag = sqlx::query(
            "INSERT INTO tags (id, project_id, name, created_at, updated_at, deleted_at)
             VALUES ('tag-2', 'project-1', '重点', ?, ?, NULL)",
        )
        .bind(now())
        .bind(now())
        .execute(&database.pool)
        .await;

        assert!(duplicate_tag.is_err());

        sqlx::query("UPDATE tags SET deleted_at = ? WHERE id = 'tag-1'")
            .bind(now())
            .execute(&database.pool)
            .await
            .expect("soft delete tag");
        insert_tag(&database.pool, "tag-3", "project-1", "重点", None).await;
    }

    async fn create_test_database() -> (tempfile::TempDir, BootstrappedDatabase) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database)
    }

    async fn insert_project(pool: &SqlitePool, project_id: &str) {
        sqlx::query(
            "INSERT INTO projects (id, name, created_at, updated_at, deleted_at)
             VALUES (?, '测试项目', ?, ?, NULL)",
        )
        .bind(project_id)
        .bind(now())
        .bind(now())
        .execute(pool)
        .await
        .expect("insert project");
    }

    async fn insert_category(
        pool: &SqlitePool,
        category_id: &str,
        project_id: &str,
        name: &str,
        deleted_at: Option<&str>,
    ) {
        sqlx::query(
            "INSERT INTO categories (id, project_id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, '#2563eb', 'Building2', 1, ?, ?, ?)",
        )
        .bind(category_id)
        .bind(project_id)
        .bind(name)
        .bind(now())
        .bind(now())
        .bind(deleted_at)
        .execute(pool)
        .await
        .expect("insert category");
    }

    async fn insert_tag(
        pool: &SqlitePool,
        tag_id: &str,
        project_id: &str,
        name: &str,
        deleted_at: Option<&str>,
    ) {
        sqlx::query(
            "INSERT INTO tags (id, project_id, name, created_at, updated_at, deleted_at)
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(tag_id)
        .bind(project_id)
        .bind(name)
        .bind(now())
        .bind(now())
        .bind(deleted_at)
        .execute(pool)
        .await
        .expect("insert tag");
    }

    fn now() -> &'static str {
        "2026-06-14T09:30:00Z"
    }
}
