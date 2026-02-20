pub mod agents;
pub mod files;

#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Central.", name)
}
