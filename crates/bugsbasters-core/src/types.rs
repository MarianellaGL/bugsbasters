use serde::{Deserialize, Serialize};
use std::time::Duration;

/// Represents a single test case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestCase {
    pub name: String,
    pub file_path: String,
    #[serde(skip)]
    pub line_number: Option<u32>,
}

/// Result of running a single test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub name: String,
    pub file_path: String,
    pub status: TestStatus,
    #[serde(with = "duration_millis")]
    pub duration: Duration,
    pub error: Option<TestError>,
}

/// Status of a test execution
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TestStatus {
    Passed,
    Failed,
    Skipped,
}

/// Error information from a failed test
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestError {
    pub message: String,
    pub expected: Option<String>,
    pub received: Option<String>,
    pub diff: Option<String>,
    pub stack: Option<String>,
}

/// Summary of all test results
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct TestSummary {
    pub total: usize,
    pub passed: usize,
    pub failed: usize,
    pub skipped: usize,
    #[serde(with = "duration_millis")]
    pub duration: Duration,
    pub results: Vec<TestResult>,
}

impl TestSummary {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_result(&mut self, result: TestResult) {
        match result.status {
            TestStatus::Passed => self.passed += 1,
            TestStatus::Failed => self.failed += 1,
            TestStatus::Skipped => self.skipped += 1,
        }
        self.total += 1;
        self.duration += result.duration;
        self.results.push(result);
    }

    pub fn is_success(&self) -> bool {
        self.failed == 0
    }
}

/// Configuration for test runner
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunnerConfig {
    pub parallel: bool,
    pub timeout_ms: u64,
    pub reporter: ReporterType,
    pub pattern: Option<String>,
    pub root_dir: String,
}

impl Default for RunnerConfig {
    fn default() -> Self {
        Self {
            parallel: true,
            timeout_ms: 5000,
            reporter: ReporterType::Terminal,
            pattern: None,
            root_dir: ".".to_string(),
        }
    }
}

/// Type of reporter to use
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReporterType {
    Terminal,
    Html,
    Json,
    Junit,
}

/// Assertion result from JavaScript
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssertionResult {
    pub passed: bool,
    pub message: Option<String>,
    pub expected: Option<serde_json::Value>,
    pub received: Option<serde_json::Value>,
}

mod duration_millis {
    use serde::{Deserialize, Deserializer, Serializer};
    use std::time::Duration;

    pub fn serialize<S>(duration: &Duration, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_u64(duration.as_millis() as u64)
    }

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Duration, D::Error>
    where
        D: Deserializer<'de>,
    {
        let millis = u64::deserialize(deserializer)?;
        Ok(Duration::from_millis(millis))
    }
}
