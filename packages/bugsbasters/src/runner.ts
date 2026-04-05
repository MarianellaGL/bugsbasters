import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';
import { pathToFileURL } from 'node:url';
import type { TestResult, TestSummary, DescribeBlock, TestCase } from './types';
import { getTestRegistry, clearTestRegistry, setCurrentFilePath } from './test';
import { cleanupMocks } from './mock';
import { loadNativeModule } from './native';
import { generateHtmlReport as generateHtmlReportImpl } from './html-report';

// Try to load native module
const native = loadNativeModule();

export interface RunnerOptions {
  pattern?: string;
  parallel?: boolean;
  reporter?: 'terminal' | 'html' | 'json' | 'junit';
  outputFile?: string;
  rootDir?: string;
  timeout?: number;
}

const DEFAULT_PATTERNS = [
  '**/*.test.ts',
  '**/*.test.js',
  '**/*.test.tsx',
  '**/*.test.jsx',
  '**/*.spec.ts',
  '**/*.spec.js',
  '**/*.spec.tsx',
  '**/*.spec.jsx',
];

const IGNORE_PATTERNS = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'];

export class TestRunner {
  private options: RunnerOptions;
  private results: TestResult[] = [];

  constructor(options: RunnerOptions = {}) {
    this.options = {
      parallel: true,
      reporter: 'terminal',
      rootDir: process.cwd(),
      timeout: 5000,
      ...options,
    };
  }

  async run(): Promise<TestSummary> {
    const startTime = Date.now();

    // Print header
    this.printHeader();

    // Discover test files
    const testFiles = await this.discoverTestFiles();

    if (testFiles.length === 0) {
      console.log('  No test files found.\n');
      return this.createSummary(startTime);
    }

    // Run test files
    for (const file of testFiles) {
      await this.runTestFile(file);
    }

    // Create summary
    const summary = this.createSummary(startTime);

    // Report results
    await this.reportResults(summary);

    return summary;
  }

  private printHeader(): void {
    if (native) {
      native.printTestHeader();
    } else {
      console.log();
      console.log('  \x1b[36m\x1b[1mBugsBasters\x1b[0m \x1b[2mv0.1.0\x1b[0m');
      console.log();
    }
  }

  private async discoverTestFiles(): Promise<string[]> {
    const rootDir = this.options.rootDir || process.cwd();
    const patterns = this.options.pattern ? [this.options.pattern] : DEFAULT_PATTERNS;

    const files: string[] = [];

    for (const pattern of patterns) {
      const matches = await glob(pattern, {
        cwd: rootDir,
        ignore: IGNORE_PATTERNS,
        absolute: true,
      });
      files.push(...matches);
    }

    // Remove duplicates and sort
    return [...new Set(files)].sort();
  }

  private async runTestFile(filePath: string): Promise<void> {
    // Clear previous test registrations
    clearTestRegistry();
    setCurrentFilePath(filePath);

    try {
      // Import the test file
      const fileUrl = pathToFileURL(filePath).href;

      // Use dynamic import for ES modules
      await import(fileUrl);

      // Run all registered tests
      const registry = getTestRegistry();
      await this.runDescribeBlock(registry, []);
    } catch (error: any) {
      // File-level error
      this.results.push({
        name: `Error loading ${path.basename(filePath)}`,
        filePath,
        status: 'failed',
        durationMs: 0,
        error: {
          message: error.message || String(error),
          stack: error.stack,
        },
      });
      this.printTestResult(this.results[this.results.length - 1]);
    }
  }

  private async runDescribeBlock(
    block: DescribeBlock,
    parentNames: string[]
  ): Promise<void> {
    const currentNames = block.name ? [...parentNames, block.name] : parentNames;

    // Run beforeAll hooks
    for (const hook of block.beforeAll) {
      await this.runHook(hook, 'beforeAll');
    }

    // Run tests in this block
    for (const test of block.tests) {
      await this.runTest(test, currentNames, block);
    }

    // Run child describe blocks
    for (const child of block.children) {
      await this.runDescribeBlock(child, currentNames);
    }

    // Run afterAll hooks
    for (const hook of block.afterAll) {
      await this.runHook(hook, 'afterAll');
    }
  }

  private async runHook(fn: () => void | Promise<void>, name: string): Promise<void> {
    try {
      await fn();
    } catch (error: any) {
      console.error(`  Error in ${name}: ${error.message}`);
    }
  }

