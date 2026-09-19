import { expect } from 'vitest';

expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
    };
  },

  toHaveValidStructure(received: Record<string, unknown>, requiredKeys: string[]) {
    const missingKeys = requiredKeys.filter(key => !(key in received));
    const pass = missingKeys.length === 0;
    return {
      pass,
      message: () =>
        pass
          ? `expected object not to have valid structure`
          : `expected object to have keys [${requiredKeys.join(', ')}] but missing [${missingKeys.join(', ')}]`,
    };
  },

  toBeValidJWT(received: string) {
    const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    const pass = jwtPattern.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid JWT`
          : `expected ${received} to be a valid JWT`,
    };
  },

  toBeISODateString(received: string) {
    const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;
    const pass = isoPattern.test(received) && !isNaN(Date.parse(received));
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid ISO date string`
          : `expected ${received} to be a valid ISO date string`,
    };
  },

  toBeUUID(received: string) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidPattern.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    };
  },

  toHaveApiResponseStructure(received: unknown) {
    const obj = received as Record<string, unknown>;
    const hasDataOrError = 'data' in obj || 'error' in obj;
    const hasStatusCode = 'statusCode' in obj && typeof obj.statusCode === 'number';
    const pass = hasDataOrError && hasStatusCode;
    return {
      pass,
      message: () =>
        pass
          ? `expected response not to have API response structure`
          : `expected response to have API response structure (data/error + statusCode)`,
    };
  },

  toBeSuccessfulResponse(received: { statusCode?: number }) {
    const pass = received.statusCode !== undefined && received.statusCode >= 200 && received.statusCode < 300;
    return {
      pass,
      message: () =>
        pass
          ? `expected status code ${received.statusCode} not to be successful (2xx)`
          : `expected status code to be successful (2xx), got ${received.statusCode}`,
    };
  },

  toBeErrorResponse(received: { statusCode?: number }) {
    const pass = received.statusCode !== undefined && received.statusCode >= 400;
    return {
      pass,
      message: () =>
        pass
          ? `expected status code ${received.statusCode} not to be an error (4xx/5xx)`
          : `expected status code to be an error (4xx/5xx), got ${received.statusCode}`,
    };
  },
});

declare module 'vitest' {
  interface Assertion<T = any> {
    toBeWithinRange(floor: number, ceiling: number): T;
    toHaveValidStructure(requiredKeys: string[]): T;
    toBeValidJWT(): T;
    toBeISODateString(): T;
    toBeUUID(): T;
    toHaveApiResponseStructure(): T;
    toBeSuccessfulResponse(): T;
    toBeErrorResponse(): T;
  }
}
