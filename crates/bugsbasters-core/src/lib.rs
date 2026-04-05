//! BugsBasters Core - High-performance test engine
//!
//! This crate provides the core testing functionality:
//! - Test discovery and execution
//! - Assertion engine with beautiful diffs
//! - Parallel test execution
//! - Report generation

pub mod assertion;
pub mod diff;
pub mod discovery;
pub mod reporter;
pub mod runner;
pub mod types;

pub use assertion::*;
pub use diff::*;
pub use discovery::*;
pub use reporter::*;
pub use runner::*;
pub use types::*;
