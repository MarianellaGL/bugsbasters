#![deny(clippy::all)]

use bugsbasters_core::{
    assert_to_be, assert_to_be_defined, assert_to_be_falsy, assert_to_be_greater_than,
    assert_to_be_less_than, assert_to_be_null, assert_to_be_truthy, assert_to_contain,
    assert_to_equal, assert_to_have_length, discover_test_files, generate_diff_plain,
    generate_html_report, generate_junit_report, print_header, CIEnvironment, Reporter,
    ReporterType, RunnerConfig, TestError, TestResult, TestStatus, TestSummary,
};
use napi::bindgen_prelude::*;
use napi_derive::napi;
use serde_json::Value;
use std::path::Path;
use std::time::Duration;

/// Configuration for the test runner
#[napi(object)]
pub struct JsRunnerConfig {
    pub parallel: Option<bool>,
    pub timeout_ms: Option<u32>,
    pub reporter: Option<String>,
    pub pattern: Option<String>,
    pub root_dir: Option<String>,
}

/// Test result returned to JavaScript
#[napi(object)]
pub struct JsTestResult {
    pub name: String,
    pub file_path: String,
    pub status: String,
    pub duration_ms: u32,
    pub error_message: Option<String>,
    pub expected: Option<String>,
    pub received: Option<String>,
}

/// Test summary returned to JavaScript
#[napi(object)]
pub struct JsTestSummary {
    pub total: u32,
    pub passed: u32,
    pub failed: u32,
    pub skipped: u32,
    pub duration_ms: u32,
    pub results: Vec<JsTestResult>,
}

/// Assertion result returned to JavaScript
#[napi(object)]
pub struct JsAssertionResult {
    pub passed: bool,
    pub message: Option<String>,
    pub expected: Option<String>,
    pub received: Option<String>,
}

/// Print the BugsBasters header to terminal
#[napi]
pub fn print_test_header() {
    print_header();
}

/// Discover test files in a directory
#[napi]
pub fn discover_tests(root_dir: String, pattern: Option<String>) -> Vec<String> {
    let path = Path::new(&root_dir);
    let files = discover_test_files(path, pattern.as_deref());
    files
        .into_iter()
        .filter_map(|p| p.to_str().map(|s| s.to_string()))
        .collect()
}

