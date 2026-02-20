use git2::{Repository, StatusOptions, StatusShow};
use std::collections::HashMap;

use super::types::ChangedFile;

pub fn collect_git_statuses(
    repo: &Repository,
) -> Result<HashMap<String, String>, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .show(StatusShow::IndexAndWorkdir);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get git statuses: {e}"))?;

    let mut map = HashMap::new();
    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();
        let label = status_to_label(status);
        map.insert(path, label);
    }

    Ok(map)
}

pub fn status_to_label(status: git2::Status) -> String {
    if status.contains(git2::Status::WT_NEW)
        || status.contains(git2::Status::INDEX_NEW)
    {
        "added".to_string()
    } else if status.contains(git2::Status::WT_DELETED)
        || status.contains(git2::Status::INDEX_DELETED)
    {
        "deleted".to_string()
    } else if status.contains(git2::Status::WT_MODIFIED)
        || status.contains(git2::Status::INDEX_MODIFIED)
    {
        "modified".to_string()
    } else if status.contains(git2::Status::WT_RENAMED)
        || status.contains(git2::Status::INDEX_RENAMED)
    {
        "renamed".to_string()
    } else if status.contains(git2::Status::CONFLICTED) {
        "conflicted".to_string()
    } else {
        "unknown".to_string()
    }
}

pub fn get_branch_name(repo: &Repository) -> String {
    repo.head()
        .ok()
        .and_then(|h| h.shorthand().map(String::from))
        .unwrap_or_else(|| "HEAD (detached)".to_string())
}

pub fn get_ahead_behind(repo: &Repository) -> (usize, usize) {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return (0, 0),
    };

    let local_oid = match head.target() {
        Some(oid) => oid,
        None => return (0, 0),
    };

    let branch_name = match head.shorthand() {
        Some(name) => name.to_string(),
        None => return (0, 0),
    };

    let upstream = format!("origin/{branch_name}");
    let remote_ref = match repo.revparse_single(&upstream) {
        Ok(obj) => obj.id(),
        Err(_) => return (0, 0),
    };

    repo.graph_ahead_behind(local_oid, remote_ref)
        .unwrap_or((0, 0))
}

pub fn get_changed_files(
    repo: &Repository,
) -> Result<Vec<ChangedFile>, String> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .show(StatusShow::IndexAndWorkdir);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to get statuses: {e}"))?;

    let files: Vec<ChangedFile> = statuses
        .iter()
        .filter_map(|entry| {
            let path = entry.path()?.to_string();
            let status = status_to_label(entry.status());
            Some(ChangedFile { path, status })
        })
        .collect();

    Ok(files)
}
