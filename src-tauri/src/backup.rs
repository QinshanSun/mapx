use std::{fs, path::PathBuf};

use serde::Serialize;
use sqlx::{Row, SqlitePool};

const BACKUP_DIR_NAME: &str = "backups";
const BACKUP_FILE_PREFIX: &str = "mapx";
const RETAIN_DAILY_BACKUPS: usize = 7;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub backup_directory: String,
    pub latest_backup_at: Option<String>,
    pub latest_backup_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BackupDateContext {
    backup_date: String,
    file_date: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct BackupRecord {
    id: String,
    backup_path: String,
}

pub async fn ensure_daily_backup(pool: &SqlitePool, database_path: PathBuf) -> Result<(), String> {
    let context = load_backup_date_context(pool).await?;
    let backup_directory = backup_directory_from_database_path(&database_path)?;

    fs::create_dir_all(&backup_directory).map_err(|_| "无法创建 MapX 备份目录。".to_string())?;

    if load_backup_for_date(pool, &context.backup_date)
        .await?
        .is_none()
    {
        let backup_path = backup_directory.join(format!(
            "{}-{}.sqlite",
            BACKUP_FILE_PREFIX, context.file_date
        ));

        checkpoint_database(pool).await?;
        fs::copy(&database_path, &backup_path)
            .map_err(|_| "无法创建 MapX 数据库备份。".to_string())?;
        insert_backup_metadata(pool, &backup_path, &context.backup_date).await?;
    }

    prune_old_backups(pool).await
}

pub async fn load_backup_info(
    pool: &SqlitePool,
    database_path: PathBuf,
) -> Result<BackupInfo, String> {
    let backup_directory = backup_directory_from_database_path(&database_path)?;
    let latest_backup = sqlx::query(
        "SELECT backup_path, created_at
         FROM backup_metadata
         WHERE deleted_at IS NULL
         ORDER BY backup_date DESC, created_at DESC
         LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| "无法读取 MapX 备份信息。".to_string())?;

    let (latest_backup_path, latest_backup_at) = match latest_backup {
        Some(row) => (
            Some(
                row.try_get::<String, _>("backup_path")
                    .map_err(|_| "无法读取 MapX 备份信息。".to_string())?,
            ),
            Some(
                row.try_get::<String, _>("created_at")
                    .map_err(|_| "无法读取 MapX 备份信息。".to_string())?,
            ),
        ),
        None => (None, None),
    };

    Ok(BackupInfo {
        backup_directory: backup_directory.display().to_string(),
        latest_backup_at,
        latest_backup_path,
    })
}

pub fn backup_directory_from_database_path(database_path: &PathBuf) -> Result<PathBuf, String> {
    database_path
        .parent()
        .map(|data_directory| data_directory.join(BACKUP_DIR_NAME))
        .ok_or_else(|| "无法定位 MapX 备份目录。".to_string())
}

async fn load_backup_date_context(pool: &SqlitePool) -> Result<BackupDateContext, String> {
    let row = sqlx::query(
        "SELECT date('now', 'localtime') AS backup_date,
                strftime('%Y%m%d', 'now', 'localtime') AS file_date",
    )
    .fetch_one(pool)
    .await
    .map_err(|_| "无法计算 MapX 备份日期。".to_string())?;

    Ok(BackupDateContext {
        backup_date: row
            .try_get::<String, _>("backup_date")
            .map_err(|_| "无法计算 MapX 备份日期。".to_string())?,
        file_date: row
            .try_get::<String, _>("file_date")
            .map_err(|_| "无法计算 MapX 备份日期。".to_string())?,
    })
}

async fn load_backup_for_date(
    pool: &SqlitePool,
    backup_date: &str,
) -> Result<Option<BackupRecord>, String> {
    let row = sqlx::query(
        "SELECT id, backup_path
         FROM backup_metadata
         WHERE backup_date = ?
           AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(backup_date)
    .fetch_optional(pool)
    .await
    .map_err(|_| "无法读取 MapX 备份信息。".to_string())?;

    row.map(|row| {
        Ok(BackupRecord {
            id: row
                .try_get::<String, _>("id")
                .map_err(|_| "无法读取 MapX 备份信息。".to_string())?,
            backup_path: row
                .try_get::<String, _>("backup_path")
                .map_err(|_| "无法读取 MapX 备份信息。".to_string())?,
        })
    })
    .transpose()
}

async fn checkpoint_database(pool: &SqlitePool) -> Result<(), String> {
    sqlx::query("PRAGMA wal_checkpoint(TRUNCATE)")
        .execute(pool)
        .await
        .map_err(|_| "无法准备 MapX 数据库备份。".to_string())?;

    Ok(())
}

async fn insert_backup_metadata(
    pool: &SqlitePool,
    backup_path: &PathBuf,
    backup_date: &str,
) -> Result<(), String> {
    sqlx::query(
        "INSERT INTO backup_metadata (id, backup_path, backup_date, created_at, updated_at, deleted_at)
         VALUES (
           lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(6))),
           ?,
           ?,
           datetime('now'),
           datetime('now'),
           NULL
         )",
    )
    .bind(backup_path.display().to_string())
    .bind(backup_date)
    .execute(pool)
    .await
    .map_err(|_| "无法记录 MapX 备份信息。".to_string())?;

    Ok(())
}

