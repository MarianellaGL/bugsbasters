use crate::types::{ReporterType, TestError, TestResult, TestStatus, TestSummary};
use owo_colors::OwoColorize;
use std::io::Write;

/// Report test results in various formats
pub struct Reporter {
    reporter_type: ReporterType,
}

impl Reporter {
    pub fn new(reporter_type: ReporterType) -> Self {
        Self { reporter_type }
    }

    /// Report a single test result
    pub fn report_test(&self, result: &TestResult) {
        match self.reporter_type {
            ReporterType::Terminal => self.report_test_terminal(result),
            _ => {} // Other reporters handle results in summary
        }
    }

    /// Report the final summary
    pub fn report_summary(&self, summary: &TestSummary) -> String {
        match self.reporter_type {
            ReporterType::Terminal => self.report_summary_terminal(summary),
            ReporterType::Html => self.report_summary_html(summary),
            ReporterType::Json => self.report_summary_json(summary),
            ReporterType::Junit => self.report_summary_junit(summary),
        }
    }

    fn report_test_terminal(&self, result: &TestResult) {
        let status_icon = match result.status {
            TestStatus::Passed => "✓".green().to_string(),
            TestStatus::Failed => "✗".red().to_string(),
            TestStatus::Skipped => "○".yellow().to_string(),
        };

        let duration = format!("{}ms", result.duration.as_millis());

        println!(
            "  {} {} {}",
            status_icon,
            result.name,
            duration.dimmed()
        );

        if let Some(ref error) = result.error {
            self.print_error(error);
        }
    }

    fn print_error(&self, error: &TestError) {
        println!();
        if let (Some(expected), Some(received)) = (&error.expected, &error.received) {
            println!("    {}: {}", "Expected".green(), expected.green());
            println!("    {}: {}", "Received".red(), received.red());
        } else {
            println!("    {}", error.message.red());
        }
        if let Some(ref diff) = error.diff {
            println!();
            println!("{}", diff);
        }
        println!();
    }

    fn report_summary_terminal(&self, summary: &TestSummary) -> String {
        let mut output = String::new();

        output.push_str("\n");
        output.push_str(&format!(
            "  {}: {} passed",
            "Tests".bold(),
            summary.passed.to_string().green()
        ));

        if summary.failed > 0 {
            output.push_str(&format!(", {}", format!("{} failed", summary.failed).red()));
        }

        if summary.skipped > 0 {
            output.push_str(&format!(
                ", {}",
                format!("{} skipped", summary.skipped).yellow()
            ));
        }

        output.push_str(&format!(" ({})\n", summary.total));
        output.push_str(&format!(
            "  {}:  {}ms\n",
            "Time".bold(),
            summary.duration.as_millis()
        ));

        print!("{}", output);
        output
    }

    fn report_summary_html(&self, summary: &TestSummary) -> String {
        generate_html_report(summary)
    }

    fn report_summary_json(&self, summary: &TestSummary) -> String {
        serde_json::to_string_pretty(summary).unwrap_or_default()
    }

    fn report_summary_junit(&self, summary: &TestSummary) -> String {
        generate_junit_report(summary)
    }
}

/// Print the BugsBasters header
pub fn print_header() {
    println!();
    println!("  {} {}", "BugsBasters".bold().cyan(), "v0.1.0".dimmed());
    println!();
}

