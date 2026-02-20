use git2::{DiffOptions, Repository};
use std::path::Path;

use super::types::{DiffHunk, DiffLine, FileDiff};

#[tauri::command]
pub fn get_diff(
    project_path: String,
    file_path: Option<String>,
) -> Result<Vec<FileDiff>, String> {
    let root = Path::new(&project_path);
    let repo = Repository::open(root)
        .map_err(|e| format!("Not a git repository: {e}"))?;

    let mut opts = DiffOptions::new();
    if let Some(ref fp) = file_path {
        opts.pathspec(fp);
    }

    let head_tree = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_tree().ok());

    let diff = repo
        .diff_tree_to_workdir_with_index(
            head_tree.as_ref(),
            Some(&mut opts),
        )
        .map_err(|e| format!("Failed to get diff: {e}"))?;

    collect_diff_output(&diff)
}

fn collect_diff_output(
    diff: &git2::Diff,
) -> Result<Vec<FileDiff>, String> {
    let mut result: Vec<FileDiff> = Vec::new();

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        let path = delta
            .new_file()
            .path()
            .or_else(|| delta.old_file().path())
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_default();

        let file_diff =
            find_or_create_file_diff(&mut result, &path);

        if let Some(h) = hunk {
            maybe_add_hunk(file_diff, &h);
        }

        if let Some(current_hunk) = file_diff.hunks.last_mut() {
            append_diff_line(current_hunk, &line);
        }

        true
    })
    .map_err(|e| format!("Failed to print diff: {e}"))?;

    Ok(result)
}

fn find_or_create_file_diff<'a>(
    result: &'a mut Vec<FileDiff>,
    path: &str,
) -> &'a mut FileDiff {
    let idx = result.iter().position(|f| f.path == path);
    match idx {
        Some(i) => &mut result[i],
        None => {
            result.push(FileDiff {
                path: path.to_string(),
                hunks: vec![],
            });
            result.last_mut().unwrap()
        }
    }
}

fn maybe_add_hunk(
    file_diff: &mut FileDiff,
    hunk: &git2::DiffHunk,
) {
    let header =
        String::from_utf8_lossy(hunk.header()).trim().to_string();

    let already_exists = file_diff
        .hunks
        .last()
        .map(|lh| lh.header == header)
        .unwrap_or(false);

    if !already_exists {
        file_diff.hunks.push(DiffHunk {
            header,
            lines: vec![],
        });
    }
}

fn append_diff_line(
    hunk: &mut DiffHunk,
    line: &git2::DiffLine,
) {
    let origin = match line.origin() {
        '+' => "add",
        '-' => "del",
        _ => "ctx",
    };

    hunk.lines.push(DiffLine {
        content: String::from_utf8_lossy(line.content()).to_string(),
        origin: origin.to_string(),
        old_lineno: line.old_lineno(),
        new_lineno: line.new_lineno(),
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_or_create_file_diff_creates_new() {
        let mut result: Vec<FileDiff> = vec![];
        let fd = find_or_create_file_diff(&mut result, "src/main.rs");

        assert_eq!(fd.path, "src/main.rs");
        assert!(fd.hunks.is_empty());
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn find_or_create_file_diff_returns_existing() {
        let mut result = vec![FileDiff {
            path: "src/main.rs".to_string(),
            hunks: vec![DiffHunk {
                header: "@@ -1 +1 @@".to_string(),
                lines: vec![],
            }],
        }];

        let fd = find_or_create_file_diff(&mut result, "src/main.rs");

        assert_eq!(fd.hunks.len(), 1);
        assert_eq!(result.len(), 1);
    }

    #[test]
    fn find_or_create_tracks_multiple_files() {
        let mut result: Vec<FileDiff> = vec![];

        find_or_create_file_diff(&mut result, "a.rs");
        find_or_create_file_diff(&mut result, "b.rs");
        find_or_create_file_diff(&mut result, "a.rs");

        assert_eq!(result.len(), 2);
    }

    #[test]
    fn get_diff_fails_for_non_repo() {
        let temp = std::env::temp_dir().join(format!(
            "central_diff_test_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();

        let result = get_diff(temp.to_string_lossy().to_string(), None);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a git repository"));

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn get_diff_returns_empty_for_clean_repo() {
        let temp = std::env::temp_dir().join(format!(
            "central_diff_clean_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let repo = Repository::init(&temp).unwrap();

        // Create initial commit
        let sig = git2::Signature::now("test", "test@test.com").unwrap();
        let tree_id = repo.index().unwrap().write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
            .unwrap();

        let result = get_diff(temp.to_string_lossy().to_string(), None);
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());

        std::fs::remove_dir_all(&temp).unwrap();
    }

    #[test]
    fn get_diff_detects_new_file() {
        let temp = std::env::temp_dir().join(format!(
            "central_diff_new_{}",
            uuid::Uuid::new_v4()
        ));
        std::fs::create_dir_all(&temp).unwrap();
        let repo = Repository::init(&temp).unwrap();

        // Create initial commit
        let sig = git2::Signature::now("test", "test@test.com").unwrap();
        let tree_id = repo.index().unwrap().write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "init", &tree, &[])
            .unwrap();

        // Add a new file (staged via index)
        std::fs::write(temp.join("new.txt"), "hello\n").unwrap();
        let mut index = repo.index().unwrap();
        index
            .add_path(std::path::Path::new("new.txt"))
            .unwrap();
        index.write().unwrap();

        let result = get_diff(temp.to_string_lossy().to_string(), None);
        assert!(result.is_ok());
        let diffs = result.unwrap();
        assert!(!diffs.is_empty());
        assert_eq!(diffs[0].path, "new.txt");

        std::fs::remove_dir_all(&temp).unwrap();
    }
}
