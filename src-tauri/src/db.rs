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

        assert_eq!(migration_count, 1);
    }
}
