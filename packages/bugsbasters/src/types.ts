export interface TestContext {
  name: string;
  filePath: string;
  skip: boolean;
  only: boolean;
  timeout: number;
}

export type TestFunction = () => void | Promise<void>;

export interface TestOptions {
  timeout?: number;
  skip?: boolean;
  only?: boolean;
}

export interface TestCase {
  name: string;
  fn: TestFunction;
  options: TestOptions;
  filePath: string;
}

export interface DescribeBlock {
  name: string;
  tests: TestCase[];
  beforeEach: TestFunction[];
  afterEach: TestFunction[];
  beforeAll: TestFunction[];
  afterAll: TestFunction[];
  children: DescribeBlock[];
  parent?: DescribeBlock;
}

export interface TestResult {
  name: string;
  filePath: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  error?: TestError;
}

export interface TestError {
  message: string;
  expected?: string;
  received?: string;
  diff?: string;
  stack?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  results: TestResult[];
}

export interface AssertionResult {
  passed: boolean;
  message?: string;
  expected?: string;
  received?: string;
}

export interface MockFunction<T extends (...args: any[]) => any = (...args: any[]) => any> {
  (...args: Parameters<T>): ReturnType<T>;
  calls: Parameters<T>[];
  results: { type: 'return' | 'throw'; value: any }[];
  returns(value: ReturnType<T>): MockFunction<T>;
  resolves(value: Awaited<ReturnType<T>>): MockFunction<T>;
  rejects(error: any): MockFunction<T>;
  throws(error: any): MockFunction<T>;
  implementation(fn: T): MockFunction<T>;
  reset(): void;
  mockClear(): void;
}

export interface SpyFunction<T extends (...args: any[]) => any = (...args: any[]) => any>
  extends MockFunction<T> {
  restore(): void;
}
