use crate::diff::generate_diff;
use crate::types::AssertionResult;
use serde_json::Value;

/// Compare two JSON values for strict equality
pub fn assert_to_be(expected: &Value, received: &Value) -> AssertionResult {
    let passed = expected == received;
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!("Expected value to be {:?}", expected))
        },
        expected: Some(expected.clone()),
        received: Some(received.clone()),
    }
}

/// Compare two JSON values for deep equality
pub fn assert_to_equal(expected: &Value, received: &Value) -> AssertionResult {
    let passed = deep_equal(expected, received);
    let diff = if !passed {
        Some(generate_diff(
            &serde_json::to_string_pretty(expected).unwrap_or_default(),
            &serde_json::to_string_pretty(received).unwrap_or_default(),
        ))
    } else {
        None
    };

    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            diff
        },
        expected: Some(expected.clone()),
        received: Some(received.clone()),
    }
}

/// Check if a value is contained in an array or string
pub fn assert_to_contain(haystack: &Value, needle: &Value) -> AssertionResult {
    let passed = match haystack {
        Value::Array(arr) => arr.iter().any(|item| deep_equal(item, needle)),
        Value::String(s) => {
            if let Value::String(n) = needle {
                s.contains(n.as_str())
            } else {
                false
            }
        }
        _ => false,
    };

    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!("Expected {:?} to contain {:?}", haystack, needle))
        },
        expected: Some(needle.clone()),
        received: Some(haystack.clone()),
    }
}

/// Check if a value is truthy
pub fn assert_to_be_truthy(value: &Value) -> AssertionResult {
    let passed = is_truthy(value);
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!("Expected {:?} to be truthy", value))
        },
        expected: None,
        received: Some(value.clone()),
    }
}

/// Check if a value is falsy
pub fn assert_to_be_falsy(value: &Value) -> AssertionResult {
    let passed = !is_truthy(value);
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!("Expected {:?} to be falsy", value))
        },
        expected: None,
        received: Some(value.clone()),
    }
}

/// Check if a value is null or undefined
pub fn assert_to_be_null(value: &Value) -> AssertionResult {
    let passed = value.is_null();
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!("Expected {:?} to be null", value))
        },
        expected: Some(Value::Null),
        received: Some(value.clone()),
    }
}

/// Check if a value is defined (not null/undefined)
pub fn assert_to_be_defined(value: &Value) -> AssertionResult {
    let passed = !value.is_null();
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some("Expected value to be defined".to_string())
        },
        expected: None,
        received: Some(value.clone()),
    }
}

/// Check if a number is greater than expected
pub fn assert_to_be_greater_than(expected: f64, received: &Value) -> AssertionResult {
    let passed = received.as_f64().map(|r| r > expected).unwrap_or(false);
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!("Expected {:?} to be greater than {}", received, expected))
        },
        expected: Some(Value::from(expected)),
        received: Some(received.clone()),
    }
}

/// Check if a number is less than expected
pub fn assert_to_be_less_than(expected: f64, received: &Value) -> AssertionResult {
    let passed = received.as_f64().map(|r| r < expected).unwrap_or(false);
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!("Expected {:?} to be less than {}", received, expected))
        },
        expected: Some(Value::from(expected)),
        received: Some(received.clone()),
    }
}

/// Check array/string length
pub fn assert_to_have_length(expected: usize, received: &Value) -> AssertionResult {
    let actual_length = match received {
        Value::Array(arr) => Some(arr.len()),
        Value::String(s) => Some(s.len()),
        _ => None,
    };

    let passed = actual_length == Some(expected);
    AssertionResult {
        passed,
        message: if passed {
            None
        } else {
            Some(format!(
                "Expected length {}, received {:?}",
                expected,
                actual_length
            ))
        },
        expected: Some(Value::from(expected)),
        received: Some(Value::from(actual_length.unwrap_or(0))),
    }
}

/// Deep equality comparison for JSON values
fn deep_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Null, Value::Null) => true,
        (Value::Bool(a), Value::Bool(b)) => a == b,
        (Value::Number(a), Value::Number(b)) => {
            a.as_f64().unwrap_or(f64::NAN) == b.as_f64().unwrap_or(f64::NAN)
        }
        (Value::String(a), Value::String(b)) => a == b,
        (Value::Array(a), Value::Array(b)) => {
            a.len() == b.len() && a.iter().zip(b.iter()).all(|(x, y)| deep_equal(x, y))
        }
        (Value::Object(a), Value::Object(b)) => {
            a.len() == b.len()
                && a.iter()
                    .all(|(k, v)| b.get(k).map(|bv| deep_equal(v, bv)).unwrap_or(false))
        }
        _ => false,
    }
}

/// Check if a JSON value is truthy (following JavaScript semantics)
fn is_truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().map(|f| f != 0.0).unwrap_or(false),
        Value::String(s) => !s.is_empty(),
        Value::Array(_) => true,
        Value::Object(_) => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_to_be() {
        assert!(assert_to_be(&json!(5), &json!(5)).passed);
        assert!(!assert_to_be(&json!(5), &json!(6)).passed);
    }

    #[test]
    fn test_to_equal() {
        assert!(assert_to_equal(&json!({"a": 1}), &json!({"a": 1})).passed);
        assert!(!assert_to_equal(&json!({"a": 1}), &json!({"a": 2})).passed);
    }

    #[test]
    fn test_to_contain() {
        assert!(assert_to_contain(&json!([1, 2, 3]), &json!(2)).passed);
        assert!(assert_to_contain(&json!("hello"), &json!("ell")).passed);
        assert!(!assert_to_contain(&json!([1, 2, 3]), &json!(4)).passed);
    }

    #[test]
    fn test_truthy_falsy() {
        assert!(assert_to_be_truthy(&json!(true)).passed);
        assert!(assert_to_be_truthy(&json!(1)).passed);
        assert!(assert_to_be_truthy(&json!("hello")).passed);
        assert!(!assert_to_be_truthy(&json!(false)).passed);
        assert!(!assert_to_be_truthy(&json!(0)).passed);
        assert!(!assert_to_be_truthy(&json!("")).passed);
    }
}
