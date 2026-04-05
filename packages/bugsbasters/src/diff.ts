/**
 * Simple diff utility for comparing strings
 */

export function createDiff(expected: string, received: string): string {
  const expectedLines = expected.split('\n');
  const receivedLines = received.split('\n');

  const result: string[] = [];
  const maxLen = Math.max(expectedLines.length, receivedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const exp = expectedLines[i];
    const rec = receivedLines[i];

    if (exp === rec) {
      result.push(`  ${exp ?? ''}`);
    } else if (exp !== undefined && rec !== undefined) {
      result.push(`- ${exp}`);
      result.push(`+ ${rec}`);
    } else if (exp !== undefined) {
      result.push(`- ${exp}`);
    } else if (rec !== undefined) {
      result.push(`+ ${rec}`);
    }
  }

  return result.join('\n');
}

export function formatDiff(expected: unknown, received: unknown): string {
  const expStr = formatValue(expected);
  const recStr = formatValue(received);

  if (expStr === recStr) {
    return `Values are equal but different references`;
  }

  return `Expected: ${expStr}\nReceived: ${recStr}`;
}

function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    if (value.length <= 5) {
      return `[${value.map(formatValue).join(', ')}]`;
    }
    return `Array(${value.length})`;
  }
  if (typeof value === 'object') {
    try {
      const json = JSON.stringify(value, null, 2);
      if (json.length <= 100) return json;
      return `Object ${json.slice(0, 100)}...`;
    } catch {
      return '[Object]';
    }
  }
  if (typeof value === 'function') {
    return `[Function: ${value.name || 'anonymous'}]`;
  }
  return String(value);
}
