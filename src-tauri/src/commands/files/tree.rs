use git2::Repository;
use std::collections::HashMap;
use std::path::Path;

use super::git_helpers::collect_git_statuses;
use super::types::FileTreeEntry;

#[tauri::command]
pub fn get_file_tree(
    project_path: String,
) -> Result<Vec<FileTreeEntry>, String> {
    let root = Path::new(&project_path);
    if !root.exists() {
        return Err(format!("Path does not exist: {project_path}"));
    }

    let statuses = match Repository::open(root) {
        Ok(repo) => collect_git_statuses(&repo).unwrap_or_default(),
        Err(_) => HashMap::new(),
    };

    build_tree_recursive(root, root, &statuses, 0)
}

fn build_tree_recursive(
    dir: &Path,
    root: &Path,
    statuses: &HashMap<String, String>,
    depth: usize,
) -> Result<Vec<FileTreeEntry>, String> {
    if depth > 20 {
        return Ok(vec![]);
    }

    let mut entries: Vec<FileTreeEntry> = Vec::new();
    let read = std::fs::read_dir(dir)
        .map_err(|e| format!("Failed to read dir: {e}"))?;

    for item in read {
        let item = item.map_err(|e| format!("Dir entry error: {e}"))?;
        let name = item.file_name().to_string_lossy().to_string();

        if should_skip(&name) {
            continue;
        }

        let entry = build_entry(&item, root, statuses, depth)?;
        entries.push(entry);
    }

    entries.sort_by(|a, b| {
        b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name))
    });

    Ok(entries)
}

fn build_entry(
    item: &std::fs::DirEntry,
    root: &Path,
    statuses: &HashMap<String, String>,
    depth: usize,
) -> Result<FileTreeEntry, String> {
    let name = item.file_name().to_string_lossy().to_string();
    let full_path = item.path();
    let rel_path = full_path
        .strip_prefix(root)
        .unwrap_or(&full_path)
        .to_string_lossy()
        .to_string();

    let is_dir = full_path.is_dir();
    let git_status = statuses.get(&rel_path).cloned();

    let children = if is_dir {
        build_tree_recursive(&full_path, root, statuses, depth + 1)?
    } else {
        vec![]
    };

    let dir_status = if is_dir {
        infer_dir_status(&children)
    } else {
        git_status
    };

    Ok(FileTreeEntry {
        name,
        path: rel_path,
        is_dir,
        children,
        git_status: dir_status,
    })
}

fn should_skip(name: &str) -> bool {
    matches!(
        name,
        ".git"
            | "node_modules"
            | "target"
            | ".DS_Store"
            | "__pycache__"
            | ".next"
            | "dist"
            | ".turbo"
    )
}

