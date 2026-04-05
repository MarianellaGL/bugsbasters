import type { AssertionResult } from './types';
import { loadNativeModule } from './native';
import { matchSnapshot } from './snapshot';
import { getCurrentTestName } from './test';

// Try to load native module, fall back to pure JS
const native = loadNativeModule();

class AssertionError extends Error {
  expected?: any;
  received?: any;

  constructor(message: string, expected?: any, received?: any) {
    super(message);
    this.name = 'AssertionError';
    this.expected = expected;
    this.received = received;
  }
}

function stringify(value: any): string {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'function') return value.toString();
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return a === b;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  if (Array.isArray(a) || Array.isArray(b)) return false;

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => deepEqual(a[key], b[key]));
}

export class Expectation<T> {
  private value: T;
  private isNot: boolean = false;

  constructor(value: T) {
    this.value = value;
  }

  get not(): Expectation<T> {
    const exp = new Expectation(this.value);
    exp.isNot = !this.isNot;
    return exp;
  }

  private assert(passed: boolean, message: string, expected?: any, received?: any): void {
    const shouldPass = this.isNot ? !passed : passed;
    if (!shouldPass) {
      const prefix = this.isNot ? 'Expected not ' : 'Expected ';
      throw new AssertionError(prefix + message, expected, received);
    }
  }

  /**
   * Strict equality (===)
   */
  toBe(expected: T): void {
    if (native) {
      const result = native.assertToBeJs(stringify(expected), stringify(this.value));
      const passed = this.isNot ? !result.passed : result.passed;
      if (!passed) {
        throw new AssertionError(
          result.message || `Expected ${stringify(this.value)} to be ${stringify(expected)}`,
          expected,
          this.value
        );
      }
      return;
    }

    this.assert(
      this.value === expected,
      `${stringify(this.value)} to be ${stringify(expected)}`,
      expected,
      this.value
    );
  }

  /**
   * Deep equality
   */
  toEqual(expected: any): void {
    if (native) {
      const result = native.assertToEqualJs(stringify(expected), stringify(this.value));
      const passed = this.isNot ? !result.passed : result.passed;
      if (!passed) {
        throw new AssertionError(
          result.message || `Expected ${stringify(this.value)} to equal ${stringify(expected)}`,
          expected,
          this.value
        );
      }
      return;
    }

    this.assert(
      deepEqual(this.value, expected),
      `${stringify(this.value)} to equal ${stringify(expected)}`,
      expected,
      this.value
    );
  }

  /**
   * Check if array/string contains value
   */
  toContain(expected: any): void {
    if (native) {
      const result = native.assertToContainJs(stringify(this.value), stringify(expected));
      const passed = this.isNot ? !result.passed : result.passed;
      if (!passed) {
        throw new AssertionError(
          result.message || `Expected ${stringify(this.value)} to contain ${stringify(expected)}`,
          expected,
          this.value
        );
      }
      return;
    }

    let contains = false;
    if (Array.isArray(this.value)) {
      contains = this.value.some((item) => deepEqual(item, expected));
    } else if (typeof this.value === 'string') {
      contains = this.value.includes(String(expected));
    }

    this.assert(
      contains,
      `${stringify(this.value)} to contain ${stringify(expected)}`,
      expected,
      this.value
    );
  }

  /**
   * Check if value is truthy
   */
  toBeTruthy(): void {
    this.assert(!!this.value, `${stringify(this.value)} to be truthy`, true, this.value);
  }

  /**
   * Check if value is falsy
   */
  toBeFalsy(): void {
    this.assert(!this.value, `${stringify(this.value)} to be falsy`, false, this.value);
  }

  /**
   * Check if value is null
   */
  toBeNull(): void {
    this.assert(this.value === null, `${stringify(this.value)} to be null`, null, this.value);
  }

  /**
   * Check if value is undefined
   */
  toBeUndefined(): void {
    this.assert(
      this.value === undefined,
      `${stringify(this.value)} to be undefined`,
      undefined,
      this.value
    );
  }

  /**
   * Check if value is defined (not undefined)
   */
  toBeDefined(): void {
    this.assert(
      this.value !== undefined,
      `${stringify(this.value)} to be defined`,
      'defined',
      this.value
    );
  }

  /**
   * Check if value is greater than expected
   */
  toBeGreaterThan(expected: number): void {
    this.assert(
      (this.value as any) > expected,
      `${this.value} to be greater than ${expected}`,
      expected,
      this.value
    );
  }

  /**
   * Check if value is greater than or equal to expected
   */
  toBeGreaterThanOrEqual(expected: number): void {
    this.assert(
      (this.value as any) >= expected,
      `${this.value} to be greater than or equal to ${expected}`,
      expected,
      this.value
    );
  }

  /**
   * Check if value is less than expected
   */
  toBeLessThan(expected: number): void {
    this.assert(
      (this.value as any) < expected,
      `${this.value} to be less than ${expected}`,
      expected,
      this.value
    );
  }

  /**
   * Check if value is less than or equal to expected
   */
  toBeLessThanOrEqual(expected: number): void {
    this.assert(
      (this.value as any) <= expected,
      `${this.value} to be less than or equal to ${expected}`,
      expected,
      this.value
    );
  }

  /**
   * Check array/string length
   */
  toHaveLength(expected: number): void {
    const actual = (this.value as any)?.length;
    this.assert(
      actual === expected,
      `${stringify(this.value)} to have length ${expected}, got ${actual}`,
      expected,
      actual
    );
  }

