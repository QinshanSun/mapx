use serde::Serialize;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AppErrorCode {
    ValidationError,
    DbError,
    ProjectNotFound,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: AppErrorCode,
    pub message: String,
}

impl AppError {
    pub fn validation(message: impl Into<String>) -> Self {
        Self {
            code: AppErrorCode::ValidationError,
            message: message.into(),
        }
    }

    pub fn db() -> Self {
        Self {
            code: AppErrorCode::DbError,
            message: "本地数据库操作失败。".to_string(),
        }
    }

    pub fn project_not_found() -> Self {
        Self {
            code: AppErrorCode::ProjectNotFound,
            message: "项目不存在或已被删除。".to_string(),
        }
    }
}

impl From<sqlx::Error> for AppError {
    fn from(_: sqlx::Error) -> Self {
        Self::db()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_validation_error_with_stable_code() {
        let json = serde_json::to_value(AppError::validation("名称不能为空。"))
            .expect("error should serialize");

        assert_eq!(json["code"], "VALIDATION_ERROR");
        assert_eq!(json["message"], "名称不能为空。");
    }

    #[test]
    fn sqlx_error_is_sanitized_as_db_error() {
        let error = AppError::from(sqlx::Error::RowNotFound);
        let json = serde_json::to_value(error).expect("error should serialize");

        assert_eq!(json["code"], "DB_ERROR");
        assert_eq!(json["message"], "本地数据库操作失败。");
        assert!(!json["message"]
            .as_str()
            .unwrap_or_default()
            .contains("RowNotFound"));
    }

    #[test]
    fn serializes_project_not_found() {
        let json =
            serde_json::to_value(AppError::project_not_found()).expect("error should serialize");

        assert_eq!(json["code"], "PROJECT_NOT_FOUND");
        assert_eq!(json["message"], "项目不存在或已被删除。");
    }
}
