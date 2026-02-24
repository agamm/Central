use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct DiscoveredDir {
    pub name: String,
    pub path: String,
}

/// Scan a set of root directories for subdirectories that look like projects.
/// Returns a flat sorted list of `{ name, path }` entries.
#[tauri::command]
pub fn list_project_directories() -> Vec<DiscoveredDir> {
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return vec![],
    };

    // Scan these roots for immediate subdirectories
    let roots: Vec<PathBuf> = vec![
        home.join("dev"),
        home.join("Developer"),
        home.join("projects"),
        home.join("src"),
        home.join("code"),
        home.join("workspace"),
        home.join("repos"),
        home.join("Desktop"),
        home.join("Documents"),
    ];

    let mut results: Vec<DiscoveredDir> = Vec::new();

    for root in &roots {
        if !root.is_dir() {
            continue;
        }
        if let Ok(entries) = std::fs::read_dir(root) {
            for entry in entries.flatten() {
                if !entry.path().is_dir() {
                    continue;
                }
                let name = entry.file_name().to_string_lossy().to_string();
                // Skip hidden dirs and common non-project dirs
                if name.starts_with('.') || name == "node_modules" || name == "target" {
                    continue;
                }
                let path = entry.path().to_string_lossy().to_string();
                results.push(DiscoveredDir { name, path });
            }
        }
    }

    results.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    results.dedup_by(|a, b| a.path == b.path);
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_project_directories_returns_vec() {
        // Should not panic, may return empty if no ~/dev etc.
        let result = list_project_directories();
        // All entries should have non-empty name and path
        for entry in &result {
            assert!(!entry.name.is_empty());
            assert!(!entry.path.is_empty());
        }
    }
}
