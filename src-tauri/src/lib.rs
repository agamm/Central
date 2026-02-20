use tauri::Manager;
use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

mod commands;
mod sidecar;

fn create_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../migrations/001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
    ]
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
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let sidecar_handle = sidecar::create_sidecar_handle(handle);
            app.manage(sidecar_handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::agents::start_agent_session,
            commands::agents::send_agent_message,
            commands::agents::abort_agent_session,
            commands::agents::list_agent_sessions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Central");
}
