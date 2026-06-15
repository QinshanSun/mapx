use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use tauri::Manager;

use crate::errors::AppError;

const LOG_FILE_NAME: &str = "mapx.log";
const REDACTED: &str = "[redacted]";

pub fn log_app_event(app: &tauri::AppHandle, event: &str, fields: &[(&str, &str)]) {
    if let Ok(log_directory) = app.path().app_log_dir() {
        log_event_to_dir(Some(&log_directory), "app", event, fields);
    }
}

pub fn log_event_to_dir(
    log_directory: Option<&PathBuf>,
    category: &str,
    event: &str,
    fields: &[(&str, &str)],
) {
    let Some(log_directory) = log_directory else {
        return;
    };

    let line = build_log_line(now_unix_seconds(), category, event, fields);
    let _ = append_log_line(log_directory, &line);
}

#[tauri::command]
pub fn record_map_load_failure(app: tauri::AppHandle, code: String) -> Result<(), AppError> {
    log_app_event(&app, "map_load_failure", &[("code", &code)]);
    Ok(())
}

#[tauri::command]
pub fn record_command_error(
    app: tauri::AppHandle,
    command_name: String,
    error_code: String,
) -> Result<(), AppError> {
    log_app_event(
        &app,
        "command_error",
        &[("command", &command_name), ("code", &error_code)],
    );
    Ok(())
}

fn append_log_line(log_directory: &Path, line: &str) -> Result<(), std::io::Error> {
    fs::create_dir_all(log_directory)?;
    let log_path = log_directory.join(LOG_FILE_NAME);
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)?;

    writeln!(file, "{line}")
}

fn build_log_line(
    timestamp_seconds: u64,
    category: &str,
    event: &str,
    fields: &[(&str, &str)],
) -> String {
    let mut segments = vec![
        format!("ts={timestamp_seconds}"),
        format!("category={}", sanitize_log_token(category)),
        format!("event={}", sanitize_log_token(event)),
    ];

    for (key, value) in fields {
        segments.push(format!(
            "{}={}",
            sanitize_log_token(key),
            sanitize_log_value(key, value)
        ));
    }

    segments.join(" ")
}

fn sanitize_log_token(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .filter(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
        })
        .collect();

    if sanitized.is_empty() {
        "unknown".to_string()
    } else {
        sanitized
    }
}

fn sanitize_log_value(key: &str, value: &str) -> String {
    let normalized_key = key.to_ascii_lowercase();
    if is_sensitive_key(&normalized_key) {
        return REDACTED.to_string();
    }

    let single_line = value.replace(['\r', '\n'], " ").trim().to_string();
    if looks_like_secret(&single_line) {
        return REDACTED.to_string();
    }

    if single_line.is_empty() {
        "empty".to_string()
    } else {
        sanitize_log_token(&single_line)
    }
}

fn is_sensitive_key(key: &str) -> bool {
    [
        "ak", "token", "secret", "password", "keyword", "query", "search", "address", "note",
        "remark",
    ]
    .iter()
    .any(|sensitive| key.contains(sensitive))
}

fn looks_like_secret(value: &str) -> bool {
    let has_lowercase = value
        .chars()
        .any(|character| character.is_ascii_lowercase());
    let has_uppercase = value
        .chars()
        .any(|character| character.is_ascii_uppercase());
    let has_digit = value.chars().any(|character| character.is_ascii_digit());

    value.len() >= 20
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '_' | '-'))
        && ((has_lowercase && has_uppercase)
            || (has_lowercase && has_digit)
            || (has_uppercase && has_digit))
}

fn now_unix_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn log_line_redacts_ak_and_free_text_fields() {
        let ak = "DNaL5SKp4nmULvRMJqXsSU5SydG8Clh7";
        let line = build_log_line(
            123,
            "map",
            "load_failure",
            &[
                ("baidu_ak", ak),
                ("search_keyword", "客户名称"),
                ("address", "上海市浦东新区完整地址"),
                ("note", "很长的用户备注"),
                ("code", "BAIDU_MAP_LOAD_FAILED"),
            ],
        );

        assert!(!line.contains(ak));
        assert!(!line.contains("客户名称"));
        assert!(!line.contains("完整地址"));
        assert!(!line.contains("用户备注"));
        assert!(line.contains("code=BAIDU_MAP_LOAD_FAILED"));
        assert!(line.contains(REDACTED));
    }

    #[test]
    fn log_line_redacts_ak_like_values_even_with_safe_keys() {
        let ak = "DNaL5SKp4nmULvRMJqXsSU5SydG8Clh7";
        let line = build_log_line(123, "command", "error", &[("code", ak)]);

        assert!(!line.contains(ak));
        assert!(line.contains("code=[redacted]"));
    }

    #[test]
    fn log_event_writes_sanitized_line_to_file() {
        let temp_dir = tempfile::tempdir().expect("temp dir");
        let ak = "DNaL5SKp4nmULvRMJqXsSU5SydG8Clh7";

        log_event_to_dir(
            Some(&temp_dir.path().to_path_buf()),
            "command",
            "error",
            &[("code", "DB_ERROR"), ("baidu_ak", ak)],
        );

        let log_text = std::fs::read_to_string(temp_dir.path().join(LOG_FILE_NAME))
            .expect("log file should be written");

        assert!(log_text.contains("category=command"));
        assert!(log_text.contains("event=error"));
        assert!(log_text.contains("code=DB_ERROR"));
        assert!(!log_text.contains(ak));
    }
}