fn infer_dir_status(children: &[FileTreeEntry]) -> Option<String> {
    let has_modified = children
        .iter()
        .any(|c| c.git_status.as_deref() == Some("modified"));
    let has_added = children
        .iter()
        .any(|c| c.git_status.as_deref() == Some("added"));
    let has_deleted = children
        .iter()
        .any(|c| c.git_status.as_deref() == Some("deleted"));

    if has_modified {
        Some("modified".to_string())
    } else if has_added {
        Some("added".to_string())
    } else if has_deleted {
        Some("deleted".to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn should_skip_git_directory() {
        assert!(should_skip(".git"));
    }

    #[test]
    fn should_skip_node_modules() {
        assert!(should_skip("node_modules"));
    }

    #[test]
    fn should_skip_target() {
        assert!(should_skip("target"));
    }

    #[test]
    fn should_skip_ds_store() {
        assert!(should_skip(".DS_Store"));
    }

    #[test]
    fn should_skip_pycache() {
        assert!(should_skip("__pycache__"));
    }

    #[test]
    fn should_skip_next() {
        assert!(should_skip(".next"));
    }

    #[test]
    fn should_skip_dist() {
        assert!(should_skip("dist"));
    }

    #[test]
    fn should_skip_turbo() {
        assert!(should_skip(".turbo"));
    }

    #[test]
    fn should_not_skip_src() {
        assert!(!should_skip("src"));
    }

    #[test]
    fn should_not_skip_regular_files() {
        assert!(!should_skip("main.rs"));
        assert!(!should_skip("package.json"));
        assert!(!should_skip("README.md"));
    }

    #[test]
    fn infer_dir_status_modified_takes_priority() {
        let children = vec![
            FileTreeEntry {
                name: "a.rs".to_string(),
                path: "a.rs".to_string(),
                is_dir: false,
                children: vec![],
                git_status: Some("modified".to_string()),
            },
            FileTreeEntry {
                name: "b.rs".to_string(),
                path: "b.rs".to_string(),
                is_dir: false,
                children: vec![],
                git_status: Some("added".to_string()),
            },
        ];

        assert_eq!(infer_dir_status(&children), Some("modified".to_string()));
    }

    #[test]
    fn infer_dir_status_added_when_no_modified() {
        let children = vec![FileTreeEntry {
            name: "new.rs".to_string(),
            path: "new.rs".to_string(),
            is_dir: false,
            children: vec![],
            git_status: Some("added".to_string()),
        }];

        assert_eq!(infer_dir_status(&children), Some("added".to_string()));
    }

    #[test]
    fn infer_dir_status_deleted_when_no_modified_or_added() {
        let children = vec![FileTreeEntry {
            name: "old.rs".to_string(),
            path: "old.rs".to_string(),
            is_dir: false,
            children: vec![],
            git_status: Some("deleted".to_string()),
        }];

        assert_eq!(infer_dir_status(&children), Some("deleted".to_string()));
    }

    #[test]
    fn infer_dir_status_none_for_clean_children() {
        let children = vec![FileTreeEntry {
            name: "clean.rs".to_string(),
            path: "clean.rs".to_string(),
            is_dir: false,
            children: vec![],
            git_status: None,
        }];

        assert_eq!(infer_dir_status(&children), None);
    }

    #[test]
    fn infer_dir_status_none_for_empty() {
        assert_eq!(infer_dir_status(&[]), None);
    }

    #[test]
    fn get_file_tree_returns_error_for_nonexistent_path() {
        let result = get_file_tree("/nonexistent/path/abc123".to_string());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("does not exist"));
    }

    #[test]
    fn get_file_tree_sorts_dirs_before_files() {
        let temp = std::env::temp_dir().join(format!(
            "central_tree_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        std::fs::write(temp.join("b_file.txt"), "content").unwrap();
        std::fs::write(temp.join("a_file.txt"), "content").unwrap();
        std::fs::create_dir_all(temp.join("z_dir")).unwrap();

        let tree = get_file_tree(temp.to_string_lossy().to_string()).unwrap();

        // Directories should come first
        assert!(tree[0].is_dir, "First entry should be a directory");
        // Files should be sorted alphabetically
        let file_names: Vec<&str> = tree
            .iter()
            .filter(|e| !e.is_dir)
            .map(|e| e.name.as_str())
            .collect();
        assert_eq!(file_names, vec!["a_file.txt", "b_file.txt"]);

        // Cleanup
        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn get_file_tree_skips_hidden_dirs() {
        let temp = std::env::temp_dir().join(format!(
            "central_skip_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(temp.join("node_modules")).unwrap();
        std::fs::create_dir_all(temp.join(".git")).unwrap();
        std::fs::create_dir_all(temp.join("src")).unwrap();
        std::fs::write(temp.join("src").join("main.rs"), "fn main() {}").unwrap();

        let tree = get_file_tree(temp.to_string_lossy().to_string()).unwrap();
        let names: Vec<&str> = tree.iter().map(|e| e.name.as_str()).collect();

        assert!(names.contains(&"src"));
        assert!(!names.contains(&"node_modules"));
        assert!(!names.contains(&".git"));

        std::fs::remove_dir_all(&temp).unwrap();
    }
}
