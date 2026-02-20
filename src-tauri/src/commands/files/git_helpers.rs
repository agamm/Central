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

#[cfg(test)]
mod tests {
    use super::*;
    use git2::Status;

    #[test]
    fn status_to_label_new_workdir() {
        assert_eq!(status_to_label(Status::WT_NEW), "added");
    }

    #[test]
    fn status_to_label_new_index() {
        assert_eq!(status_to_label(Status::INDEX_NEW), "added");
    }

    #[test]
    fn status_to_label_deleted_workdir() {
        assert_eq!(status_to_label(Status::WT_DELETED), "deleted");
    }

    #[test]
    fn status_to_label_deleted_index() {
        assert_eq!(status_to_label(Status::INDEX_DELETED), "deleted");
    }

    #[test]
    fn status_to_label_modified_workdir() {
        assert_eq!(status_to_label(Status::WT_MODIFIED), "modified");
    }

    #[test]
    fn status_to_label_modified_index() {
        assert_eq!(status_to_label(Status::INDEX_MODIFIED), "modified");
    }

    #[test]
    fn status_to_label_renamed_workdir() {
        assert_eq!(status_to_label(Status::WT_RENAMED), "renamed");
    }

    #[test]
    fn status_to_label_renamed_index() {
        assert_eq!(status_to_label(Status::INDEX_RENAMED), "renamed");
    }

    #[test]
    fn status_to_label_conflicted() {
        assert_eq!(status_to_label(Status::CONFLICTED), "conflicted");
    }

    #[test]
    fn status_to_label_unknown_for_ignored() {
        assert_eq!(status_to_label(Status::IGNORED), "unknown");
    }

    #[test]
    fn status_priority_new_over_modified() {
        // When both NEW and MODIFIED flags are set, "added" wins
        let combined = Status::WT_NEW | Status::WT_MODIFIED;
        assert_eq!(status_to_label(combined), "added");
    }

    #[test]
    fn collect_git_statuses_on_test_repo() {
        let temp = tempdir_with_git_repo();
        let repo = Repository::open(&temp).unwrap();

        // Create an untracked file
        std::fs::write(temp.join("new_file.txt"), "hello").unwrap();

        let statuses = collect_git_statuses(&repo).unwrap();
        assert!(statuses.contains_key("new_file.txt"));
        assert_eq!(statuses["new_file.txt"], "added");
    }

    #[test]
    fn get_branch_name_returns_main_or_master() {
        let temp = tempdir_with_git_repo();
        let repo = Repository::open(&temp).unwrap();

        let branch = get_branch_name(&repo);
        // Initial branch is typically "main" or "master"
        assert!(
            branch == "main" || branch == "master",
            "Expected main or master, got: {branch}"
        );
    }

    #[test]
    fn get_ahead_behind_zero_for_local_only() {
        let temp = tempdir_with_git_repo();
        let repo = Repository::open(&temp).unwrap();

        let (ahead, behind) = get_ahead_behind(&repo);
        // No remote configured, should be (0, 0)
        assert_eq!(ahead, 0);
        assert_eq!(behind, 0);
    }

    #[test]
    fn get_changed_files_includes_untracked() {
        let temp = tempdir_with_git_repo();
        let repo = Repository::open(&temp).unwrap();

        std::fs::write(temp.join("untracked.rs"), "fn main() {}").unwrap();

        let files = get_changed_files(&repo).unwrap();
        let paths: Vec<&str> = files.iter().map(|f| f.path.as_str()).collect();
        assert!(paths.contains(&"untracked.rs"));
    }

    #[test]
    fn get_changed_files_detects_modification() {
        let temp = tempdir_with_git_repo();
        let repo = Repository::open(&temp).unwrap();

        // Create and commit a file
        let file_path = temp.join("tracked.txt");
        std::fs::write(&file_path, "original").unwrap();
        commit_file(&repo, "tracked.txt", "initial commit");

        // Modify the file
        std::fs::write(&file_path, "modified content").unwrap();

        let files = get_changed_files(&repo).unwrap();
        let modified = files.iter().find(|f| f.path == "tracked.txt");
        assert!(modified.is_some());
        assert_eq!(modified.unwrap().status, "modified");
    }

    /// Create a temporary directory with an initialized git repo
    fn tempdir_with_git_repo() -> std::path::PathBuf {
        let temp = std::env::temp_dir().join(format!(
            "central_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        Repository::init(&temp).unwrap();

        // Create initial commit so HEAD exists
        let repo = Repository::open(&temp).unwrap();
        let sig = repo.signature().unwrap_or_else(|_| {
            git2::Signature::now("test", "test@example.com").unwrap()
        });
        let tree_id = repo.index().unwrap().write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
            .unwrap();

        temp
    }

    /// Helper: stage and commit a file
    fn commit_file(repo: &Repository, path: &str, msg: &str) {
        let mut index = repo.index().unwrap();
        index
            .add_path(std::path::Path::new(path))
            .unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = repo.signature().unwrap_or_else(|_| {
            git2::Signature::now("test", "test@example.com").unwrap()
        });
        let parent = repo.head().unwrap().peel_to_commit().unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, msg, &tree, &[&parent])
            .unwrap();
    }
}
