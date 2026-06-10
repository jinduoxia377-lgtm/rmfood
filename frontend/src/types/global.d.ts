/**
 * 全局类型声明
 * 用于增强类型安全，减少 any 类型使用
 */

// ===== Web Speech API 类型声明 (Phase 2 新增) =====
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly confidence: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: SpeechRecognitionErrorCode;
  readonly message: string;
}

type SpeechRecognitionErrorCode =
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'bad-grammar'
  | 'language-not-supported';

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;

  start(): void;
  stop(): void;
  abort(): void;

  onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognition;
  prototype: SpeechRecognition;
}

// 声明全局 Web Speech API 接口
declare var SpeechRecognition: SpeechRecognitionConstructor;
declare let webkitSpeechRecognition: SpeechRecognitionConstructor;

// 通用类型别名
export type Maybe<T> = T | null | undefined;
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// 通用函数类型
export type AnyFunction = (...args: any[]) => any;
export type AsyncFunction<T = any> = (...args: any[]) => Promise<T>;

// 基础数据类型
export type Primitive = string | number | boolean | null | undefined;

// 通用对象类型
export type PlainObject<T = unknown> = Record<string, T>;
export type EmptyObject = Record<string, never>;

// 数组类型工具
export type NonEmptyArray<T> = [T, ...T[]];
export type MaybeArray<T> = T | T[];

// 类型安全的 JSON
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;

export interface JSONObject {
  [key: string]: JSONValue;
}

export type JSONArray = JSONValue[];

// 类型安全的未知类型包装
export type UnknownObject = Record<string, unknown>;
export type UnknownArray = unknown[];

// 常用的回调类型
export type Callback<T = void> = (err: Error | null, result?: T) => void;
export type Predicate<T> = (value: T) => boolean;
export type Mapper<T, U> = (value: T) => U;

// React 相关
import { ReactNode } from 'react';
export type PropsWithChildren<P = unknown> = P & { children?: ReactNode };
export type ComponentProps<T extends keyof JSX.IntrinsicElements> =
  JSX.IntrinsicElements[T];

// 安全的 any 类型替代方案
export type SafeAny = unknown;
export type LooseAny = any;

// 类型守卫辅助
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
