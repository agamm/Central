use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

use tauri::Manager;

use crate::debug_log;

/// Resolve the settings.json path inside the app data directory.
fn settings_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to resolve app data dir: {e}"))?;

    if !data_dir.exists() {
        fs::create_dir_all(&data_dir)
            .map_err(|e| format!("Failed to create app data dir: {e}"))?;
    }

    Ok(data_dir.join("settings.json"))
}

/// Read the entire settings map from disk.
fn read_settings(path: &PathBuf) -> Result<HashMap<String, String>, String> {
    if !path.exists() {
        return Ok(HashMap::new());
    }

    let contents =
        fs::read_to_string(path).map_err(|e| format!("Failed to read settings file: {e}"))?;

    serde_json::from_str(&contents).map_err(|e| format!("Failed to parse settings JSON: {e}"))
}

/// Write the entire settings map to disk.
fn write_settings(path: &PathBuf, map: &HashMap<String, String>) -> Result<(), String> {
    let json = serde_json::to_string_pretty(map)
        .map_err(|e| format!("Failed to serialize settings: {e}"))?;

    fs::write(path, json).map_err(|e| format!("Failed to write settings file: {e}"))
}

/// Read a single setting by key.
#[tauri::command]
pub fn get_setting(app: tauri::AppHandle, key: String) -> Result<Option<String>, String> {
    let path = settings_file_path(&app)?;
    let map = read_settings(&path)?;
    let value = map.get(&key).cloned();

    debug_log::log(
        "SETTINGS",
        &format!("get_setting key={key} found={}", value.is_some()),
    );

    Ok(value)
}

/// Write a single setting by key.
#[tauri::command]
pub fn set_setting(app: tauri::AppHandle, key: String, value: String) -> Result<(), String> {
    let path = settings_file_path(&app)?;
    let mut map = read_settings(&path)?;

    map.insert(key.clone(), value);
    write_settings(&path, &map)?;

    debug_log::log("SETTINGS", &format!("set_setting key={key} written"));

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_settings_nonexistent_returns_empty() {
        let path = PathBuf::from("/tmp/_central_test_nonexistent.json");
        let result = read_settings(&path).unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn read_write_roundtrip() {
        let path = PathBuf::from("/tmp/_central_test_settings_roundtrip.json");

        let mut map = HashMap::new();
        map.insert("foo".to_string(), "bar".to_string());

        write_settings(&path, &map).unwrap();

        let loaded = read_settings(&path).unwrap();
        assert_eq!(loaded.get("foo").unwrap(), "bar");

        // Clean up
        let _ = fs::remove_file(&path);
    }
}
