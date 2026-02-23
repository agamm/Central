pub fn init() -> Result<(), String> {
    crate::debug_log::log("NOTIFY", "Notification system initialized (osascript)");
    Ok(())
}

pub fn send(title: &str, body: &str, _session_id: &str) -> Result<(), String> {
    let title = title.replace('\\', "\\\\").replace('"', "\\\"");
    let body = body.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        "display notification \"{}\" with title \"{}\"",
        body, title,
    );

    std::process::Command::new("/usr/bin/osascript")
        .args(["-e", &script])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| format!("osascript failed: {e}"))?;

    Ok(())
}
