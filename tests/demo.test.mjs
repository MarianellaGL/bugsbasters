import { test, expect, describe, mock } from '../packages/bugsbasters/dist/index.mjs';

describe('Demo: Passing Tests', () => {
  test('basic arithmetic works', () => {
    expect(2 + 2).toBe(4);
  });

  test('string operations', () => {
    expect('hello world').toContain('world');
  });

  test('array operations', () => {
    expect([1, 2, 3]).toHaveLength(3);
    expect([1, 2, 3]).toContain(2);
  });

  test('object comparison', () => {
    expect({ name: 'John', age: 30 }).toEqual({ name: 'John', age: 30 });
  });
});

describe('Demo: Failing Tests', () => {
  test('intentional failure - wrong value', () => {
    expect(1 + 1).toBe(3);
  });

  test('intentional failure - object mismatch', () => {
    expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 999 });
  });
});

describe('Demo: Async Tests', () => {
  test('async operation succeeds', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});

describe('Demo: Mocking', () => {
  test('mock function usage', () => {
    const fn = mock().returns('mocked value');

    expect(fn()).toBe('mocked value');
    expect(fn).toHaveBeenCalled();
  });
});

test.skip('skipped test example', () => {
  expect(true).toBe(false);
});
