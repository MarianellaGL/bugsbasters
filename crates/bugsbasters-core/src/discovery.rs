use ignore::WalkBuilder;
use rayon::prelude::*;
use std::path::{Path, PathBuf};

/// Patterns for test files
const TEST_PATTERNS: &[&str] = &[
    ".test.ts",
    ".test.js",
    ".test.tsx",
    ".test.jsx",
    ".spec.ts",
    ".spec.js",
    ".spec.tsx",
    ".spec.jsx",
];

/// Directories to ignore during discovery
const IGNORE_DIRS: &[&str] = &["node_modules", ".git", "dist", "build", "coverage", ".next"];

/// Discover test files in a directory
pub fn discover_test_files(root: &Path, pattern: Option<&str>) -> Vec<PathBuf> {
    let walker = WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .filter_entry(|entry| {
            let path = entry.path();
            if path.is_dir() {
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    return !IGNORE_DIRS.contains(&name);
                }
            }
            true
        })
        .build();

    let files: Vec<PathBuf> = walker
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.file_type().map(|ft| ft.is_file()).unwrap_or(false))
        .map(|entry| entry.path().to_path_buf())
        .filter(|path| is_test_file(path, pattern))
        .collect();

    files
}

/// Discover test files in parallel (for large codebases)
pub fn discover_test_files_parallel(root: &Path, pattern: Option<&str>) -> Vec<PathBuf> {
    let walker = WalkBuilder::new(root)
        .hidden(true)
        .git_ignore(true)
        .threads(num_cpus())
        .build_parallel();

    let files = std::sync::Mutex::new(Vec::new());
    let pattern = pattern.map(|p| p.to_string());

    walker.run(|| {
        let files = &files;
        let pattern = pattern.clone();
        Box::new(move |entry| {
            if let Ok(entry) = entry {
                let path = entry.path();

                // Skip ignored directories
                if path.is_dir() {
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if IGNORE_DIRS.contains(&name) {
                            return ignore::WalkState::Skip;
                        }
                    }
                }

                // Check if it's a test file
                if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
                    if is_test_file(path, pattern.as_deref()) {
                        files.lock().unwrap().push(path.to_path_buf());
                    }
                }
            }
            ignore::WalkState::Continue
        })
    });

    files.into_inner().unwrap()
}

/// Check if a file is a test file
fn is_test_file(path: &Path, pattern: Option<&str>) -> bool {
    let path_str = path.to_string_lossy();

    // Check custom pattern first
    if let Some(pat) = pattern {
        return path_str.contains(pat);
    }

    // Check standard test patterns
    TEST_PATTERNS.iter().any(|p| path_str.ends_with(p))
}

/// Get the number of CPUs for parallel processing
fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_test_file() {
        assert!(is_test_file(Path::new("foo.test.ts"), None));
        assert!(is_test_file(Path::new("bar.spec.js"), None));
        assert!(!is_test_file(Path::new("foo.ts"), None));
        assert!(is_test_file(Path::new("foo.ts"), Some("foo")));
    }
}
