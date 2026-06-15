mod backup;
mod cities;
mod db;
mod errors;
mod logging;
mod markers;
mod projects;
mod settings;
mod tags;
mod taxonomy;
#[allow(dead_code)]
mod validation;

use serde::Serialize;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder},
    Emitter, Manager,
};

use db::{AppRuntimeState, BootstrapStatus};
use errors::AppError;

const ACTION_PROJECT_NEW: &str = "project.new";
const ACTION_SEARCH_FOCUS: &str = "search.focus";
const ACTION_CHANGES_SAVE: &str = "changes.save";
const ACTION_MODE_CANCEL: &str = "mode.cancel";
const ACTION_SELECTION_DELETE: &str = "selection.delete";
const ACTION_VIEW_OVERVIEW: &str = "view.overview";
const ACTION_VIEW_SETTINGS: &str = "view.settings";
const ACTION_HELP_ABOUT: &str = "help.about";
const MENU_ACTION_EVENT: &str = "mapx-menu-action";

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct MenuActionPayload {
    action_id: &'static str,
}

#[tauri::command]
fn health_check() -> &'static str {
    "ok"
}

#[tauri::command]
fn get_bootstrap_status(state: tauri::State<AppRuntimeState>) -> BootstrapStatus {
    let _pool_available = state.pool.is_some();
    state.bootstrap_status.clone()
}

#[tauri::command]
fn structured_error_example(kind: &str) -> Result<&'static str, AppError> {
    match kind {
        "validation" => Err(AppError::validation("名称不能为空。")),
        "db" => Err(AppError::from(sqlx::Error::RowNotFound)),
        "project" => Err(AppError::project_not_found()),
        _ => Ok("ok"),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            logging::log_app_event(app.handle(), "startup", &[]);
            let bootstrap_result =
                tauri::async_runtime::block_on(db::bootstrap_database(app.handle()));
            let runtime_state = match bootstrap_result {
                Ok(database) => {
                    logging::log_app_event(app.handle(), "startup_ready", &[]);
                    AppRuntimeState {
                        bootstrap_status: BootstrapStatus::ready(database.database_path),
                        pool: Some(database.pool),
                    }
                }
                Err(message) => {
                    logging::log_app_event(app.handle(), "startup_failed", &[]);
                    AppRuntimeState {
                        bootstrap_status: BootstrapStatus::failed(message),
                        pool: None,
                    }
                }
            };

            app.manage(runtime_state);

            let menu = MenuBuilder::new(app)
                .item(&build_app_menu(app)?)
                .item(&build_file_menu(app)?)
                .item(&build_edit_menu(app)?)
                .item(&build_view_menu(app)?)
                .item(&build_help_menu(app)?)
                .build()?;

            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            if let Some(action_id) = menu_id_to_action(event.id().as_ref()) {
                let _ = app.emit(MENU_ACTION_EVENT, MenuActionPayload { action_id });
            }
        })
        .invoke_handler(tauri::generate_handler![
            settings::complete_first_launch,
            settings::get_app_info,
            settings::get_backup_info,
            settings::get_first_launch_settings,
            settings::open_backup_directory,
            settings::open_data_directory,
            settings::open_log_directory,
            logging::record_command_error,
            logging::record_map_load_failure,
            settings::update_baidu_ak,
            settings::update_default_city,
            projects::create_project,
            projects::get_project_workspace,
            projects::rename_project,
            projects::select_project_workspace,
            projects::soft_delete_project,
            projects::update_project_map_layer,
            projects::update_project_search_city,
            markers::create_marker,
            markers::list_project_markers,
            markers::move_marker,
            markers::search_project_markers,
            markers::soft_delete_marker,
            markers::update_marker,
            tags::create_tag,
            tags::list_project_tags,
            tags::soft_delete_tag,
            tags::update_tag,
            taxonomy::create_category,
            taxonomy::list_project_categories,
            taxonomy::soft_delete_category,
            taxonomy::update_category,
            health_check,
            get_bootstrap_status,
            structured_error_example
        ])
        .run(tauri::generate_context!())
        .expect("failed to run MapX");
}

fn build_app_menu<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
) -> tauri::Result<tauri::menu::Submenu<R>> {
    SubmenuBuilder::new(manager, "MapX")
        .about(None)
        .separator()
        .quit()
        .build()
}

fn build_file_menu<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
) -> tauri::Result<tauri::menu::Submenu<R>> {
    let new_project = MenuItemBuilder::with_id(ACTION_PROJECT_NEW, "新建项目")
        .accelerator("CmdOrCtrl+N")
        .build(manager)?;
    let save = MenuItemBuilder::with_id(ACTION_CHANGES_SAVE, "保存")
        .accelerator("CmdOrCtrl+S")
        .build(manager)?;

    SubmenuBuilder::new(manager, "File")
        .item(&new_project)
        .item(&save)
        .build()
}

fn build_edit_menu<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
) -> tauri::Result<tauri::menu::Submenu<R>> {
    let search = MenuItemBuilder::with_id(ACTION_SEARCH_FOCUS, "搜索")
        .accelerator("CmdOrCtrl+F")
        .build(manager)?;
    let cancel = MenuItemBuilder::with_id(ACTION_MODE_CANCEL, "取消当前模式")
        .accelerator("Esc")
        .build(manager)?;
    let delete = MenuItemBuilder::with_id(ACTION_SELECTION_DELETE, "删除选中项")
        .accelerator("Delete")
        .build(manager)?;

    SubmenuBuilder::new(manager, "Edit")
        .item(&search)
        .item(&cancel)
        .item(&delete)
        .build()
}

fn build_view_menu<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
) -> tauri::Result<tauri::menu::Submenu<R>> {
    let overview = MenuItemBuilder::with_id(ACTION_VIEW_OVERVIEW, "项目概览").build(manager)?;
    let settings = MenuItemBuilder::with_id(ACTION_VIEW_SETTINGS, "设置").build(manager)?;

    SubmenuBuilder::new(manager, "View")
        .item(&overview)
        .item(&settings)
        .build()
}

fn build_help_menu<R: tauri::Runtime, M: tauri::Manager<R>>(
    manager: &M,
) -> tauri::Result<tauri::menu::Submenu<R>> {
    let about = MenuItemBuilder::with_id(ACTION_HELP_ABOUT, "关于 MapX").build(manager)?;

    SubmenuBuilder::new(manager, "Help").item(&about).build()
}

fn menu_id_to_action(menu_id: &str) -> Option<&'static str> {
    match menu_id {
        ACTION_PROJECT_NEW => Some(ACTION_PROJECT_NEW),
        ACTION_SEARCH_FOCUS => Some(ACTION_SEARCH_FOCUS),
        ACTION_CHANGES_SAVE => Some(ACTION_CHANGES_SAVE),
        ACTION_MODE_CANCEL => Some(ACTION_MODE_CANCEL),
        ACTION_SELECTION_DELETE => Some(ACTION_SELECTION_DELETE),
        ACTION_VIEW_OVERVIEW => Some(ACTION_VIEW_OVERVIEW),
        ACTION_VIEW_SETTINGS => Some(ACTION_VIEW_SETTINGS),
        ACTION_HELP_ABOUT => Some(ACTION_HELP_ABOUT),
        _ => None,
    }
}
