use owo_colors::OwoColorize;
use similar::{ChangeTag, TextDiff};

/// Generate a colored diff between two strings
pub fn generate_diff(expected: &str, received: &str) -> String {
    let diff = TextDiff::from_lines(expected, received);
    let mut output = String::new();

    for change in diff.iter_all_changes() {
        let (sign, line) = match change.tag() {
            ChangeTag::Delete => ("-", format!("{}", change.green())),
            ChangeTag::Insert => ("+", format!("{}", change.red())),
            ChangeTag::Equal => (" ", change.to_string()),
        };
        output.push_str(&format!("{} {}", sign, line));
    }

    output
}

/// Generate a plain diff without colors (for reports)
pub fn generate_diff_plain(expected: &str, received: &str) -> String {
    let diff = TextDiff::from_lines(expected, received);
    let mut output = String::new();

    for change in diff.iter_all_changes() {
        let sign = match change.tag() {
            ChangeTag::Delete => "-",
            ChangeTag::Insert => "+",
            ChangeTag::Equal => " ",
        };
        output.push_str(&format!("{} {}", sign, change));
    }

    output
}

/// Generate an inline diff for short values
pub fn generate_inline_diff(expected: &str, received: &str) -> (String, String) {
    let diff = TextDiff::from_chars(expected, received);
    let mut expected_highlighted = String::new();
    let mut received_highlighted = String::new();

    for change in diff.iter_all_changes() {
        match change.tag() {
            ChangeTag::Delete => {
                expected_highlighted.push_str(&format!("{}", change.green().underline()));
            }
            ChangeTag::Insert => {
                received_highlighted.push_str(&format!("{}", change.red().underline()));
            }
            ChangeTag::Equal => {
                let s = change.to_string();
                expected_highlighted.push_str(&s);
                received_highlighted.push_str(&s);
            }
        }
    }

    (expected_highlighted, received_highlighted)
}

/// Format expected/received values for display
pub fn format_comparison(expected: &str, received: &str) -> String {
    let mut output = String::new();
    output.push_str(&format!("    {}: {}\n", "Expected".green(), expected.green()));
    output.push_str(&format!("    {}: {}\n", "Received".red(), received.red()));
    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_diff_plain() {
        let diff = generate_diff_plain("hello\nworld\n", "hello\nearth\n");
        assert!(diff.contains("- world"));
        assert!(diff.contains("+ earth"));
    }
}