/// Generate an HTML report
pub fn generate_html_report(summary: &TestSummary) -> String {
    let status_class = if summary.is_success() {
        "success"
    } else {
        "failure"
    };

    let test_rows: String = summary
        .results
        .iter()
        .map(|r| {
            let status_class = match r.status {
                TestStatus::Passed => "passed",
                TestStatus::Failed => "failed",
                TestStatus::Skipped => "skipped",
            };
            let status_icon = match r.status {
                TestStatus::Passed => "✓",
                TestStatus::Failed => "✗",
                TestStatus::Skipped => "○",
            };
            let error_section = if let Some(ref error) = r.error {
                format!(
                    r#"<div class="error">
                        <div class="error-message">{}</div>
                        {}
                    </div>"#,
                    html_escape(&error.message),
                    if let (Some(exp), Some(recv)) = (&error.expected, &error.received) {
                        format!(
                            r#"<div class="comparison">
                                <div class="expected">Expected: {}</div>
                                <div class="received">Received: {}</div>
                            </div>"#,
                            html_escape(exp),
                            html_escape(recv)
                        )
                    } else {
                        String::new()
                    }
                )
            } else {
                String::new()
            };

            format!(
                r#"<div class="test {status_class}">
                    <div class="test-header">
                        <span class="status-icon">{status_icon}</span>
                        <span class="test-name">{}</span>
                        <span class="duration">{}ms</span>
                    </div>
                    {error_section}
                </div>"#,
                html_escape(&r.name),
                r.duration.as_millis()
            )
        })
        .collect();

    format!(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BugsBasters Test Report</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #fafafa;
            color: #333;
            line-height: 1.5;
            padding: 2rem;
        }}
        .container {{ max-width: 900px; margin: 0 auto; }}
        header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding-bottom: 1rem;
            border-bottom: 1px solid #eee;
        }}
        h1 {{ font-size: 1.5rem; font-weight: 600; }}
        .summary {{
            display: flex;
            gap: 2rem;
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }}
        .stat {{ text-align: center; }}
        .stat-value {{ font-size: 2rem; font-weight: 700; }}
        .stat-label {{ font-size: 0.875rem; color: #666; }}
        .stat-value.passed {{ color: #22c55e; }}
        .stat-value.failed {{ color: #ef4444; }}
        .stat-value.skipped {{ color: #f59e0b; }}
        .tests {{ background: white; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }}
        .test {{ padding: 1rem 1.5rem; border-bottom: 1px solid #eee; }}
        .test:last-child {{ border-bottom: none; }}
        .test-header {{ display: flex; align-items: center; gap: 0.75rem; }}
        .status-icon {{ font-size: 1rem; }}
        .test.passed .status-icon {{ color: #22c55e; }}
        .test.failed .status-icon {{ color: #ef4444; }}
        .test.skipped .status-icon {{ color: #f59e0b; }}
        .test-name {{ flex: 1; font-weight: 500; }}
        .duration {{ font-size: 0.875rem; color: #999; }}
        .error {{ margin-top: 1rem; padding: 1rem; background: #fef2f2; border-radius: 4px; font-size: 0.875rem; }}
        .error-message {{ color: #dc2626; margin-bottom: 0.5rem; }}
        .comparison {{ font-family: monospace; }}
        .expected {{ color: #22c55e; }}
        .received {{ color: #ef4444; }}
        .badge {{
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.875rem;
            font-weight: 500;
        }}
        .badge.success {{ background: #dcfce7; color: #166534; }}
        .badge.failure {{ background: #fee2e2; color: #991b1b; }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>BugsBasters Test Report</h1>
            <span class="badge {status_class}">{}</span>
        </header>
        <div class="summary">
            <div class="stat">
                <div class="stat-value">{}</div>
                <div class="stat-label">Total</div>
            </div>
            <div class="stat">
                <div class="stat-value passed">{}</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat">
                <div class="stat-value failed">{}</div>
                <div class="stat-label">Failed</div>
            </div>
            <div class="stat">
                <div class="stat-value skipped">{}</div>
                <div class="stat-label">Skipped</div>
            </div>
            <div class="stat">
                <div class="stat-value">{}ms</div>
                <div class="stat-label">Duration</div>
            </div>
        </div>
        <div class="tests">
            {test_rows}
        </div>
    </div>
</body>
</html>"#,
        if summary.is_success() { "All Passed" } else { "Some Failed" },
        summary.total,
        summary.passed,
        summary.failed,
        summary.skipped,
        summary.duration.as_millis()
    )
}

/// Generate a JUnit XML report
pub fn generate_junit_report(summary: &TestSummary) -> String {
    let test_cases: String = summary
        .results
        .iter()
        .map(|r| {
            let failure = if let Some(ref error) = r.error {
                format!(
                    r#"<failure message="{}">{}</failure>"#,
                    xml_escape(&error.message),
                    xml_escape(
                        &error
                            .diff
                            .as_ref()
                            .unwrap_or(&error.message)
                    )
                )
            } else {
                String::new()
            };

            format!(
                r#"    <testcase name="{}" classname="{}" time="{}">
      {}
    </testcase>"#,
                xml_escape(&r.name),
                xml_escape(&r.file_path),
                r.duration.as_secs_f64(),
                failure
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="BugsBasters" tests="{}" failures="{}" skipped="{}" time="{}">
{}
</testsuite>"#,
        summary.total,
        summary.failed,
        summary.skipped,
        summary.duration.as_secs_f64(),
        test_cases
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[test]
    fn test_html_report_generation() {
        let mut summary = TestSummary::new();
        summary.add_result(TestResult {
            name: "test 1".to_string(),
            file_path: "test.ts".to_string(),
            status: TestStatus::Passed,
            duration: Duration::from_millis(10),
            error: None,
        });

        let html = generate_html_report(&summary);
        assert!(html.contains("BugsBasters Test Report"));
        assert!(html.contains("test 1"));
    }
}
