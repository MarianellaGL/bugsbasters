import type { MockFunction, SpyFunction } from './types';

// Track all mocks for cleanup
const activeMocks: Set<MockFunction<any>> = new Set();
const activeSpies: Set<SpyFunction<any>> = new Set();

/**
 * Create a mock function
 */
export function mock<T extends (...args: any[]) => any = (...args: any[]) => any>(
  implementation?: T
): MockFunction<T> {
  let returnValue: any;
  let resolveValue: any;
  let rejectValue: any;
  let throwValue: any;
  let impl: T | undefined = implementation;
  let mode: 'return' | 'resolve' | 'reject' | 'throw' | 'impl' | undefined;

  const fn = function (...args: Parameters<T>): ReturnType<T> {
    fn.calls.push(args);

    try {
      let result: any;

      if (mode === 'throw') {
        throw throwValue;
      } else if (mode === 'return') {
        result = returnValue;
      } else if (mode === 'resolve') {
        result = Promise.resolve(resolveValue);
      } else if (mode === 'reject') {
        result = Promise.reject(rejectValue);
      } else if (impl) {
        result = impl(...args);
      } else {
        result = undefined;
      }

      fn.results.push({ type: 'return', value: result });
      return result;
    } catch (e) {
      fn.results.push({ type: 'throw', value: e });
      throw e;
    }
  } as MockFunction<T>;

  fn.calls = [] as Parameters<T>[];
  fn.results = [] as { type: 'return' | 'throw'; value: any }[];

  fn.returns = function (value: ReturnType<T>): MockFunction<T> {
    mode = 'return';
    returnValue = value;
    return fn;
  };

  fn.resolves = function (value: Awaited<ReturnType<T>>): MockFunction<T> {
    mode = 'resolve';
    resolveValue = value;
    return fn;
  };

  fn.rejects = function (error: any): MockFunction<T> {
    mode = 'reject';
    rejectValue = error;
    return fn;
  };

  fn.throws = function (error: any): MockFunction<T> {
    mode = 'throw';
    throwValue = error;
    return fn;
  };

  fn.implementation = function (newImpl: T): MockFunction<T> {
    mode = 'impl';
    impl = newImpl;
    return fn;
  };

  fn.reset = function (): void {
    fn.calls = [];
    fn.results = [];
    returnValue = undefined;
    resolveValue = undefined;
    rejectValue = undefined;
    throwValue = undefined;
    impl = implementation;
    mode = undefined;
  };

  fn.mockClear = function (): void {
    fn.calls = [];
    fn.results = [];
  };

  activeMocks.add(fn);
  return fn;
}

/**
 * Spy on an existing method
 */
export function spy<T extends Record<string, any>, K extends keyof T>(
  object: T,
  method: K
): SpyFunction<T[K]> {
  const original = object[method];

  if (typeof original !== 'function') {
    throw new Error(`Cannot spy on ${String(method)}: it is not a function`);
  }

  const mockFn = mock(original as any) as unknown as SpyFunction<T[K]>;

  mockFn.restore = function (): void {
    object[method] = original;
    activeSpies.delete(mockFn);
  };

  object[method] = mockFn as T[K];
  activeSpies.add(mockFn);

  return mockFn;
}

/**
 * Mock a module (simplified version)
 * Note: Full module mocking requires bundler integration
 */
export function mockModule(modulePath: string, factory: () => Record<string, any>): void {
  const mocked = factory();

  // This is a simplified implementation
  // Full implementation would require integration with the module system
  if (typeof require !== 'undefined' && require.cache) {
    const resolved = require.resolve(modulePath);
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: mocked,
      parent: null,
      children: [],
      paths: [],
      path: '',
      require: require,
    } as any;
  }
}

/**
 * Clear all mock calls (but keep implementations)
 */
export function clearAllMocks(): void {
  for (const mock of activeMocks) {
    mock.mockClear();
  }
}

/**
 * Reset all mocks to initial state
 */
export function resetAllMocks(): void {
  for (const mock of activeMocks) {
    mock.reset();
  }
}

/**
 * Restore all spies to original implementations
 */
export function restoreAllMocks(): void {
  for (const spy of activeSpies) {
    spy.restore();
  }
  activeSpies.clear();
}

/**
 * Clean up all mocks and spies (called after each test)
 */
export function cleanupMocks(): void {
  restoreAllMocks();
  resetAllMocks();
  activeMocks.clear();
}
