#!/usr/bin/env node

import { cac } from 'cac';
import { run } from './runner';
import type { RunnerOptions } from './runner';

const cli = cac('bugsbasters');

cli
  .command('run [pattern]', 'Run tests')
  .option('-p, --parallel', 'Run tests in parallel (default: true)', { default: true })
  .option('--no-parallel', 'Run tests sequentially')
  .option('-r, --reporter <type>', 'Reporter type: terminal, html, json, junit', {
    default: 'terminal',
  })
  .option('-o, --output <file>', 'Output file for report')
  .option('--root <dir>', 'Root directory for test discovery', { default: process.cwd() })
  .option('-t, --timeout <ms>', 'Test timeout in milliseconds', { default: 5000 })
  .action(async (pattern: string | undefined, options: any) => {
    const runnerOptions: RunnerOptions = {
      pattern,
      parallel: options.parallel,
      reporter: options.reporter,
      outputFile: options.output,
      rootDir: options.root,
      timeout: Number(options.timeout),
    };

    try {
      const summary = await run(runnerOptions);
      process.exit(summary.failed > 0 ? 1 : 0);
    } catch (error: any) {
      console.error('\x1b[31mError:\x1b[0m', error.message);
      process.exit(1);
    }
  });

cli
  .command('init', 'Initialize BugsBasters in current project')
  .action(async () => {
    const fs = await import('fs');
    const path = await import('path');

    // Create example test file
    const exampleTest = `import { test, expect, describe } from 'bugsbasters';

describe('Math', () => {
  test('adds numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('multiplies numbers', () => {
    expect(3 * 4).toEqual(12);
  });
});

test.each([
  [1, 1, 2],
  [2, 3, 5],
  [10, 20, 30],
])('adds %d + %d = %d', (a, b, expected) => {
  expect(a + b).toBe(expected);
});
`;

    const testDir = 'tests';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const testFile = path.join(testDir, 'example.test.ts');
    if (!fs.existsSync(testFile)) {
      fs.writeFileSync(testFile, exampleTest);
      console.log(`\x1b[32m✓\x1b[0m Created ${testFile}`);
    } else {
      console.log(`\x1b[33m○\x1b[0m ${testFile} already exists`);
    }

    // Add test script to package.json if it exists
    const packageJsonPath = 'package.json';
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      if (!packageJson.scripts.test) {
        packageJson.scripts.test = 'bugsbasters run';
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
        console.log(`\x1b[32m✓\x1b[0m Added test script to package.json`);
      }
    }

    console.log('\n  Run tests with: \x1b[36mnpx bugsbasters run\x1b[0m\n');
  });

cli.help();
cli.version('0.1.0');

cli.parse();
