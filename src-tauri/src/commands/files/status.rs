use git2::Repository;
use std::path::Path;

use super::git_helpers::{
    get_ahead_behind, get_branch_name, get_changed_files,
};
use super::types::GitStatusInfo;

#[tauri::command]
pub fn get_git_status(
    project_path: String,
) -> Result<GitStatusInfo, String> {
    let root = Path::new(&project_path);
    let repo = Repository::open(root)
        .map_err(|e| format!("Not a git repository: {e}"))?;

    let branch = get_branch_name(&repo);
    let (ahead, behind) = get_ahead_behind(&repo);
    let changed_files = get_changed_files(&repo)?;

    Ok(GitStatusInfo {
        branch,
        ahead,
        behind,
        is_repo: true,
        changed_files,
    })
}

#[tauri::command]
pub fn get_file_content(
    project_path: String,
    file_path: String,
) -> Result<String, String> {
    let full = Path::new(&project_path).join(&file_path);

    if !full.exists() {
        return Err(format!("File not found: {file_path}"));
    }

    std::fs::read_to_string(&full)
        .map_err(|e| format!("Failed to read file: {e}"))
}
