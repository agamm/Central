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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_git_status_fails_for_non_repo() {
        let temp = std::env::temp_dir().join(format!(
            "central_status_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();

        let result = get_git_status(temp.to_string_lossy().to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a git repository"));

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn get_git_status_returns_valid_info() {
        let temp = std::env::temp_dir().join(format!(
            "central_status_info_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let repo = Repository::open(Path::new(
            &{
                let r = git2::Repository::init(&temp).unwrap();
                // Create initial commit
                let sig = git2::Signature::now("test", "t@t.com").unwrap();
                let tree_id = r.index().unwrap().write_tree().unwrap();
                let tree = r.find_tree(tree_id).unwrap();
                r.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
                    .unwrap();
                temp.to_string_lossy().to_string()
            },
        ))
        .unwrap();

        let result = get_git_status(
            repo.workdir().unwrap().to_string_lossy().to_string(),
        );
        assert!(result.is_ok());

        let info = result.unwrap();
        assert!(info.is_repo);
        assert!(info.branch == "main" || info.branch == "master");
        assert_eq!(info.ahead, 0);
        assert_eq!(info.behind, 0);

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn get_file_content_reads_file() {
        let temp = std::env::temp_dir().join(format!(
            "central_content_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        std::fs::write(temp.join("hello.txt"), "world").unwrap();

        let result = get_file_content(
            temp.to_string_lossy().to_string(),
            "hello.txt".to_string(),
        );
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "world");

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn get_file_content_returns_error_for_missing() {
        let temp = std::env::temp_dir().join(format!(
            "central_content_missing_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();

        let result = get_file_content(
            temp.to_string_lossy().to_string(),
            "nonexistent.txt".to_string(),
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("File not found"));

        std::fs::remove_dir_all(&temp).unwrap();
    }
}
