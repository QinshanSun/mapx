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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementPoint {
    pub lng: f64,
    pub lat: f64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementRecord {
    pub id: String,
    pub project_id: String,
    pub name: String,
    pub points: Vec<MeasurementPoint>,
    pub total_distance_meters: f64,
    pub coordinate_system: String,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMeasurementsRequest {
    pub project_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateMeasurementRequest {
    pub project_id: String,
    pub name: String,
    pub points: Vec<MeasurementPoint>,
    pub total_distance_meters: f64,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMeasurementRequest {
    pub project_id: String,
    pub measurement_id: String,
    pub name: String,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoftDeleteMeasurementRequest {
    pub project_id: String,
    pub measurement_id: String,
}

#[tauri::command]
pub async fn list_project_measurements(
    state: tauri::State<'_, AppRuntimeState>,
    request: ListMeasurementsRequest,
) -> Result<Vec<MeasurementRecord>, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    list_measurements(&pool, &request.project_id).await
}

#[tauri::command]
pub async fn create_measurement(
    state: tauri::State<'_, AppRuntimeState>,
    request: CreateMeasurementRequest,
) -> Result<MeasurementRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    insert_measurement(&pool, request).await
}

#[tauri::command]
pub async fn update_measurement(
    state: tauri::State<'_, AppRuntimeState>,
    request: UpdateMeasurementRequest,
) -> Result<MeasurementRecord, AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    save_measurement(&pool, request).await
}

#[tauri::command]
pub async fn soft_delete_measurement(
    state: tauri::State<'_, AppRuntimeState>,
    request: SoftDeleteMeasurementRequest,
) -> Result<(), AppError> {
    let pool = state.pool.clone().ok_or_else(AppError::db)?;

    delete_measurement(&pool, &request.project_id, &request.measurement_id).await
}

pub async fn list_measurements(
    pool: &SqlitePool,
    project_id: &str,
) -> Result<Vec<MeasurementRecord>, AppError> {
    ensure_active_project(pool, project_id).await?;

    let rows = sqlx::query(
        "SELECT id, project_id, name, points_json, total_distance_meters, coordinate_system, note, created_at, updated_at
         FROM measurements
         WHERE project_id = ?
           AND deleted_at IS NULL
         ORDER BY updated_at DESC, created_at DESC, name ASC",
    )
    .bind(project_id)
    .fetch_all(pool)
    .await
    .map_err(AppError::from)?;

    rows.into_iter().map(measurement_from_row).collect()
}

pub async fn insert_measurement(
    pool: &SqlitePool,
    request: CreateMeasurementRequest,
) -> Result<MeasurementRecord, AppError> {
    let project_id = request.project_id;
    let name = validate_required_name(&request.name)?;
    validate_measurement_points(&request.points)?;
    validate_measurement_distance(request.total_distance_meters)?;
    ensure_active_project(pool, &project_id).await?;
    let measurement_id = new_sqlite_uuid(pool).await?;
    let points_json = serialize_points(&request.points)?;

    sqlx::query(
        "INSERT INTO measurements (
           id, project_id, name, points_json, total_distance_meters, coordinate_system, note,
           created_at, updated_at, deleted_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), NULL)",
    )
    .bind(&measurement_id)
    .bind(&project_id)
    .bind(name)
    .bind(points_json)
    .bind(request.total_distance_meters)
    .bind(COORDINATE_SYSTEM_BD09)
    .bind(normalize_optional_text(request.note))
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_measurement_by_id(pool, &project_id, &measurement_id).await
}

