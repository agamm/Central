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