  /**
   * Check if object has property
   */
  toHaveProperty(key: string, value?: any): void {
    const obj = this.value as any;
    const hasKey = obj && key in obj;

    if (value !== undefined) {
      this.assert(
        hasKey && deepEqual(obj[key], value),
        `object to have property "${key}" with value ${stringify(value)}`,
        value,
        obj?.[key]
      );
    } else {
      this.assert(hasKey, `object to have property "${key}"`, key, Object.keys(obj || {}));
    }
  }

  /**
   * Check if function throws
   */
  toThrow(expected?: string | RegExp | Error): void {
    if (typeof this.value !== 'function') {
      throw new AssertionError('Expected a function for toThrow()');
    }

    let threw = false;
    let error: any;

    try {
      (this.value as Function)();
    } catch (e) {
      threw = true;
      error = e;
    }

    if (!threw) {
      this.assert(false, 'function to throw', expected, 'did not throw');
      return;
    }

    if (expected === undefined) {
      this.assert(threw, 'function to throw');
      return;
    }

    const errorMessage = error?.message || String(error);

    if (typeof expected === 'string') {
      this.assert(
        errorMessage.includes(expected),
        `function to throw error containing "${expected}"`,
        expected,
        errorMessage
      );
    } else if (expected instanceof RegExp) {
      this.assert(
        expected.test(errorMessage),
        `function to throw error matching ${expected}`,
        expected,
        errorMessage
      );
    } else if (expected instanceof Error) {
      this.assert(
        errorMessage === expected.message,
        `function to throw "${expected.message}"`,
        expected.message,
        errorMessage
      );
    }
  }

  /**
   * Check if promise resolves
   */
  async toResolve(): Promise<void> {
    if (!(this.value instanceof Promise)) {
      throw new AssertionError('Expected a Promise for toResolve()');
    }

    try {
      await this.value;
      this.assert(true, 'promise to resolve');
    } catch (e) {
      this.assert(false, 'promise to resolve', 'resolved', e);
    }
  }

  /**
   * Check if promise rejects
   */
  async toReject(expected?: string | RegExp | Error): Promise<void> {
    if (!(this.value instanceof Promise)) {
      throw new AssertionError('Expected a Promise for toReject()');
    }

    try {
      await this.value;
      this.assert(false, 'promise to reject', expected || 'rejection', 'resolved');
    } catch (e: any) {
      if (expected === undefined) {
        this.assert(true, 'promise to reject');
        return;
      }

      const errorMessage = e?.message || String(e);

      if (typeof expected === 'string') {
        this.assert(
          errorMessage.includes(expected),
          `promise to reject with error containing "${expected}"`,
          expected,
          errorMessage
        );
      } else if (expected instanceof RegExp) {
        this.assert(
          expected.test(errorMessage),
          `promise to reject with error matching ${expected}`,
          expected,
          errorMessage
        );
      }
    }
  }

  /**
   * Check if mock was called
   */
  toHaveBeenCalled(): void {
    const mock = this.value as any;
    if (!mock?.calls) {
      throw new AssertionError('Expected a mock function');
    }
    this.assert(mock.calls.length > 0, 'mock to have been called', 'called', 'not called');
  }

  /**
   * Check if mock was called n times
   */
  toHaveBeenCalledTimes(expected: number): void {
    const mock = this.value as any;
    if (!mock?.calls) {
      throw new AssertionError('Expected a mock function');
    }
    this.assert(
      mock.calls.length === expected,
      `mock to have been called ${expected} times`,
      expected,
      mock.calls.length
    );
  }

  /**
   * Check if mock was called with specific arguments
   */
  toHaveBeenCalledWith(...args: any[]): void {
    const mock = this.value as any;
    if (!mock?.calls) {
      throw new AssertionError('Expected a mock function');
    }

    const wasCalledWith = mock.calls.some((call: any[]) => deepEqual(call, args));

    this.assert(
      wasCalledWith,
      `mock to have been called with ${stringify(args)}`,
      args,
      mock.calls
    );
  }

  /**
   * Check if value matches a regex
   */
  toMatch(expected: RegExp | string): void {
    const str = String(this.value);
    const regex = typeof expected === 'string' ? new RegExp(expected) : expected;
    this.assert(regex.test(str), `${stringify(this.value)} to match ${expected}`, expected, str);
  }

  /**
   * Check object matches partial structure
   */
  toMatchObject(expected: Record<string, any>): void {
    const obj = this.value as any;
    const matches = Object.keys(expected).every((key) => deepEqual(obj?.[key], expected[key]));
    this.assert(
      matches,
      `object to match ${stringify(expected)}`,
      expected,
      obj
    );
  }

  /**
   * Match against a stored snapshot
   */
  toMatchSnapshot(): void {
    const testName = getCurrentTestName();
    if (!testName) {
      throw new AssertionError('toMatchSnapshot() must be called inside a test');
    }

    const result = matchSnapshot(testName, this.value);
    if (this.isNot) {
      if (result.pass) {
        throw new AssertionError('Expected not to match snapshot');
      }
    } else {
      if (!result.pass) {
        throw new AssertionError(result.message);
      }
    }
  }

  /**
   * Match against an inline snapshot
   */
  toMatchInlineSnapshot(inlineSnapshot?: string): void {
    if (inlineSnapshot === undefined) {
      throw new AssertionError('Inline snapshot not provided. Run with --update-snapshots to create it.');
    }

    const serialized = typeof this.value === 'string'
      ? this.value
      : JSON.stringify(this.value, null, 2);

    this.assert(
      serialized === inlineSnapshot,
      `value to match inline snapshot`,
      inlineSnapshot,
      serialized
    );
  }
}

/**
 * Create an expectation for a value
 */
export function expect<T>(value: T): Expectation<T> {
  return new Expectation(value);
}
