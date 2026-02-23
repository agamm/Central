#[tauri::command]
pub fn send_native_notification(
    title: String,
    body: String,
    session_id: String,
) -> Result<(), String> {
    crate::notifications::send(&title, &body, &session_id)
}
