import type { TestFunction, TestOptions, TestCase, DescribeBlock } from './types';

// Use globalThis to share test registry across module instances
// This is necessary because ESM modules can have separate instances
const REGISTRY_KEY = '__bugsbasters_registry__';
const FILE_PATH_KEY = '__bugsbasters_filePath__';

interface GlobalRegistry {
  rootDescribe: DescribeBlock;
  currentDescribe: DescribeBlock;
}

function getGlobalRegistry(): GlobalRegistry {
  if (!(globalThis as any)[REGISTRY_KEY]) {
    const rootDescribe: DescribeBlock = {
      name: '',
      tests: [],
      beforeEach: [],
      afterEach: [],
      beforeAll: [],
      afterAll: [],
      children: [],
    };
    (globalThis as any)[REGISTRY_KEY] = {
      rootDescribe,
      currentDescribe: rootDescribe,
    };
  }
  return (globalThis as any)[REGISTRY_KEY];
}

function getCurrentFilePath(): string {
  return (globalThis as any)[FILE_PATH_KEY] || '';
}

export function setCurrentFilePath(filePath: string): void {
  (globalThis as any)[FILE_PATH_KEY] = filePath;
}

export function getTestRegistry(): DescribeBlock {
  return getGlobalRegistry().rootDescribe;
}

export function clearTestRegistry(): void {
  const registry = getGlobalRegistry();
  registry.rootDescribe.tests = [];
  registry.rootDescribe.children = [];
  registry.rootDescribe.beforeEach = [];
  registry.rootDescribe.afterEach = [];
  registry.rootDescribe.beforeAll = [];
  registry.rootDescribe.afterAll = [];
  registry.currentDescribe = registry.rootDescribe;
}

/**
 * Define a test case
 */
export function test(name: string, fn: TestFunction, options?: TestOptions): void {
  const registry = getGlobalRegistry();
  const testCase: TestCase = {
    name,
    fn,
    options: options || {},
    filePath: getCurrentFilePath(),
  };
  registry.currentDescribe.tests.push(testCase);
}

// Aliases
test.skip = function (name: string, fn: TestFunction): void {
  test(name, fn, { skip: true });
};

test.only = function (name: string, fn: TestFunction): void {
  test(name, fn, { only: true });
};

test.todo = function (name: string): void {
  test(name, () => {}, { skip: true });
};

/**
 * Parameterized tests
 */
test.each = function <T extends any[]>(
  cases: T[]
): (name: string, fn: (...args: T) => void | Promise<void>) => void {
  return (name: string, fn: (...args: T) => void | Promise<void>) => {
    for (const testCase of cases) {
      // Format the test name with values
      let formattedName = name;
      const values = Array.isArray(testCase) ? testCase : [testCase];
      let idx = 0;
      formattedName = formattedName.replace(/%[sdijfoO%]/g, (match) => {
        if (match === '%%') return '%';
        const value = values[idx++];
        return String(value);
      });

      test(formattedName, () => fn(...(testCase as T)));
    }
  };
};

/**
 * Define a test suite
 */
export function describe(name: string, fn: () => void): void {
  const registry = getGlobalRegistry();
  const block: DescribeBlock = {
    name,
    tests: [],
    beforeEach: [],
    afterEach: [],
    beforeAll: [],
    afterAll: [],
    children: [],
    parent: registry.currentDescribe,
  };

  registry.currentDescribe.children.push(block);
  const previousDescribe = registry.currentDescribe;
  registry.currentDescribe = block;

  fn();

  registry.currentDescribe = previousDescribe;
}

describe.skip = function (name: string, fn: () => void): void {
  // Mark all tests in this describe as skipped
  const originalTest = test;
  (globalThis as any).test = test.skip;
  describe(name, fn);
  (globalThis as any).test = originalTest;
};

describe.only = function (name: string, fn: () => void): void {
  // Mark all tests in this describe as only
  const originalTest = test;
  (globalThis as any).test = test.only;
  describe(name, fn);
  (globalThis as any).test = originalTest;
};

/**
 * Hook: Run before each test in the current describe block
 */
export function beforeEach(fn: TestFunction): void {
  const registry = getGlobalRegistry();
  registry.currentDescribe.beforeEach.push(fn);
}

/**
 * Hook: Run after each test in the current describe block
 */
export function afterEach(fn: TestFunction): void {
  const registry = getGlobalRegistry();
  registry.currentDescribe.afterEach.push(fn);
}

/**
 * Hook: Run once before all tests in the current describe block
 */
export function beforeAll(fn: TestFunction): void {
  const registry = getGlobalRegistry();
  registry.currentDescribe.beforeAll.push(fn);
}

/**
 * Hook: Run once after all tests in the current describe block
 */
export function afterAll(fn: TestFunction): void {
  const registry = getGlobalRegistry();
  registry.currentDescribe.afterAll.push(fn);
}

// Export it as an alias
export const it = test;