  private async runTest(
    test: TestCase,
    parentNames: string[],
    block: DescribeBlock
  ): Promise<void> {
    const fullName = [...parentNames, test.name].join(' > ');

    // Check if test should be skipped
    if (test.options.skip) {
      const result: TestResult = {
        name: fullName,
        filePath: test.filePath,
        status: 'skipped',
        durationMs: 0,
      };
      this.results.push(result);
      this.printTestResult(result);
      return;
    }

    // Collect all beforeEach hooks from parent chain
    const beforeEachHooks: (() => void | Promise<void>)[] = [];
    const afterEachHooks: (() => void | Promise<void>)[] = [];
    let current: DescribeBlock | undefined = block;
    while (current) {
      beforeEachHooks.unshift(...current.beforeEach);
      afterEachHooks.push(...current.afterEach);
      current = current.parent;
    }

    const startTime = Date.now();
    let error: any = null;

    try {
      // Run beforeEach hooks
      for (const hook of beforeEachHooks) {
        await hook();
      }

      // Run the test with timeout
      const timeout = test.options.timeout || this.options.timeout || 5000;
      await Promise.race([
        test.fn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout)
        ),
      ]);
    } catch (e: any) {
      error = e;
    } finally {
      // Run afterEach hooks
      for (const hook of afterEachHooks) {
        try {
          await hook();
        } catch (e) {
          // Log but don't override test error
          console.error(`  Error in afterEach: ${e}`);
        }
      }

      // Clean up mocks
      cleanupMocks();
    }

    const durationMs = Date.now() - startTime;

    const result: TestResult = {
      name: fullName,
      filePath: test.filePath,
      status: error ? 'failed' : 'passed',
      durationMs,
      error: error
        ? {
            message: error.message || String(error),
            expected: error.expected !== undefined ? String(error.expected) : undefined,
            received: error.received !== undefined ? String(error.received) : undefined,
            stack: error.stack,
          }
        : undefined,
    };

    this.results.push(result);
    this.printTestResult(result);
  }

  private printTestResult(result: TestResult): void {
    const statusIcon =
      result.status === 'passed'
        ? '\x1b[32m✓\x1b[0m'
        : result.status === 'failed'
          ? '\x1b[31m✗\x1b[0m'
          : '\x1b[33m○\x1b[0m';

    const duration = `\x1b[2m${result.durationMs}ms\x1b[0m`;
    console.log(`  ${statusIcon} ${result.name} ${duration}`);

    if (result.error) {
      console.log();
      if (result.error.expected !== undefined && result.error.received !== undefined) {
        console.log(`    \x1b[32mExpected\x1b[0m: ${result.error.expected}`);
        console.log(`    \x1b[31mReceived\x1b[0m: ${result.error.received}`);
      } else {
        console.log(`    \x1b[31m${result.error.message}\x1b[0m`);
      }
      console.log();
    }
  }

  private createSummary(startTime: number): TestSummary {
    const summary: TestSummary = {
      total: this.results.length,
      passed: this.results.filter((r) => r.status === 'passed').length,
      failed: this.results.filter((r) => r.status === 'failed').length,
      skipped: this.results.filter((r) => r.status === 'skipped').length,
      durationMs: Date.now() - startTime,
      results: this.results,
    };

    return summary;
  }

  private async reportResults(summary: TestSummary): Promise<void> {
    // Print terminal summary
    console.log();
    const passedStr = `\x1b[32m${summary.passed} passed\x1b[0m`;
    const failedStr = summary.failed > 0 ? `, \x1b[31m${summary.failed} failed\x1b[0m` : '';
    const skippedStr = summary.skipped > 0 ? `, \x1b[33m${summary.skipped} skipped\x1b[0m` : '';
    console.log(`  \x1b[1mTests\x1b[0m: ${passedStr}${failedStr}${skippedStr} (${summary.total})`);
    console.log(`  \x1b[1mTime\x1b[0m:  ${summary.durationMs}ms`);
    console.log();

    // Generate additional reports if requested
    if (this.options.reporter === 'html' || this.options.outputFile?.endsWith('.html')) {
      const html = this.generateHtmlReport(summary);
      const outputFile = this.options.outputFile || 'report.html';
      fs.writeFileSync(outputFile, html);
      console.log(`  HTML report written to ${outputFile}\n`);
    }

    if (this.options.reporter === 'json' || this.options.outputFile?.endsWith('.json')) {
      const json = JSON.stringify(summary, null, 2);
      const outputFile = this.options.outputFile || 'report.json';
      fs.writeFileSync(outputFile, json);
      console.log(`  JSON report written to ${outputFile}\n`);
    }

    if (this.options.reporter === 'junit' || this.options.outputFile?.endsWith('.xml')) {
      const xml = this.generateJunitReport(summary);
      const outputFile = this.options.outputFile || 'report.xml';
      fs.writeFileSync(outputFile, xml);
      console.log(`  JUnit report written to ${outputFile}\n`);
    }

    // GitHub Actions annotations
    if (process.env.GITHUB_ACTIONS && native) {
      native.annotateGithubActions(JSON.stringify(summary));
    }

    // GitHub Actions Job Summary
    if (process.env.GITHUB_ACTIONS && process.env.GITHUB_STEP_SUMMARY) {
      const markdown = this.generateGitHubSummary(summary);
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
    }
  }

  private generateHtmlReport(summary: TestSummary): string {
    return generateHtmlReportImpl(summary);
  }

  private generateJunitReport(summary: TestSummary): string {
    if (native) {
      return native.generateJunitReportJs(JSON.stringify(summary));
    }

    // Fallback pure JS implementation
    const testCases = summary.results
      .map((r) => {
        const failure = r.error
          ? `<failure message="${this.escapeXml(r.error.message)}">${this.escapeXml(r.error.stack || r.error.message)}</failure>`
          : '';
        return `    <testcase name="${this.escapeXml(r.name)}" classname="${this.escapeXml(r.filePath)}" time="${r.durationMs / 1000}">
      ${failure}
    </testcase>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="BugsBasters" tests="${summary.total}" failures="${summary.failed}" skipped="${summary.skipped}" time="${summary.durationMs / 1000}">
${testCases}
</testsuite>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private generateGitHubSummary(summary: TestSummary): string {
    const passRate = summary.total > 0
      ? ((summary.passed / summary.total) * 100).toFixed(1)
      : '0';

    const statusEmoji = summary.failed === 0 ? '✅' : '❌';
    const statusText = summary.failed === 0 ? 'All tests passed!' : `${summary.failed} test(s) failed`;

    // Group results by file
    const resultsByFile = new Map<string, TestResult[]>();
    for (const result of summary.results) {
      const file = result.filePath;
      if (!resultsByFile.has(file)) {
        resultsByFile.set(file, []);
      }
      resultsByFile.get(file)!.push(result);
    }

    let md = `# 🐞 BugsBasters Test Results

${statusEmoji} **${statusText}**

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total Tests | ${summary.total} |
| ✅ Passed | ${summary.passed} |
| ❌ Failed | ${summary.failed} |
| ⏭️ Skipped | ${summary.skipped} |
| ⏱️ Duration | ${summary.durationMs}ms |
| 📈 Pass Rate | ${passRate}% |

`;

    // Add failed tests section if any
    const failedTests = summary.results.filter(r => r.status === 'failed');
    if (failedTests.length > 0) {
      md += `## ❌ Failed Tests

<details>
<summary>Click to expand ${failedTests.length} failed test(s)</summary>

`;
      for (const test of failedTests) {
        md += `### \`${test.name}\`

**File:** \`${path.basename(test.filePath)}\`

`;
        if (test.error) {
          if (test.error.expected !== undefined && test.error.received !== undefined) {
            md += `| | Value |
|---|---|
| **Expected** | \`${test.error.expected}\` |
| **Received** | \`${test.error.received}\` |

`;
          } else {
            md += `**Error:** ${test.error.message}

`;
          }
        }
      }
      md += `</details>

`;
    }

    // Add test files breakdown
    md += `## 📁 Test Files

| File | Passed | Failed | Skipped |
|------|--------|--------|---------|
`;

    for (const [file, results] of resultsByFile) {
      const passed = results.filter(r => r.status === 'passed').length;
      const failed = results.filter(r => r.status === 'failed').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const fileIcon = failed > 0 ? '❌' : '✅';
      md += `| ${fileIcon} \`${path.basename(file)}\` | ${passed} | ${failed} | ${skipped} |\n`;
    }

    md += `
---
*Generated by [BugsBasters](https://github.com/bugsbasters/bugsbasters)*
`;

    return md;
  }
}

export async function run(options?: RunnerOptions): Promise<TestSummary> {
  const runner = new TestRunner(options);
  return runner.run();
}
