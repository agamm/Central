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
