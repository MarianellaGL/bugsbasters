import type { TestSummary, TestResult } from './types';

interface TestSuite {
  name: string;
  tests: TestResult[];
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
}

function groupTestsBySuite(results: TestResult[]): TestSuite[] {
  const suites = new Map<string, TestResult[]>();

  for (const result of results) {
    const parts = result.name.split(' > ');
    const suiteName = parts.length > 1 ? parts.slice(0, -1).join(' > ') : 'Root';

    if (!suites.has(suiteName)) {
      suites.set(suiteName, []);
    }
    suites.get(suiteName)!.push({
      ...result,
      name: parts[parts.length - 1],
    });
  }

  return Array.from(suites.entries()).map(([name, tests]) => ({
    name,
    tests,
    passed: tests.filter(t => t.status === 'passed').length,
    failed: tests.filter(t => t.status === 'failed').length,
    skipped: tests.filter(t => t.status === 'skipped').length,
    duration: tests.reduce((acc, t) => acc + t.durationMs, 0),
  }));
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export function generateHtmlReport(summary: TestSummary): string {
  const suites = groupTestsBySuite(summary.results);
  const passRate = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;
  const avgDuration = summary.total > 0 ? Math.round(summary.durationMs / summary.total) : 0;

  const statusClass = summary.failed === 0 ? 'success' : 'failure';
  const statusText = summary.failed === 0 ? 'All Tests Passed' : `${summary.failed} Test${summary.failed > 1 ? 's' : ''} Failed`;

  const suitesHtml = suites.map(suite => {
    const suiteStatus = suite.failed > 0 ? 'failed' : suite.skipped === suite.tests.length ? 'skipped' : 'passed';

    const testsHtml = suite.tests.map(test => {
      const statusIcon = test.status === 'passed' ? '✓' : test.status === 'failed' ? '✗' : '○';
      const errorHtml = test.error ? `
        <div class="test-error">
          <div class="error-message">${escapeHtml(test.error.message)}</div>
          ${test.error.expected !== undefined && test.error.received !== undefined ? `
            <div class="error-diff">
              <div class="expected"><span class="label">Expected:</span> <code>${escapeHtml(test.error.expected)}</code></div>
              <div class="received"><span class="label">Received:</span> <code>${escapeHtml(test.error.received)}</code></div>
            </div>
          ` : ''}
          ${test.error.stack ? `<pre class="stack-trace">${escapeHtml(test.error.stack)}</pre>` : ''}
        </div>
      ` : '';

      return `
        <div class="test-item ${test.status}">
          <div class="test-row">
            <span class="test-icon">${statusIcon}</span>
            <span class="test-name">${escapeHtml(test.name)}</span>
            <span class="test-duration">${formatDuration(test.durationMs)}</span>
          </div>
          ${errorHtml}
        </div>
      `;
    }).join('');

    return `
      <div class="suite ${suiteStatus}">
        <div class="suite-header" onclick="toggleSuite(this)">
          <div class="suite-info">
            <span class="suite-toggle">▶</span>
            <span class="suite-name">${escapeHtml(suite.name)}</span>
            <span class="suite-stats">
              <span class="stat passed">${suite.passed} passed</span>
              ${suite.failed > 0 ? `<span class="stat failed">${suite.failed} failed</span>` : ''}
              ${suite.skipped > 0 ? `<span class="stat skipped">${suite.skipped} skipped</span>` : ''}
            </span>
          </div>
          <span class="suite-duration">${formatDuration(suite.duration)}</span>
        </div>
        <div class="suite-tests">
          ${testsHtml}
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BugsBasters Test Report</title>
  <style>
    :root {
      --color-pass: #00ff88;
      --color-pass-dim: #00cc6a;
      --color-pass-bg: rgba(0, 255, 136, 0.15);
      --color-pass-glow: rgba(0, 255, 136, 0.4);
      --color-fail: #ff4757;
      --color-fail-dim: #ff6b7a;
      --color-fail-bg: rgba(255, 71, 87, 0.15);
      --color-fail-glow: rgba(255, 71, 87, 0.4);
      --color-skip: #ffa502;
      --color-skip-bg: rgba(255, 165, 2, 0.15);
      --color-bg: #0a0a0f;
      --color-bg-elevated: #12121a;
      --color-card: #1a1a24;
      --color-card-hover: #22222e;
      --color-border: #2a2a3a;
      --color-border-bright: #3a3a4a;
      --color-text: #f0f0f5;
      --color-text-muted: #8888a0;
      --color-accent: #6c5ce7;
      --color-accent-bright: #a29bfe;
      --shadow-glow: 0 0 20px rgba(108, 92, 231, 0.3);
      --shadow-card: 0 4px 24px rgba(0, 0, 0, 0.4);
      --radius: 16px;
      --radius-sm: 8px;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--color-bg);
      color: var(--color-text);
      line-height: 1.6;
      min-height: 100vh;
    }

    .container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 2.5rem;
    }

    /* Header */
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--color-border);
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .logo-icon {
      width: 56px;
      height: 56px;
      filter: drop-shadow(0 0 12px rgba(255, 71, 87, 0.5));
    }

    .logo-icon svg {
      width: 100%;
      height: 100%;
    }

    .logo-text {
      font-size: 2rem;
      font-weight: 800;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, #ff4757 0%, #ff6b7a 50%, #ffa502 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      text-shadow: 0 0 40px rgba(255, 71, 87, 0.3);
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.625rem;
      padding: 0.75rem 1.5rem;
      border-radius: var(--radius);
      font-weight: 700;
      font-size: 0.9375rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border: 2px solid;
    }

    .status-badge.success {
      background: var(--color-pass-bg);
      color: var(--color-pass);
      border-color: var(--color-pass);
      box-shadow: 0 0 20px var(--color-pass-glow), inset 0 0 20px var(--color-pass-glow);
    }

    .status-badge.failure {
      background: var(--color-fail-bg);
      color: var(--color-fail);
      border-color: var(--color-fail);
      box-shadow: 0 0 20px var(--color-fail-glow), inset 0 0 20px var(--color-fail-glow);
      animation: pulse-fail 2s ease-in-out infinite;
    }

    @keyframes pulse-fail {
      0%, 100% { box-shadow: 0 0 20px var(--color-fail-glow), inset 0 0 20px var(--color-fail-glow); }
      50% { box-shadow: 0 0 30px var(--color-fail-glow), inset 0 0 30px var(--color-fail-glow); }
    }

    .status-badge .icon {
      font-size: 1.125rem;
    }

    /* Metrics Grid */
    .metrics {
      display: grid;
      grid-template-columns: repeat(6, 1fr);
      gap: 1.25rem;
      margin-bottom: 2.5rem;
    }

    .metric-card {
      background: var(--color-card);
      border-radius: var(--radius);
      padding: 1.75rem;
      box-shadow: var(--shadow-card);
      border: 1px solid var(--color-border);
      text-align: center;
      transition: all 0.3s ease;
      position: relative;
      overflow: hidden;
    }

    .metric-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--color-border-bright);
    }

    .metric-card:hover {
      transform: translateY(-4px);
      border-color: var(--color-border-bright);
      box-shadow: var(--shadow-card), var(--shadow-glow);
    }

    .metric-card.highlight-pass::before { background: var(--color-pass); }
    .metric-card.highlight-fail::before { background: var(--color-fail); }
    .metric-card.highlight-skip::before { background: var(--color-skip); }

    .metric-value {
      font-size: 3rem;
      font-weight: 800;
      line-height: 1;
      margin-bottom: 0.5rem;
      font-variant-numeric: tabular-nums;
    }

    .metric-value.passed { color: var(--color-pass); text-shadow: 0 0 20px var(--color-pass-glow); }
    .metric-value.failed { color: var(--color-fail); text-shadow: 0 0 20px var(--color-fail-glow); }
    .metric-value.skipped { color: var(--color-skip); }
    .metric-value.neutral { color: var(--color-text); }

    .metric-label {
      font-size: 0.75rem;
      color: var(--color-text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* Progress Bar */
    .progress-section {
      background: var(--color-card);
      border-radius: var(--radius);
      padding: 2rem;
      margin-bottom: 2.5rem;
      box-shadow: var(--shadow-card);
      border: 1px solid var(--color-border);
    }

    .progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }

    .progress-title {
      font-weight: 700;
      font-size: 1.125rem;
      color: var(--color-text);
    }

    .progress-percent {
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--color-pass);
      text-shadow: 0 0 30px var(--color-pass-glow);
      font-variant-numeric: tabular-nums;
    }

    .progress-bar {
      height: 16px;
      background: var(--color-bg-elevated);
      border-radius: 9999px;
      overflow: hidden;
      display: flex;
      box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
    }

    .progress-segment {
      height: 100%;
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .progress-segment.passed {
      background: linear-gradient(90deg, var(--color-pass-dim), var(--color-pass));
      box-shadow: 0 0 10px var(--color-pass-glow);
    }
    .progress-segment.failed {
      background: linear-gradient(90deg, var(--color-fail), var(--color-fail-dim));
      box-shadow: 0 0 10px var(--color-fail-glow);
    }
    .progress-segment.skipped {
      background: var(--color-skip);
    }

    .progress-legend {
      display: flex;
      gap: 2rem;
      margin-top: 1.25rem;
      font-size: 0.875rem;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      color: var(--color-text-muted);
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .legend-dot.passed { background: var(--color-pass); box-shadow: 0 0 8px var(--color-pass-glow); }
    .legend-dot.failed { background: var(--color-fail); box-shadow: 0 0 8px var(--color-fail-glow); }
    .legend-dot.skipped { background: var(--color-skip); }

    /* Test Suites */
    .suites-section {
      background: var(--color-card);
      border-radius: var(--radius);
      box-shadow: var(--shadow-card);
      border: 1px solid var(--color-border);
      overflow: hidden;
    }

    .suites-header {
      padding: 1.25rem 1.75rem;
      border-bottom: 1px solid var(--color-border);
      font-weight: 700;
      font-size: 1.125rem;
      background: var(--color-bg-elevated);
      color: var(--color-text);
    }

    .suite {
      border-bottom: 1px solid var(--color-border);
    }

    .suite:last-child {
      border-bottom: none;
    }

    .suite-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.75rem;
      cursor: pointer;
      transition: all 0.2s ease;
      border-left: 3px solid transparent;
    }

    .suite-header:hover {
      background: var(--color-card-hover);
    }

    .suite.passed .suite-header { border-left-color: var(--color-pass); }
    .suite.failed .suite-header { border-left-color: var(--color-fail); }
    .suite.skipped .suite-header { border-left-color: var(--color-skip); }

    .suite-info {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .suite-toggle {
      color: var(--color-text-muted);
      font-size: 0.75rem;
      transition: transform 0.3s ease;
      width: 1rem;
    }

    .suite.expanded .suite-toggle {
      transform: rotate(90deg);
    }

    .suite-name {
      font-weight: 600;
      font-size: 1rem;
    }

    .suite-stats {
      display: flex;
      gap: 0.625rem;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .suite-stats .stat {
      padding: 0.25rem 0.75rem;
      border-radius: var(--radius-sm);
    }

    .suite-stats .stat.passed { background: var(--color-pass-bg); color: var(--color-pass); }
    .suite-stats .stat.failed { background: var(--color-fail-bg); color: var(--color-fail); }
    .suite-stats .stat.skipped { background: var(--color-skip-bg); color: var(--color-skip); }

    .suite-duration {
      font-size: 0.875rem;
      color: var(--color-text-muted);
      font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
      font-weight: 500;
    }

    .suite-tests {
      display: none;
      background: var(--color-bg);
      border-top: 1px solid var(--color-border);
    }

    .suite.expanded .suite-tests {
      display: block;
    }

    .test-item {
      padding: 1rem 1.75rem 1rem 3.5rem;
      border-bottom: 1px solid var(--color-border);
      transition: background 0.2s ease;
    }

    .test-item:last-child {
      border-bottom: none;
    }

    .test-item:hover {
      background: var(--color-bg-elevated);
    }

    .test-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .test-icon {
      font-size: 1.125rem;
      width: 1.5rem;
      text-align: center;
      font-weight: bold;
    }

    .test-item.passed .test-icon { color: var(--color-pass); text-shadow: 0 0 8px var(--color-pass-glow); }
    .test-item.failed .test-icon { color: var(--color-fail); text-shadow: 0 0 8px var(--color-fail-glow); }
    .test-item.skipped .test-icon { color: var(--color-skip); }

    .test-name {
      flex: 1;
      font-size: 0.9375rem;
      font-weight: 500;
    }

    .test-duration {
      font-size: 0.8125rem;
      color: var(--color-text-muted);
      font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
      background: var(--color-bg-elevated);
      padding: 0.25rem 0.625rem;
      border-radius: var(--radius-sm);
    }

    .test-error {
      margin-top: 1rem;
      padding: 1.25rem;
      background: var(--color-fail-bg);
      border: 1px solid rgba(255, 71, 87, 0.3);
      border-radius: var(--radius-sm);
      font-size: 0.875rem;
    }

    .error-message {
      color: var(--color-fail);
      font-weight: 600;
      margin-bottom: 1rem;
      font-size: 0.9375rem;
    }

    .error-diff {
      font-family: 'JetBrains Mono', 'SF Mono', Monaco, monospace;
      font-size: 0.8125rem;
      line-height: 1.8;
    }

    .error-diff .label {
      font-weight: 700;
      display: inline-block;
      width: 80px;
    }

    .error-diff .expected {
      color: var(--color-pass);
    }

    .error-diff .received {
      color: var(--color-fail);
    }

    .error-diff code {
      background: rgba(0,0,0,0.3);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      border: 1px solid var(--color-border);
    }

    .stack-trace {
      margin-top: 1rem;
      padding: 1rem;
      background: rgba(0,0,0,0.3);
      border-radius: var(--radius-sm);
      font-size: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--color-text-muted);
      border: 1px solid var(--color-border);
    }

    /* Footer */
    footer {
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid var(--color-border);
      text-align: center;
      font-size: 0.875rem;
      color: var(--color-text-muted);
    }

    footer a {
      color: var(--color-accent-bright);
      text-decoration: none;
      font-weight: 600;
    }

    footer a:hover {
      text-decoration: underline;
    }

    /* Responsive */
    @media (max-width: 1024px) {
      .metrics {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    @media (max-width: 640px) {
      .container {
        padding: 1.25rem;
      }

      header {
        flex-direction: column;
        gap: 1.25rem;
        text-align: center;
      }

      .metrics {
        grid-template-columns: repeat(2, 1fr);
      }

      .metric-value {
        font-size: 2rem;
      }

      .suite-stats {
        display: none;
      }

      .progress-legend {
        flex-wrap: wrap;
        gap: 1rem;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo">
        <div class="logo-icon">
          <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <!-- Circle background -->
            <circle cx="50" cy="50" r="46" fill="#fff" stroke="#e53935" stroke-width="4"/>

            <!-- Ladybug body -->
            <ellipse cx="50" cy="55" rx="22" ry="26" fill="#e53935"/>

            <!-- Ladybug head -->
            <circle cx="50" cy="28" r="12" fill="#1a1a1a"/>

            <!-- Wing line -->
            <line x1="50" y1="32" x2="50" y2="78" stroke="#1a1a1a" stroke-width="2"/>

            <!-- Spots -->
            <circle cx="38" cy="48" r="4" fill="#1a1a1a"/>
            <circle cx="62" cy="48" r="4" fill="#1a1a1a"/>
            <circle cx="40" cy="62" r="3.5" fill="#1a1a1a"/>
            <circle cx="60" cy="62" r="3.5" fill="#1a1a1a"/>
            <circle cx="44" cy="74" r="3" fill="#1a1a1a"/>
            <circle cx="56" cy="74" r="3" fill="#1a1a1a"/>

            <!-- Antennae -->
            <path d="M44 22 Q40 12 35 10" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>
            <path d="M56 22 Q60 12 65 10" stroke="#1a1a1a" stroke-width="2" fill="none" stroke-linecap="round"/>

            <!-- Eyes -->
            <circle cx="45" cy="26" r="2.5" fill="#fff"/>
            <circle cx="55" cy="26" r="2.5" fill="#fff"/>

            <!-- Red "NO" slash -->
            <line x1="18" y1="82" x2="82" y2="18" stroke="#e53935" stroke-width="8" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="logo-text">BugsBasters</span>
      </div>
      <div class="status-badge ${statusClass}">
        <span class="icon">${summary.failed === 0 ? '✓' : '✗'}</span>
        ${statusText}
      </div>
    </header>

    <div class="metrics">
      <div class="metric-card">
        <div class="metric-value neutral">${summary.total}</div>
        <div class="metric-label">Total Tests</div>
      </div>
      <div class="metric-card highlight-pass">
        <div class="metric-value passed">${summary.passed}</div>
        <div class="metric-label">Passed</div>
      </div>
      <div class="metric-card highlight-fail">
        <div class="metric-value failed">${summary.failed}</div>
        <div class="metric-label">Failed</div>
      </div>
      <div class="metric-card highlight-skip">
        <div class="metric-value skipped">${summary.skipped}</div>
        <div class="metric-label">Skipped</div>
      </div>
      <div class="metric-card">
        <div class="metric-value neutral">${formatDuration(summary.durationMs)}</div>
        <div class="metric-label">Duration</div>
      </div>
      <div class="metric-card">
        <div class="metric-value neutral">${avgDuration}ms</div>
        <div class="metric-label">Avg / Test</div>
      </div>
    </div>

    <div class="progress-section">
      <div class="progress-header">
        <span class="progress-title">Pass Rate</span>
        <span class="progress-percent">${passRate}%</span>
      </div>
      <div class="progress-bar">
        <div class="progress-segment passed" style="width: ${(summary.passed / summary.total) * 100}%"></div>
        <div class="progress-segment failed" style="width: ${(summary.failed / summary.total) * 100}%"></div>
        <div class="progress-segment skipped" style="width: ${(summary.skipped / summary.total) * 100}%"></div>
      </div>
      <div class="progress-legend">
        <div class="legend-item">
          <span class="legend-dot passed"></span>
          <span>Passed (${summary.passed})</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot failed"></span>
          <span>Failed (${summary.failed})</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot skipped"></span>
          <span>Skipped (${summary.skipped})</span>
        </div>
      </div>
    </div>

    <div class="suites-section">
      <div class="suites-header">Test Suites (${suites.length})</div>
      ${suitesHtml}
    </div>

    <footer>
      <p>Generated by <a href="https://github.com/bugsbasters/bugsbasters">BugsBasters</a> at ${new Date().toLocaleString()}</p>
    </footer>
  </div>

  <script>
    function toggleSuite(header) {
      const suite = header.parentElement;
      suite.classList.toggle('expanded');
    }

    // Auto-expand failed suites
    document.querySelectorAll('.suite.failed').forEach(suite => {
      suite.classList.add('expanded');
    });
  </script>
</body>
</html>`;
}
