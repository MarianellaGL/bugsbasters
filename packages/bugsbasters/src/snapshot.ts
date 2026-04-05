import * as fs from 'fs';
import * as path from 'path';
import { createDiff } from './diff';

interface SnapshotData {
  [key: string]: string;
}

interface SnapshotState {
  filePath: string;
  snapshots: SnapshotData;
  dirty: boolean;
  updated: string[];
  added: string[];
  removed: string[];
  matched: string[];
  unmatched: string[];
}

const SNAPSHOT_DIR = '__snapshots__';
const SNAPSHOT_EXT = '.snap';
const SNAPSHOT_STATE_KEY = '__bugsbasters_snapshot_state__';
const SNAPSHOT_UPDATE_KEY = '__bugsbasters_snapshot_update__';
const SNAPSHOT_COUNTER_KEY = '__bugsbasters_snapshot_counter__';

function getCurrentState(): SnapshotState | null {
  return (globalThis as any)[SNAPSHOT_STATE_KEY] || null;
}

function setCurrentState(state: SnapshotState | null): void {
  (globalThis as any)[SNAPSHOT_STATE_KEY] = state;
}

function getSnapshotCounter(): number {
  return (globalThis as any)[SNAPSHOT_COUNTER_KEY] || 0;
}

function setSnapshotCounter(value: number): void {
  (globalThis as any)[SNAPSHOT_COUNTER_KEY] = value;
}

function shouldUpdateSnapshots(): boolean {
  return (globalThis as any)[SNAPSHOT_UPDATE_KEY] || false;
}

export function setUpdateSnapshots(update: boolean): void {
  (globalThis as any)[SNAPSHOT_UPDATE_KEY] = update;
}

export function initSnapshotState(testFilePath: string): void {
  const dir = path.dirname(testFilePath);
  const baseName = path.basename(testFilePath);
  const snapshotDir = path.join(dir, SNAPSHOT_DIR);
  const snapshotFile = path.join(snapshotDir, baseName + SNAPSHOT_EXT);

  let snapshots: SnapshotData = {};

  if (fs.existsSync(snapshotFile)) {
    try {
      const content = fs.readFileSync(snapshotFile, 'utf-8');
      snapshots = parseSnapshotFile(content);
    } catch {
      snapshots = {};
    }
  }

  setCurrentState({
    filePath: snapshotFile,
    snapshots,
    dirty: false,
    updated: [],
    added: [],
    removed: [],
    matched: [],
    unmatched: [],
  });

  setSnapshotCounter(0);
}

export function resetSnapshotCounter(): void {
  setSnapshotCounter(0);
}

export function matchSnapshot(testName: string, received: unknown): { pass: boolean; message: string } {
  const currentState = getCurrentState();

  if (!currentState) {
    return { pass: false, message: 'Snapshot state not initialized' };
  }

  const counter = getSnapshotCounter() + 1;
  setSnapshotCounter(counter);

  const key = `${testName} ${counter}`;
  const serialized = serializeSnapshot(received);
  const existing = currentState.snapshots[key];
  const updateMode = shouldUpdateSnapshots();

  if (existing === undefined) {
    // New snapshot
    if (updateMode) {
      currentState.snapshots[key] = serialized;
      currentState.dirty = true;
      currentState.added.push(key);
      return { pass: true, message: 'Snapshot created' };
    } else {
      currentState.added.push(key);
      return {
        pass: false,
        message: `New snapshot. Run with --update-snapshots to create it.\n\nReceived:\n${serialized}`
      };
    }
  }

  if (existing === serialized) {
    currentState.matched.push(key);
    return { pass: true, message: 'Snapshot matched' };
  }

  // Mismatch
  if (updateMode) {
    currentState.snapshots[key] = serialized;
    currentState.dirty = true;
    currentState.updated.push(key);
    return { pass: true, message: 'Snapshot updated' };
  }

  currentState.unmatched.push(key);
  const diff = createDiff(existing, serialized);
  return {
    pass: false,
    message: `Snapshot mismatch:\n\n${diff}`,
  };
}

export function saveSnapshots(): void {
  const currentState = getCurrentState();

  if (!currentState || !currentState.dirty) {
    return;
  }

  const dir = path.dirname(currentState.filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const content = serializeSnapshotFile(currentState.snapshots);
  fs.writeFileSync(currentState.filePath, content);
}

export function getSnapshotSummary(): {
  added: number;
  updated: number;
  matched: number;
  unmatched: number;
} | null {
  const currentState = getCurrentState();

  if (!currentState) return null;

  return {
    added: currentState.added.length,
    updated: currentState.updated.length,
    matched: currentState.matched.length,
    unmatched: currentState.unmatched.length,
  };
}

function serializeSnapshot(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseSnapshotFile(content: string): SnapshotData {
  const snapshots: SnapshotData = {};
  const regex = /exports\[`([^`]+)`\]\s*=\s*`([\s\S]*?)`;/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const key = match[1];
    const value = match[2].replace(/\\`/g, '`').replace(/\\\\/g, '\\');
    snapshots[key] = value;
  }

  return snapshots;
}

function serializeSnapshotFile(snapshots: SnapshotData): string {
  const lines: string[] = ['// BugsBasters Snapshot v1', ''];

  const sortedKeys = Object.keys(snapshots).sort();

  for (const key of sortedKeys) {
    const value = snapshots[key]
      .replace(/\\/g, '\\\\')
      .replace(/`/g, '\\`');
    lines.push(`exports[\`${key}\`] = \`${value}\`;`);
    lines.push('');
  }

  return lines.join('\n');
}

export function clearSnapshotState(): void {
  setCurrentState(null);
  setSnapshotCounter(0);
}
