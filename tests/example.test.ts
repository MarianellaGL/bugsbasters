import { test, expect, describe, mock, spy } from '../packages/bugsbasters/src';

describe('Math operations', () => {
  test('adds numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('subtracts correctly', () => {
    expect(5 - 3).toBe(2);
  });

  test('multiplies numbers', () => {
    expect(3 * 4).toEqual(12);
  });
});

describe('Array assertions', () => {
  test('checks array contains value', () => {
    expect([1, 2, 3]).toContain(2);
  });

  test('checks array length', () => {
    expect([1, 2, 3]).toHaveLength(3);
  });

  test('deep equality for objects', () => {
    expect({ a: 1, b: { c: 2 } }).toEqual({ a: 1, b: { c: 2 } });
  });
});

describe('Truthiness', () => {
  test('truthy values', () => {
    expect(true).toBeTruthy();
    expect(1).toBeTruthy();
    expect('hello').toBeTruthy();
  });

  test('falsy values', () => {
    expect(false).toBeFalsy();
    expect(0).toBeFalsy();
    expect('').toBeFalsy();
  });
});

describe('Comparison', () => {
  test('greater than', () => {
    expect(10).toBeGreaterThan(5);
  });

  test('less than', () => {
    expect(5).toBeLessThan(10);
  });
});

describe('String matching', () => {
  test('contains substring', () => {
    expect('hello world').toContain('world');
  });

  test('matches regex', () => {
    expect('hello@example.com').toMatch(/\w+@\w+\.\w+/);
  });
});

describe('Exception handling', () => {
  test('function throws', () => {
    expect(() => {
      throw new Error('Something went wrong');
    }).toThrow('Something went wrong');
  });
});

// Parameterized tests
test.each([
  [1, 1, 2],
  [2, 3, 5],
  [10, 20, 30],
])('adds %d + %d = %d', (a, b, expected) => {
  expect(a + b).toBe(expected);
});

// Mocking tests
describe('Mocking', () => {
  test('mock function tracks calls', () => {
    const fn = mock();
    fn(1, 2);
    fn(3, 4);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith(1, 2);
  });

  test('mock returns value', () => {
    const fn = mock().returns(42);
    expect(fn()).toBe(42);
  });

  test('spy on object method', () => {
    const obj = {
      greet: (name: string) => `Hello, ${name}!`,
    };

    const greetSpy = spy(obj, 'greet').returns('Mocked!');

    expect(obj.greet('World')).toBe('Mocked!');
    expect(greetSpy).toHaveBeenCalledWith('World');

    greetSpy.restore();
    expect(obj.greet('World')).toBe('Hello, World!');
  });
});