async fn prune_old_backups(pool: &SqlitePool) -> Result<(), String> {
    let rows = sqlx::query(
        "SELECT id, backup_path
         FROM backup_metadata
         WHERE deleted_at IS NULL
         ORDER BY backup_date DESC, created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(|_| "无法读取 MapX 备份信息。".to_string())?;

    let mut old_records = Vec::new();
    for row in rows.into_iter().skip(RETAIN_DAILY_BACKUPS) {
        old_records.push(BackupRecord {
            id: row
                .try_get::<String, _>("id")
                .map_err(|_| "无法读取 MapX 备份信息。".to_string())?,
            backup_path: row
                .try_get::<String, _>("backup_path")
                .map_err(|_| "无法读取 MapX 备份信息。".to_string())?,
        });
    }

    for record in old_records {
        match fs::remove_file(&record.backup_path) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err("无法清理 MapX 旧备份。".to_string()),
        }

        sqlx::query(
            "UPDATE backup_metadata
             SET updated_at = datetime('now'), deleted_at = datetime('now')
             WHERE id = ?
               AND deleted_at IS NULL",
        )
        .bind(record.id)
        .execute(pool)
        .await
        .map_err(|_| "无法清理 MapX 旧备份。".to_string())?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::bootstrap_database_in;

    #[tokio::test]
    async fn daily_backup_creates_expected_file_and_metadata() {
        let (_temp_dir, database_path, pool) = create_test_database().await;

        let context = load_backup_date_context(&pool)
            .await
            .expect("backup date should load");
        let backup_directory = backup_directory_from_database_path(&database_path)
            .expect("backup directory should derive");
        let expected_backup = backup_directory.join(format!("mapx-{}.sqlite", context.file_date));

        assert!(expected_backup.exists());

        let backup_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM backup_metadata WHERE backup_date = ? AND deleted_at IS NULL",
        )
        .bind(context.backup_date)
        .fetch_one(&pool)
        .await
        .expect("backup metadata should be readable");

        assert_eq!(backup_count, 1);
    }

    #[tokio::test]
    async fn repeated_daily_backup_does_not_create_duplicate_metadata() {
        let (_temp_dir, database_path, pool) = create_test_database().await;

        ensure_daily_backup(&pool, database_path)
            .await
            .expect("daily backup should be idempotent");

        let active_backup_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM backup_metadata WHERE deleted_at IS NULL")
                .fetch_one(&pool)
                .await
                .expect("backup metadata should be readable");

        assert_eq!(active_backup_count, 1);
    }

    #[tokio::test]
    async fn old_daily_backups_are_pruned_to_retention_limit() {
        let (_temp_dir, database_path, pool) = create_test_database().await;
        let backup_directory = backup_directory_from_database_path(&database_path)
            .expect("backup directory should derive");

        for day in 1..=8 {
            let backup_date = format!("2024-01-{day:02}");
            let backup_path = backup_directory.join(format!("mapx-202401{day:02}.sqlite"));
            fs::write(&backup_path, b"old backup").expect("old backup file");
            insert_backup_metadata(&pool, &backup_path, &backup_date)
                .await
                .expect("old backup metadata");
        }

        ensure_daily_backup(&pool, database_path)
            .await
            .expect("daily backup should prune old backups");

        let active_backup_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM backup_metadata WHERE deleted_at IS NULL")
                .fetch_one(&pool)
                .await
                .expect("backup metadata should be readable");

        assert_eq!(active_backup_count, RETAIN_DAILY_BACKUPS as i64);
        assert!(!backup_directory.join("mapx-20240101.sqlite").exists());
        assert!(backup_directory.join("mapx-20240108.sqlite").exists());
    }

    async fn create_test_database() -> (tempfile::TempDir, PathBuf, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.database_path, database.pool)
    }
}
