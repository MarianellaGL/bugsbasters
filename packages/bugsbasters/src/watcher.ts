import * as fs from 'fs';
import * as path from 'path';
import { run } from './runner';
import type { RunnerOptions } from './runner';

interface WatchOptions extends RunnerOptions {
  clearScreen?: boolean;
}

export class TestWatcher {
  private options: WatchOptions;
  private watchers: fs.FSWatcher[] = [];
  private debounceTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private watchedDirs = new Set<string>();

  constructor(options: WatchOptions = {}) {
    this.options = {
      clearScreen: true,
      ...options,
    };
  }

  async start(): Promise<void> {
    console.log('\n  \x1b[36m\x1b[1mBugsBasters\x1b[0m \x1b[2mWatch Mode\x1b[0m\n');
    console.log('  Watching for file changes...\n');
    console.log('  Press \x1b[1mq\x1b[0m to quit, \x1b[1mEnter\x1b[0m to re-run tests\n');

    // Initial run
    await this.runTests();

    // Setup file watchers
    this.setupWatchers();

    // Setup keyboard input
    this.setupKeyboardInput();
  }

  private setupWatchers(): void {
    const rootDir = this.options.rootDir || process.cwd();

    // Watch for changes in common source directories
    const dirsToWatch = [
      rootDir,
      path.join(rootDir, 'src'),
      path.join(rootDir, 'lib'),
      path.join(rootDir, 'tests'),
      path.join(rootDir, 'test'),
      path.join(rootDir, '__tests__'),
    ];

    for (const dir of dirsToWatch) {
      this.watchDir(dir);
    }
  }

  private watchDir(dir: string): void {
    if (this.watchedDirs.has(dir)) return;

    try {
      if (!fs.existsSync(dir)) return;

      const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        // Ignore node_modules, dist, etc.
        if (this.shouldIgnore(filename)) return;

        // Only watch relevant file types
        if (!this.isRelevantFile(filename)) return;

        this.scheduleRun();
      });

      this.watchers.push(watcher);
      this.watchedDirs.add(dir);
    } catch (err) {
      // Directory doesn't exist or can't be watched, ignore
    }
  }

  private shouldIgnore(filename: string): boolean {
    const ignorePatterns = [
      'node_modules',
      'dist',
      'build',
      'coverage',
      '.git',
      '__snapshots__',
    ];

    return ignorePatterns.some((pattern) => filename.includes(pattern));
  }

  private isRelevantFile(filename: string): boolean {
    const relevantExtensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs'];
    return relevantExtensions.some((ext) => filename.endsWith(ext));
  }

  private scheduleRun(): void {
    // Debounce multiple rapid file changes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.runTests();
    }, 100);
  }

  private async runTests(): Promise<void> {
    if (this.isRunning) return;

    this.isRunning = true;

    if (this.options.clearScreen) {
      console.clear();
    }

    console.log('  \x1b[2m' + new Date().toLocaleTimeString() + '\x1b[0m Running tests...\n');

    try {
      await run(this.options);
    } catch (err: any) {
      console.error('\x1b[31mError:\x1b[0m', err.message);
    }

    console.log('\n  \x1b[2mWatching for file changes...\x1b[0m');
    console.log('  Press \x1b[1mq\x1b[0m to quit, \x1b[1mEnter\x1b[0m to re-run tests\n');

    this.isRunning = false;
  }

  private setupKeyboardInput(): void {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');

      process.stdin.on('data', (key: string) => {
        // Ctrl+C or q to quit
        if (key === '\u0003' || key === 'q' || key === 'Q') {
          this.stop();
          process.exit(0);
        }

        // Enter to re-run
        if (key === '\r' || key === '\n') {
          this.runTests();
        }

        // a to run all tests (clear filter)
        if (key === 'a' || key === 'A') {
          this.options.pattern = undefined;
          this.runTests();
        }

        // u to update snapshots
        if (key === 'u' || key === 'U') {
          const prevUpdate = this.options.updateSnapshots;
          this.options.updateSnapshots = true;
          this.runTests().then(() => {
            this.options.updateSnapshots = prevUpdate;
          });
        }
      });
    }
  }

  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    console.log('\n  \x1b[33mWatch mode stopped.\x1b[0m\n');
  }
}

export async function watch(options?: WatchOptions): Promise<void> {
  const watcher = new TestWatcher(options);
  await watcher.start();
}
