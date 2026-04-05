# BugsBasters

A fast, simple testing library with Rust-powered performance and a clean JavaScript/TypeScript API.

## Features

- **Fast** - Rust core with parallel test execution via Rayon
- **Simple API** - Clean, intuitive test syntax inspired by Jest
- **Beautiful Reports** - Terminal colors, HTML reports, JUnit XML
- **Powerful Mocking** - Simple `mock()` and `spy()` functions
- **Snapshot Testing** - Capture and compare output snapshots
- **Watch Mode** - Auto-run tests on file changes
- **Code Coverage** - Built-in V8 coverage support
- **CI Ready** - Auto-detects GitHub Actions, GitLab CI, etc.

## Installation

```bash
npm install bugsbasters
```

## Quick Start

```typescript
import { test, expect, describe } from 'bugsbasters';

describe('Math', () => {
  test('adds numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('multiplies numbers', () => {
    expect(3 * 4).toEqual(12);
  });
});
```

Run tests:

```bash
npx bugsbasters run
```

## API

### Test Functions

```typescript
test('name', () => { /* test code */ });
test.skip('skipped test', () => { });
test.only('only this test runs', () => { });
test.todo('not implemented yet');

// Parameterized tests
test.each([[1, 1, 2], [2, 3, 5]])('adds %d + %d = %d', (a, b, sum) => {
  expect(a + b).toBe(sum);
});

// Test suites
describe('Suite', () => {
  beforeEach(() => { /* setup */ });
  afterEach(() => { /* cleanup */ });
  test('...', () => { });
});
```

### Assertions

```typescript
expect(value).toBe(4);                    // strict equality
expect(obj).toEqual({ a: 1 });            // deep equality
expect(arr).toContain(2);                 // contains
expect(arr).toHaveLength(3);              // length
expect(fn).toThrow('error');              // throws
expect(value).toBeTruthy();               // truthy
expect(value).toBeFalsy();                // falsy
expect(value).toBeNull();                 // null
expect(value).toBeDefined();              // defined
expect(value).toBeGreaterThan(5);         // comparison
expect(value).toBeLessThan(10);           // comparison
expect(str).toMatch(/pattern/);           // regex match
expect(obj).toHaveProperty('key', value); // property
expect(obj).toMatchObject({ a: 1 });      // partial match
expect(promise).toResolve();              // async
expect(promise).toReject();               // async

// Negation
expect(value).not.toBe(4);
```

### Mocking

```typescript
import { mock, spy } from 'bugsbasters';

// Create mock function
const fn = mock();
fn(1, 2);
expect(fn).toHaveBeenCalled();
expect(fn).toHaveBeenCalledWith(1, 2);
expect(fn).toHaveBeenCalledTimes(1);

// Return values
const fn = mock().returns(42);
const fn = mock().resolves(data);
const fn = mock().rejects(error);
const fn = mock().throws(error);

// Spy on existing method
const spy = spy(object, 'method').returns(10);
spy.restore(); // restore original
```

### Snapshot Testing

```typescript
// Capture output as snapshot
expect(data).toMatchSnapshot();

// First run creates the snapshot file
// Subsequent runs compare against it
```

Update snapshots:

```bash
npx bugsbasters run --update-snapshots
```

## Watch Mode

Automatically re-run tests when files change:

```bash
npx bugsbasters watch
```

Keyboard shortcuts in watch mode:
- `Enter` - Re-run tests
- `u` - Update snapshots
- `a` - Run all tests
- `q` - Quit

## Code Coverage

Collect coverage data:

```bash
npx bugsbasters run --coverage
```

## CLI Options

```bash
bugsbasters run [pattern]

Options:
  -p, --parallel         Run tests in parallel (default: true)
  --no-parallel          Run tests sequentially
  -r, --reporter <type>  Reporter: terminal, html, json, junit
  -o, --output <file>    Output file for report
  --root <dir>           Root directory for test discovery
  -t, --timeout <ms>     Test timeout (default: 5000)
  -u, --update-snapshots Update snapshot files
  --coverage             Collect code coverage

bugsbasters watch [pattern]

Options:
  --root <dir>           Root directory
  -t, --timeout <ms>     Test timeout
  --no-clear             Don't clear screen between runs
```

## Reporters

### Terminal (default)

```
  BugsBasters v0.1.0

  ✓ adds numbers correctly         2ms
  ✓ subtracts correctly            1ms
  ✗ divides by zero               3ms

    Expected: Error("Cannot divide by zero")
    Received: 0

  Tests: 2 passed, 1 failed (3)
  Time:  127ms
```

### HTML Report

```bash
npx bugsbasters run --reporter html
```

Generates a clean, single-file HTML report.

### JUnit XML

```bash
npx bugsbasters run --reporter junit -o results.xml
```

## Building from Source

### Prerequisites

- Node.js 18+
- Rust 1.70+
- npm or pnpm

### Build

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Build native module (requires Rust)
npm run build:native
```

## Architecture

```
bugsbasters/
├── crates/
│   ├── bugsbasters-core/    # Rust: test engine, reports, CI
│   └── bugsbasters-napi/    # Rust: Node.js bindings (NAPI-RS)
├── packages/
│   └── bugsbasters/         # JS/TS: API wrapper + CLI
└── templates/               # HTML report templates
```

## License

MIT