pub async fn save_measurement(
    pool: &SqlitePool,
    request: UpdateMeasurementRequest,
) -> Result<MeasurementRecord, AppError> {
    let project_id = request.project_id;
    let measurement_id = request.measurement_id;
    let name = validate_required_name(&request.name)?;
    ensure_active_project(pool, &project_id).await?;
    ensure_record_belongs_to_project(pool, "measurements", &measurement_id, &project_id).await?;

    sqlx::query(
        "UPDATE measurements
         SET name = ?,
             note = ?,
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(name)
    .bind(normalize_optional_text(request.note))
    .bind(&measurement_id)
    .bind(&project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    load_measurement_by_id(pool, &project_id, &measurement_id).await
}

pub async fn delete_measurement(
    pool: &SqlitePool,
    project_id: &str,
    measurement_id: &str,
) -> Result<(), AppError> {
    ensure_active_project(pool, project_id).await?;
    ensure_record_belongs_to_project(pool, "measurements", measurement_id, project_id).await?;

    sqlx::query(
        "UPDATE measurements
         SET deleted_at = datetime('now'),
             updated_at = datetime('now')
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL",
    )
    .bind(measurement_id)
    .bind(project_id)
    .execute(pool)
    .await
    .map_err(AppError::from)?;

    Ok(())
}

async fn load_measurement_by_id(
    pool: &SqlitePool,
    project_id: &str,
    measurement_id: &str,
) -> Result<MeasurementRecord, AppError> {
    let row = sqlx::query(
        "SELECT id, project_id, name, points_json, total_distance_meters, coordinate_system, note, created_at, updated_at
         FROM measurements
         WHERE id = ?
           AND project_id = ?
           AND deleted_at IS NULL
         LIMIT 1",
    )
    .bind(measurement_id)
    .bind(project_id)
    .fetch_one(pool)
    .await
    .map_err(AppError::from)?;

    measurement_from_row(row)
}

fn measurement_from_row(row: sqlx::sqlite::SqliteRow) -> Result<MeasurementRecord, AppError> {
    let points_json = row
        .try_get::<String, _>("points_json")
        .map_err(AppError::from)?;
    let points: Vec<MeasurementPoint> =
        serde_json::from_str(&points_json).map_err(|_| AppError::db())?;

    Ok(MeasurementRecord {
        id: row.try_get::<String, _>("id").map_err(AppError::from)?,
        project_id: row
            .try_get::<String, _>("project_id")
            .map_err(AppError::from)?,
        name: row.try_get::<String, _>("name").map_err(AppError::from)?,
        points,
        total_distance_meters: row
            .try_get::<f64, _>("total_distance_meters")
            .map_err(AppError::from)?,
        coordinate_system: row
            .try_get::<String, _>("coordinate_system")
            .map_err(AppError::from)?,
        note: row
            .try_get::<Option<String>, _>("note")
            .map_err(AppError::from)?,
        created_at: row
            .try_get::<String, _>("created_at")
            .map_err(AppError::from)?,
        updated_at: row
            .try_get::<String, _>("updated_at")
            .map_err(AppError::from)?,
    })
}

fn validate_measurement_points(points: &[MeasurementPoint]) -> Result<(), AppError> {
    if points.len() < 2 {
        return Err(AppError::validation("测距至少需要两个点。"));
    }

    for point in points {
        validate_bd09_coordinate(point.lng, point.lat)?;
    }

    Ok(())
}

fn validate_measurement_distance(distance_meters: f64) -> Result<(), AppError> {
    if !distance_meters.is_finite() || distance_meters <= 0.0 {
        return Err(AppError::validation("测距距离必须大于 0。"));
    }

    Ok(())
}

fn serialize_points(points: &[MeasurementPoint]) -> Result<String, AppError> {
    serde_json::to_string(points).map_err(|_| AppError::db())
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::bootstrap_database_in;

    #[tokio::test]
    async fn creates_measurement_with_immutable_geometry() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;

        let measurement = insert_measurement(&pool, new_create_request(" 首次测距 "))
            .await
            .expect("measurement should be created");

        assert_eq!(measurement.name, "首次测距");
        assert_eq!(measurement.points.len(), 2);
        assert_eq!(measurement.total_distance_meters, 1280.0);
        assert_eq!(measurement.coordinate_system, "BD09");
        assert_eq!(measurement.note, Some("沿河步行距离".to_string()));
    }

    #[tokio::test]
    async fn rejects_measurement_with_fewer_than_two_points() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let mut request = new_create_request("错误测距");
        request.points.pop();

        let error = insert_measurement(&pool, request)
            .await
            .expect_err("single point measurement should fail");

        assert_eq!(error.message, "测距至少需要两个点。");
    }

    #[tokio::test]
    async fn rejects_invalid_measurement_coordinate() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let mut request = new_create_request("错误坐标");
        request.points[1].lat = 91.0;

        let error = insert_measurement(&pool, request)
            .await
            .expect_err("invalid measurement coordinate should fail");

        assert_eq!(error.message, "坐标超出有效范围。");
    }

    #[tokio::test]
    async fn updates_measurement_name_and_note_without_changing_geometry() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let measurement = insert_measurement(&pool, new_create_request("旧测距"))
            .await
            .expect("measurement should be created");

        let updated = save_measurement(
            &pool,
            UpdateMeasurementRequest {
                project_id: "project-1".to_string(),
                measurement_id: measurement.id.clone(),
                name: " 新测距 ".to_string(),
                note: Some(" 只更新备注 ".to_string()),
            },
        )
        .await
        .expect("measurement should update");

        assert_eq!(updated.name, "新测距");
        assert_eq!(updated.note, Some("只更新备注".to_string()));
        assert_eq!(updated.points, measurement.points);
        assert_eq!(
            updated.total_distance_meters,
            measurement.total_distance_meters
        );
    }

    #[tokio::test]
    async fn soft_deleted_measurements_are_hidden_from_list() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        let measurement = insert_measurement(&pool, new_create_request("待删除测距"))
            .await
            .expect("measurement should be created");

        delete_measurement(&pool, "project-1", &measurement.id)
            .await
            .expect("measurement should soft delete");
        let measurements = list_measurements(&pool, "project-1")
            .await
            .expect("measurements should load");
        let deleted_at: Option<String> = sqlx::query_scalar(
            "SELECT deleted_at FROM measurements WHERE id = ? AND project_id = ?",
        )
        .bind(measurement.id)
        .bind("project-1")
        .fetch_one(&pool)
        .await
        .expect("deleted measurement should remain in database");

        assert!(measurements.is_empty());
        assert!(deleted_at.is_some());
    }

    #[tokio::test]
    async fn rejects_cross_project_measurement_update() {
        let (_temp_dir, pool) = create_test_pool().await;
        insert_project_row(&pool, "project-1").await;
        insert_project_row(&pool, "project-2").await;
        let measurement = insert_measurement(&pool, new_create_request("跨项目测距"))
            .await
            .expect("measurement should be created");

        let error = save_measurement(
            &pool,
            UpdateMeasurementRequest {
                project_id: "project-2".to_string(),
                measurement_id: measurement.id,
                name: "错误项目".to_string(),
                note: None,
            },
        )
        .await
        .expect_err("cross-project measurement should fail");

        assert_eq!(error.message, "记录不属于当前项目。");
    }

    async fn create_test_pool() -> (tempfile::TempDir, SqlitePool) {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let database = bootstrap_database_in(temp_dir.path().to_path_buf())
            .await
            .expect("database bootstrap should succeed");

        (temp_dir, database.pool)
    }

    fn new_create_request(name: &str) -> CreateMeasurementRequest {
        CreateMeasurementRequest {
            project_id: "project-1".to_string(),
            name: name.to_string(),
            points: vec![
                MeasurementPoint {
                    lng: 121.4737,
                    lat: 31.2304,
                },
                MeasurementPoint {
                    lng: 121.481,
                    lat: 31.236,
                },
            ],
            total_distance_meters: 1280.0,
            note: Some(" 沿河步行距离 ".to_string()),
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
}
