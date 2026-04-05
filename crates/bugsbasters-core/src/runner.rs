use crate::types::{RunnerConfig, TestError, TestResult, TestStatus, TestSummary};
use rayon::prelude::*;
use std::time::{Duration, Instant};

/// Callback type for running a single test
pub type TestCallback = Box<dyn Fn(&str, &str) -> TestResult + Send + Sync>;

/// Test runner with parallel execution support
pub struct TestRunner {
    config: RunnerConfig,
}

impl TestRunner {
    pub fn new(config: RunnerConfig) -> Self {
        Self { config }
    }

    /// Run tests with a callback for each test
    pub fn run_with_callback<F>(&self, tests: Vec<(String, String)>, callback: F) -> TestSummary
    where
        F: Fn(&str, &str) -> TestResult + Send + Sync,
    {
        let mut summary = TestSummary::new();
        let start = Instant::now();

        if self.config.parallel {
            let results: Vec<TestResult> = tests
                .par_iter()
                .map(|(name, file)| callback(name, file))
                .collect();

            for result in results {
                summary.add_result(result);
            }
        } else {
            for (name, file) in tests {
                let result = callback(&name, &file);
                summary.add_result(result);
            }
        }

        summary.duration = start.elapsed();
        summary
    }

    /// Create a test result for a passed test
    pub fn passed(name: &str, file: &str, duration: Duration) -> TestResult {
        TestResult {
            name: name.to_string(),
            file_path: file.to_string(),
            status: TestStatus::Passed,
            duration,
            error: None,
        }
    }

    /// Create a test result for a failed test
    pub fn failed(
        name: &str,
        file: &str,
        duration: Duration,
        message: &str,
        expected: Option<String>,
        received: Option<String>,
    ) -> TestResult {
        TestResult {
            name: name.to_string(),
            file_path: file.to_string(),
            status: TestStatus::Failed,
            duration,
            error: Some(TestError {
                message: message.to_string(),
                expected,
                received,
                diff: None,
                stack: None,
            }),
        }
    }

    /// Create a test result for a skipped test
    pub fn skipped(name: &str, file: &str) -> TestResult {
        TestResult {
            name: name.to_string(),
            file_path: file.to_string(),
            status: TestStatus::Skipped,
            duration: Duration::ZERO,
            error: None,
        }
    }
}

/// CI environment detection
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum CIEnvironment {
    GitHubActions,
    GitLabCI,
    CircleCI,
    Jenkins,
    TravisCI,
    AzurePipelines,
    Buildkite,
    Unknown,
    None,
}

impl CIEnvironment {
    /// Detect the current CI environment
    pub fn detect() -> Self {
        if std::env::var("GITHUB_ACTIONS").is_ok() {
            CIEnvironment::GitHubActions
        } else if std::env::var("GITLAB_CI").is_ok() {
            CIEnvironment::GitLabCI
        } else if std::env::var("CIRCLECI").is_ok() {
            CIEnvironment::CircleCI
        } else if std::env::var("JENKINS_URL").is_ok() {
            CIEnvironment::Jenkins
        } else if std::env::var("TRAVIS").is_ok() {
            CIEnvironment::TravisCI
        } else if std::env::var("TF_BUILD").is_ok() {
            CIEnvironment::AzurePipelines
        } else if std::env::var("BUILDKITE").is_ok() {
            CIEnvironment::Buildkite
        } else if std::env::var("CI").is_ok() {
            CIEnvironment::Unknown
        } else {
            CIEnvironment::None
        }
    }

    /// Check if running in any CI environment
    pub fn is_ci(&self) -> bool {
        !matches!(self, CIEnvironment::None)
    }

    /// Output GitHub Actions annotations for failed tests
    pub fn annotate_github(&self, summary: &TestSummary) {
        if !matches!(self, CIEnvironment::GitHubActions) {
            return;
        }

        for result in &summary.results {
            if result.status == TestStatus::Failed {
                if let Some(ref error) = result.error {
                    println!(
                        "::error file={},title=Test Failed: {}::{}",
                        result.file_path,
                        result.name,
                        error.message.replace('\n', "%0A")
                    );
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runner_sequential() {
        let config = RunnerConfig {
            parallel: false,
            ..Default::default()
        };
        let runner = TestRunner::new(config);

        let tests = vec![
            ("test 1".to_string(), "file1.ts".to_string()),
            ("test 2".to_string(), "file2.ts".to_string()),
        ];

        let summary = runner.run_with_callback(tests, |name, file| {
            TestRunner::passed(name, file, Duration::from_millis(10))
        });

        assert_eq!(summary.total, 2);
        assert_eq!(summary.passed, 2);
    }

    #[test]
    fn test_runner_parallel() {
        let config = RunnerConfig {
            parallel: true,
            ..Default::default()
        };
        let runner = TestRunner::new(config);

        let tests = vec![
            ("test 1".to_string(), "file1.ts".to_string()),
            ("test 2".to_string(), "file2.ts".to_string()),
            ("test 3".to_string(), "file3.ts".to_string()),
        ];

        let summary = runner.run_with_callback(tests, |name, file| {
            TestRunner::passed(name, file, Duration::from_millis(10))
        });

        assert_eq!(summary.total, 3);
        assert_eq!(summary.passed, 3);
    }
}
