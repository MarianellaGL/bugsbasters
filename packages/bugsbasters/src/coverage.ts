import * as fs from 'fs';
import * as path from 'path';
import * as v8 from 'v8';

interface CoverageEntry {
  url: string;
  functions: FunctionCoverage[];
}

interface FunctionCoverage {
  functionName: string;
  ranges: CoverageRange[];
  isBlockCoverage: boolean;
}

interface CoverageRange {
  startOffset: number;
  endOffset: number;
  count: number;
}

interface FileCoverage {
  path: string;
  lines: {
    total: number;
    covered: number;
    percentage: number;
  };
  functions: {
    total: number;
    covered: number;
    percentage: number;
  };
  branches: {
    total: number;
    covered: number;
    percentage: number;
  };
}

interface CoverageSummary {
  files: FileCoverage[];
  total: {
    lines: { total: number; covered: number; percentage: number };
    functions: { total: number; covered: number; percentage: number };
    branches: { total: number; covered: number; percentage: number };
  };
}

let coverageDir: string | null = null;

export function startCoverage(): void {
  // Create temp directory for coverage data
  coverageDir = path.join(process.cwd(), '.bugsbasters-coverage-' + Date.now());
  fs.mkdirSync(coverageDir, { recursive: true });

  // Enable V8 coverage
  process.env.NODE_V8_COVERAGE = coverageDir;
}

export function stopCoverage(): CoverageSummary | null {
  if (!coverageDir) return null;

  // Force V8 to write coverage data
  // Note: In Node.js, coverage is written on process exit
  // We need to use inspector module for real-time coverage

  return null;
}

