// TypeScript 声明文件 - 用于解决测试文件的模块导入问题

declare module '@jest/globals' {
  export const describe: typeof globalThis.describe
  export const test: typeof globalThis.test
  export const it: typeof globalThis.it
  export const expect: typeof globalThis.expect
  export const beforeEach: typeof globalThis.beforeEach
  export const afterEach: typeof globalThis.afterEach
  export const beforeAll: typeof globalThis.beforeAll
  export const afterAll: typeof globalThis.afterAll
  export const jest: typeof globalThis.jest
}

declare module '@testing-library/react' {
  export * from '@testing-library/react'
}

declare module '@testing-library/user-event' {
  export * from '@testing-library/user-event'
}

declare module '@playwright/test' {
  export * from '@playwright/test'
}

// 全局变量声明
declare const global: {
  [key: string]: any
}

// 扩展 Window 接口
interface Window {
  [key: string]: any
}