/// Assert strict equality (toBe)
#[napi]
pub fn assert_to_be_js(expected: String, received: String) -> JsAssertionResult {
    let expected_val: Value = serde_json::from_str(&expected).unwrap_or(Value::Null);
    let received_val: Value = serde_json::from_str(&received).unwrap_or(Value::Null);
    let result = assert_to_be(&expected_val, &received_val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: result.expected.map(|v| v.to_string()),
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert deep equality (toEqual)
#[napi]
pub fn assert_to_equal_js(expected: String, received: String) -> JsAssertionResult {
    let expected_val: Value = serde_json::from_str(&expected).unwrap_or(Value::Null);
    let received_val: Value = serde_json::from_str(&received).unwrap_or(Value::Null);
    let result = assert_to_equal(&expected_val, &received_val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: result.expected.map(|v| v.to_string()),
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert value contains another value (toContain)
#[napi]
pub fn assert_to_contain_js(haystack: String, needle: String) -> JsAssertionResult {
    let haystack_val: Value = serde_json::from_str(&haystack).unwrap_or(Value::Null);
    let needle_val: Value = serde_json::from_str(&needle).unwrap_or(Value::Null);
    let result = assert_to_contain(&haystack_val, &needle_val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: result.expected.map(|v| v.to_string()),
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert value is truthy (toBeTruthy)
#[napi]
pub fn assert_to_be_truthy_js(value: String) -> JsAssertionResult {
    let val: Value = serde_json::from_str(&value).unwrap_or(Value::Null);
    let result = assert_to_be_truthy(&val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: None,
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert value is falsy (toBeFalsy)
#[napi]
pub fn assert_to_be_falsy_js(value: String) -> JsAssertionResult {
    let val: Value = serde_json::from_str(&value).unwrap_or(Value::Null);
    let result = assert_to_be_falsy(&val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: None,
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert value is null (toBeNull)
#[napi]
pub fn assert_to_be_null_js(value: String) -> JsAssertionResult {
    let val: Value = serde_json::from_str(&value).unwrap_or(Value::Null);
    let result = assert_to_be_null(&val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: Some("null".to_string()),
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert value is defined (toBeDefined)
#[napi]
pub fn assert_to_be_defined_js(value: String) -> JsAssertionResult {
    let val: Value = serde_json::from_str(&value).unwrap_or(Value::Null);
    let result = assert_to_be_defined(&val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: None,
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert value is greater than expected (toBeGreaterThan)
#[napi]
pub fn assert_to_be_greater_than_js(expected: f64, received: String) -> JsAssertionResult {
    let val: Value = serde_json::from_str(&received).unwrap_or(Value::Null);
    let result = assert_to_be_greater_than(expected, &val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: result.expected.map(|v| v.to_string()),
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert value is less than expected (toBeLessThan)
#[napi]
pub fn assert_to_be_less_than_js(expected: f64, received: String) -> JsAssertionResult {
    let val: Value = serde_json::from_str(&received).unwrap_or(Value::Null);
    let result = assert_to_be_less_than(expected, &val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: result.expected.map(|v| v.to_string()),
        received: result.received.map(|v| v.to_string()),
    }
}

/// Assert array/string has expected length (toHaveLength)
#[napi]
pub fn assert_to_have_length_js(expected: u32, received: String) -> JsAssertionResult {
    let val: Value = serde_json::from_str(&received).unwrap_or(Value::Null);
    let result = assert_to_have_length(expected as usize, &val);

    JsAssertionResult {
        passed: result.passed,
        message: result.message,
        expected: result.expected.map(|v| v.to_string()),
        received: result.received.map(|v| v.to_string()),
    }
}

/// Generate a diff between two strings
#[napi]
pub fn generate_diff(expected: String, received: String) -> String {
    generate_diff_plain(&expected, &received)
}

/// Generate an HTML report from test summary
#[napi]
pub fn generate_html_report_js(summary_json: String) -> String {
    let summary: TestSummary = serde_json::from_str(&summary_json).unwrap_or_default();
    generate_html_report(&summary)
}

/// Generate a JUnit XML report from test summary
#[napi]
pub fn generate_junit_report_js(summary_json: String) -> String {
    let summary: TestSummary = serde_json::from_str(&summary_json).unwrap_or_default();
    generate_junit_report(&summary)
}

/// Detect CI environment
#[napi]
pub fn detect_ci_environment() -> String {
    let ci = CIEnvironment::detect();
    match ci {
        CIEnvironment::GitHubActions => "github".to_string(),
        CIEnvironment::GitLabCI => "gitlab".to_string(),
        CIEnvironment::CircleCI => "circleci".to_string(),
        CIEnvironment::Jenkins => "jenkins".to_string(),
        CIEnvironment::TravisCI => "travis".to_string(),
        CIEnvironment::AzurePipelines => "azure".to_string(),
        CIEnvironment::Buildkite => "buildkite".to_string(),
        CIEnvironment::Unknown => "unknown".to_string(),
        CIEnvironment::None => "none".to_string(),
    }
}

/// Check if running in CI
#[napi]
pub fn is_ci() -> bool {
    CIEnvironment::detect().is_ci()
}

/// Print GitHub Actions annotations for failed tests
#[napi]
pub fn annotate_github_actions(summary_json: String) {
    let summary: TestSummary = serde_json::from_str(&summary_json).unwrap_or_default();
    CIEnvironment::GitHubActions.annotate_github(&summary);
}

/// Report a test result to terminal
#[napi]
pub fn report_test_terminal(result_json: String) {
    let result: TestResult = match serde_json::from_str(&result_json) {
        Ok(r) => r,
        Err(_) => return,
    };
    let reporter = Reporter::new(ReporterType::Terminal);
    reporter.report_test(&result);
}

/// Report test summary to terminal
#[napi]
pub fn report_summary_terminal(summary_json: String) -> String {
    let summary: TestSummary = serde_json::from_str(&summary_json).unwrap_or_default();
    let reporter = Reporter::new(ReporterType::Terminal);
    reporter.report_summary(&summary)
}

/// Convert a JavaScript test result to JSON for Rust processing
#[napi]
pub fn create_test_result(
    name: String,
    file_path: String,
    passed: bool,
    duration_ms: u32,
    error_message: Option<String>,
    expected: Option<String>,
    received: Option<String>,
) -> String {
    let result = TestResult {
        name,
        file_path,
        status: if passed {
            TestStatus::Passed
        } else {
            TestStatus::Failed
        },
        duration: Duration::from_millis(duration_ms as u64),
        error: if !passed {
            Some(TestError {
                message: error_message.unwrap_or_default(),
                expected,
                received,
                diff: None,
                stack: None,
            })
        } else {
            None
        },
    };
    serde_json::to_string(&result).unwrap_or_default()
}

/// Create a test summary from results
#[napi]
pub fn create_test_summary(results_json: Vec<String>) -> String {
    let mut summary = TestSummary::new();
    for result_json in results_json {
        if let Ok(result) = serde_json::from_str::<TestResult>(&result_json) {
            summary.add_result(result);
        }
    }
    serde_json::to_string(&summary).unwrap_or_default()
}
