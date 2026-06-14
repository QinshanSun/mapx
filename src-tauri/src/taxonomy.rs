use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool};

use crate::{db::AppRuntimeState, errors::AppError, validation::ensure_active_project};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DefaultCategory {
    pub name: &'static str,
    pub color: &'static str,
    pub icon: &'static str,
    pub sort_order: i64,
}

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

pub const LUCIDE_CATEGORY_ICON_ALLOWLIST: &[&str] =
    &["Users", "Store", "Warehouse", "BadgeAlert", "MapPin"];

pub const DEFAULT_CATEGORIES: &[DefaultCategory] = &[
    DefaultCategory {
        name: "客户",
        color: "#2563eb",
        icon: "Users",
        sort_order: 10,
    },
    DefaultCategory {
        name: "门店",
        color: "#16a34a",
        icon: "Store",
        sort_order: 20,
    },
    DefaultCategory {
        name: "仓库",
        color: "#f59e0b",
        icon: "Warehouse",
        sort_order: 30,
    },
    DefaultCategory {
        name: "竞品",
        color: "#dc2626",
        icon: "BadgeAlert",
        sort_order: 40,
    },
    DefaultCategory {
        name: "候选点",
        color: "#7c3aed",
        icon: "MapPin",
        sort_order: 50,
    },
];

pub async fn create_default_categories_for_project(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<(), AppError> {
    for category in DEFAULT_CATEGORIES {
        insert_default_category(pool, project_id, category).await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn list_project_categories(
    state: tauri::State<'_, AppRuntimeState>,
    request: ListCategoriesRequest,
) -> Result<Vec<CategoryRecord>, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    list_categories(&pool, &request.project_id).await
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

async fn insert_default_category(
    pool: &SqlitePool,
    project_id: &str,
    category: &DefaultCategory,
) -> Result<(), AppError> {
    if !is_allowed_category_icon(category.icon) {
        return Err(AppError::validation("默认分类图标不在允许列表中。"));
    }

    let category_id = new_sqlite_uuid(pool).await?;

    sqlx::query(
        "INSERT INTO categories (id, project_id, name, color, icon, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(category_id)
    .bind(project_id)
    .bind(category.name)
    .bind(category.color)
    .bind(category.icon)
    .bind(category.sort_order)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

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

    #[test]
    fn default_categories_match_v1_contract() {
        let names: Vec<&str> = DEFAULT_CATEGORIES
            .iter()
            .map(|category| category.name)
            .collect();
        let icons_are_allowed = DEFAULT_CATEGORIES
            .iter()
            .all(|category| is_allowed_category_icon(category.icon));
        let colors_are_hex = DEFAULT_CATEGORIES.iter().all(|category| {
            category.color.starts_with('#')
                && category.color.len() == 7
                && category
                    .color
                    .chars()
                    .skip(1)
                    .all(|char| char.is_ascii_hexdigit())
        });

        assert_eq!(names, vec!["客户", "门店", "仓库", "竞品", "候选点"]);
        assert!(icons_are_allowed);
        assert!(colors_are_hex);
        assert!(!names.contains(&"未分类"));
    }
}
