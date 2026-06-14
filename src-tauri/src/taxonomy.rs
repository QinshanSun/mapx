use sqlx::SqlitePool;

use crate::errors::AppError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DefaultCategory {
    pub name: &'static str,
    pub color: &'static str,
    pub icon: &'static str,
    pub sort_order: i64,
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
