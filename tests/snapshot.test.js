import { test, expect, describe } from '../packages/bugsbasters/dist/index.mjs';

describe('Snapshot Testing', () => {
  test('matches object snapshot', () => {
    const user = {
      name: 'John Doe',
      age: 30,
      email: 'john@example.com'
    };
    expect(user).toMatchSnapshot();
  });

  test('matches array snapshot', () => {
    const items = ['apple', 'banana', 'cherry'];
    expect(items).toMatchSnapshot();
  });

  test('matches string snapshot', () => {
    const greeting = 'Hello, World!';
    expect(greeting).toMatchSnapshot();
  });

  test('matches complex nested object', () => {
    const data = {
      users: [
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' }
      ],
      meta: {
        total: 2,
        page: 1
      }
    };
    expect(data).toMatchSnapshot();
  });
});
