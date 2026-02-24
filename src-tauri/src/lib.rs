use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod commands;
mod debug_log;
mod notifications;
mod pty;
mod sidecar;

fn create_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add_session_type",
            sql: include_str!("../migrations/002_add_session_type.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

/// Clean up all child processes to prevent orphans on app quit
fn cleanup_on_exit(app_handle: &tauri::AppHandle) {
    // Shut down the sidecar (kills the Node.js process + all agent sessions)
    if let Some(sidecar) = app_handle.try_state::<sidecar::SidecarHandle>() {
        if let Ok(mut manager) = sidecar.lock() {
            manager.shutdown();
        }
    }

    // Shut down all PTY sessions
    if let Some(pty_handle) = app_handle.try_state::<pty::PtyHandle>() {
        if let Ok(mut manager) = pty_handle.lock() {
            manager.shutdown();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = create_migrations();

    tauri::Builder::default()
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:central.db", migrations)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            debug_log::init_log_path();
            debug_log::log("RUST", "Tauri app starting up");

            let handle = app.handle().clone();
            let sidecar_handle = sidecar::create_sidecar_handle(handle);
            app.manage(sidecar_handle);

            let pty_handle = pty::create_pty_handle();
            app.manage(pty_handle);

            debug_log::log("RUST", "Sidecar + PTY handles created and managed");

            if let Err(e) = notifications::init() {
                debug_log::log("RUST", &format!("Notification init failed: {e}"));
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Clean up when the last window is destroyed
            if let tauri::WindowEvent::Destroyed = event {
                cleanup_on_exit(window.app_handle());
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::agents::start_agent_session,
            commands::agents::send_agent_message,
            commands::agents::abort_agent_session,
            commands::agents::end_agent_session,
            commands::agents::respond_tool_approval,
            commands::agents::list_agent_sessions,
            commands::files::tree::get_file_tree,
            commands::files::status::get_git_status,
            commands::files::status::get_file_content,
            commands::files::status::write_file,
            commands::files::diff::get_diff,
            commands::files::discover::list_project_directories,
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::notifications::send_native_notification,
            commands::terminal::start_terminal,
            commands::terminal::write_terminal_input,
            commands::terminal::resize_terminal,
            commands::terminal::close_terminal,
            debug_log::debug_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Central");
}