export async function collectCoverage(rootDir: string): Promise<CoverageSummary> {
  const inspector = await import('inspector');
  const session = new inspector.Session();
  session.connect();

  // Start precise coverage
  await new Promise<void>((resolve, reject) => {
    session.post('Profiler.enable', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  await new Promise<void>((resolve, reject) => {
    session.post('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
    }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  return {
    files: [],
    total: {
      lines: { total: 0, covered: 0, percentage: 0 },
      functions: { total: 0, covered: 0, percentage: 0 },
      branches: { total: 0, covered: 0, percentage: 0 },
    },
  };
}

export async function getCoverageData(session: any, rootDir: string): Promise<CoverageSummary> {
  const result = await new Promise<any>((resolve, reject) => {
    session.post('Profiler.takePreciseCoverage', (err: Error | null, data: any) => {
      if (err) reject(err);
      else resolve(data);
    });
  });

  const files: FileCoverage[] = [];
  const entries: CoverageEntry[] = result.result || [];

  for (const entry of entries) {
    // Only process files in the project
    if (!entry.url.startsWith('file://')) continue;

    const filePath = entry.url.replace('file://', '').replace(/^\/([A-Z]:)/i, '$1');

    // Skip node_modules and dist
    if (filePath.includes('node_modules') || filePath.includes('dist')) continue;

    // Only include files under rootDir
    if (!filePath.startsWith(rootDir)) continue;

    const coverage = processFileCoverage(entry, filePath);
    if (coverage) {
      files.push(coverage);
    }
  }

  // Calculate totals
  const total = {
    lines: { total: 0, covered: 0, percentage: 0 },
    functions: { total: 0, covered: 0, percentage: 0 },
    branches: { total: 0, covered: 0, percentage: 0 },
  };

  for (const file of files) {
    total.lines.total += file.lines.total;
    total.lines.covered += file.lines.covered;
    total.functions.total += file.functions.total;
    total.functions.covered += file.functions.covered;
    total.branches.total += file.branches.total;
    total.branches.covered += file.branches.covered;
  }

  total.lines.percentage = total.lines.total > 0
    ? (total.lines.covered / total.lines.total) * 100
    : 0;
  total.functions.percentage = total.functions.total > 0
    ? (total.functions.covered / total.functions.total) * 100
    : 0;
  total.branches.percentage = total.branches.total > 0
    ? (total.branches.covered / total.branches.total) * 100
    : 0;

  return { files, total };
}

function processFileCoverage(entry: CoverageEntry, filePath: string): FileCoverage | null {
  try {
    const source = fs.readFileSync(filePath, 'utf-8');
    const lines = source.split('\n');

    // Track which lines are covered
    const lineCoverage = new Array(lines.length).fill(0);
    let functionsCovered = 0;
    let functionsTotal = 0;
    let branchesCovered = 0;
    let branchesTotal = 0;

    for (const func of entry.functions) {
      if (func.functionName) {
        functionsTotal++;
        if (func.ranges.some((r) => r.count > 0)) {
          functionsCovered++;
        }
      }

      for (const range of func.ranges) {
        // Map byte offsets to line numbers
        let currentOffset = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineLength = lines[i].length + 1; // +1 for newline
          const lineStart = currentOffset;
          const lineEnd = currentOffset + lineLength;

          if (range.startOffset < lineEnd && range.endOffset > lineStart) {
            lineCoverage[i] = Math.max(lineCoverage[i], range.count);
          }

          currentOffset = lineEnd;
        }

        // Count branches (simplified)
        if (func.isBlockCoverage) {
          branchesTotal++;
          if (range.count > 0) {
            branchesCovered++;
          }
        }
      }
    }

    // Count non-empty lines
    const nonEmptyLines = lines.filter((line, i) => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
    });

    const coveredLines = lineCoverage.filter((count, i) => {
      const line = lines[i]?.trim() || '';
      return count > 0 && line.length > 0 && !line.startsWith('//');
    }).length;

    return {
      path: filePath,
      lines: {
        total: nonEmptyLines.length,
        covered: coveredLines,
        percentage: nonEmptyLines.length > 0 ? (coveredLines / nonEmptyLines.length) * 100 : 0,
      },
      functions: {
        total: functionsTotal,
        covered: functionsCovered,
        percentage: functionsTotal > 0 ? (functionsCovered / functionsTotal) * 100 : 0,
      },
      branches: {
        total: branchesTotal,
        covered: branchesCovered,
        percentage: branchesTotal > 0 ? (branchesCovered / branchesTotal) * 100 : 0,
      },
    };
  } catch {
    return null;
  }
}

export function printCoverageReport(coverage: CoverageSummary): void {
  console.log('\n  \x1b[1mCoverage Report\x1b[0m\n');

  // Print header
  console.log('  ' + '-'.repeat(80));
  console.log(
    '  ' +
    'File'.padEnd(40) +
    'Lines'.padEnd(12) +
    'Functions'.padEnd(12) +
    'Branches'.padEnd(12)
  );
  console.log('  ' + '-'.repeat(80));

  // Print files
  for (const file of coverage.files) {
    const relativePath = path.relative(process.cwd(), file.path);
    const displayPath = relativePath.length > 38 ? '...' + relativePath.slice(-35) : relativePath;

    const linesStr = formatPercentage(file.lines.percentage);
    const funcsStr = formatPercentage(file.functions.percentage);
    const branchStr = formatPercentage(file.branches.percentage);

    console.log(
      '  ' +
      displayPath.padEnd(40) +
      linesStr.padEnd(12) +
      funcsStr.padEnd(12) +
      branchStr.padEnd(12)
    );
  }

  // Print totals
  console.log('  ' + '-'.repeat(80));
  console.log(
    '  ' +
    '\x1b[1mTotal\x1b[0m'.padEnd(40) +
    formatPercentage(coverage.total.lines.percentage).padEnd(12) +
    formatPercentage(coverage.total.functions.percentage).padEnd(12) +
    formatPercentage(coverage.total.branches.percentage).padEnd(12)
  );
  console.log('  ' + '-'.repeat(80));
  console.log();
}

function formatPercentage(value: number): string {
  const formatted = value.toFixed(1) + '%';
  if (value >= 80) {
    return '\x1b[32m' + formatted + '\x1b[0m'; // green
  } else if (value >= 50) {
    return '\x1b[33m' + formatted + '\x1b[0m'; // yellow
  } else {
    return '\x1b[31m' + formatted + '\x1b[0m'; // red
  }
}

export function generateLcovReport(coverage: CoverageSummary): string {
  let lcov = '';

  for (const file of coverage.files) {
    lcov += `TN:\n`;
    lcov += `SF:${file.path}\n`;
    lcov += `FNF:${file.functions.total}\n`;
    lcov += `FNH:${file.functions.covered}\n`;
    lcov += `LF:${file.lines.total}\n`;
    lcov += `LH:${file.lines.covered}\n`;
    lcov += `BRF:${file.branches.total}\n`;
    lcov += `BRH:${file.branches.covered}\n`;
    lcov += `end_of_record\n`;
  }

  return lcov;
}
