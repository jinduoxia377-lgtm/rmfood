import { renderHook, RenderHookOptions, RenderHookResult, act as reactAct } from '@testing-library/react';
import { waitFor, waitForOptions } from '@testing-library/react';

interface AsyncRenderHookResult<T> extends RenderHookResult<T, unknown> {
  waitForValue: <K extends keyof T>(
    key: K,
    expectedValue: T[K],
    options?: waitForOptions
  ) => Promise<void>;
  waitForCondition: (
    condition: (result: T) => boolean,
    options?: waitForOptions
  ) => Promise<void>;
}

export async function asyncRenderHook<T>(
  hook: () => T,
  options?: RenderHookOptions<unknown>
): Promise<AsyncRenderHookResult<T>> {
  const result = renderHook(hook, options);

  const waitForValue = async <K extends keyof T>(
    key: K,
    expectedValue: T[K],
    waitForOpts?: waitForOptions
  ): Promise<void> => {
    await waitFor(
      () => {
        expect(result.result.current[key]).toEqual(expectedValue);
      },
      { timeout: 5000, ...waitForOpts }
    );
  };

  const waitForCondition = async (
    condition: (currentResult: T) => boolean,
    waitForOpts?: waitForOptions
  ): Promise<void> => {
    await waitFor(
      () => {
        expect(condition(result.result.current)).toBe(true);
      },
      { timeout: 5000, ...waitForOpts }
    );
  };

  return {
    ...result,
    waitForValue,
    waitForCondition,
  };
}

export function act(callback: () => void | Promise<void>): Promise<void> {
  return reactAct(callback);
}

export async function actAsync<T>(callback: () => Promise<T>): Promise<T> {
  let result: T;
  await reactAct(async () => {
    result = await callback();
  });
  return result!;
}

export function createHookTestUtils<T>(hookResult: RenderHookResult<T, unknown>) {
  const getCurrent = (): T => hookResult.current;

  const rerender = (options?: RenderHookOptions<unknown>) => {
    if (options) {
      hookResult.rerender();
    } else {
      hookResult.rerender();
    }
  };

  const unmount = () => {
    hookResult.unmount();
  };

  const waitForValue = async <K extends keyof T>(
    key: K,
    value: T[K],
    opts?: waitForOptions
  ): Promise<void> => {
    await waitFor(() => {
      expect(hookResult.current[key]).toEqual(value);
    }, { timeout: 5000, ...opts });
  };

  const waitForChange = async <K extends keyof T>(
    key: K,
    matcher?: (value: T[K]) => boolean,
    opts?: waitForOptions
  ): Promise<T[K]> => {
    const initialValue = hookResult.current[key];
    
    await waitFor(() => {
      const currentValue = hookResult.current[key];
      const hasChanged = currentValue !== initialValue;
      const matchesMatcher = matcher ? matcher(currentValue) : true;
      
      if (!hasChanged || !matchesMatcher) {
        throw new Error(`Value for ${String(key)} has not changed yet`);
      }
    }, { timeout: 5000, ...opts });

    return hookResult.current[key];
  };

  const updateAndWait = async <K extends keyof T>(
    updater: () => void | Promise<void>,
    key: K,
    expectedValue?: T[K]
  ): Promise<T[K]> => {
    await act(updater);
    
    if (expectedValue !== undefined) {
      await waitForValue(key, expectedValue);
    }
    
    return hookResult.current[key];
  };

  return {
    getCurrent,
    rerender,
    unmount,
    waitForValue,
    waitForChange,
    updateAndWait,
    result: hookResult.result,
  };
}

export class HookTestRunner<T> {
  private result: RenderHookResult<T, unknown>;

  constructor(hookResult: RenderHookResult<T, unknown>) {
    this.result = hookResult;
  }

  get current(): T {
    return this.result.current;
  }

  get resultRef() {
    return this.result.result;
  }

  async act(action: () => void | Promise<void>): Promise<this> {
    await reactAct(action);
    return this;
  }

  async waitFor<K extends keyof T>(
    key: K,
    predicate: (value: T[K]) => boolean = () => true,
    options?: waitForOptions
  ): Promise<this> {
    await waitFor(
      () => {
        const value = this.result.current[key];
        if (!predicate(value)) {
          throw new Error(`Predicate not satisfied for key: ${String(key)}`);
        }
      },
      { timeout: 5000, ...options }
    );
    return this;
  }

  async waitForValue<K extends keyof T>(
    key: K,
    expectedValue: T[K],
    options?: waitForOptions
  ): Promise<this> {
    await waitFor(
      () => {
        expect(this.result.current[key]).toEqual(expectedValue);
      },
      { timeout: 5000, ...options }
    );
    return this;
  }

  assertCurrent<K extends keyof T>(key: K, expectedValue: T[K]): this {
    expect(this.result.current[key]).toEqual(expectedValue);
    return this;
  }

  assertTruthy<K extends keyof T>(key: K): this {
    expect(this.result.current[key]).toBeTruthy();
    return this;
  }

  assertFalsy<K extends keyof T>(key: K): this {
    expect(this.result.current[key]).toBeFalsy();
    return this;
  }

  assertType<K extends keyof T>(key: K, type: string): this {
    expect(typeof this.result.current[key]).toBe(type);
    return this;
  }

  unmount(): void {
    this.result.unmount();
  }

  rerender(): void {
    this.result.rerender();
  }

  static async create<T>(
    hook: () => T,
    options?: RenderHookOptions<unknown>
  ): Promise<HookTestRunner<T>> {
    const result = renderHook(hook, options);
    return new HookTestRunner(result);
  }
}
