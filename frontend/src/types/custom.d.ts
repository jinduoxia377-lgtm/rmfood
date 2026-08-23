/**
 * 全局 TypeScript 类型扩展声明
 *
 * 解决浏览器 API 和第三方库的类型缺失问题
 */

// ── 性能 API 扩展 ──
interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceExtensions {
  memory?: PerformanceMemory;
  hadRecentInput?: boolean;
  value?: number;
}

declare global {
  interface Performance extends PerformanceExtensions {}
  interface Navigator {
    connection?: NetworkInformation;
    mozConnection?: NetworkInformation;
    webkitConnection?: NetworkInformation;
  }
  interface Error {
    userMessage?: string;
  }
}

// ── 网络信息 API ──
interface NetworkInformation {
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  rtt: number;
  downlink: number;
  downlinkMax: number;
  saveData: boolean;
  onchange?: EventListener;
}

// ── Three.js JSX 命名空间（补全缺失元素） ──
declare namespace JSX {
  interface IntrinsicElements {
    group: any;
    mesh: any;
    sphereGeometry: any;
    meshStandardMaterial: any;
    line: any;
    bufferGeometry: any;
    float32BufferAttribute: any;
    lineBasicMaterial: any;
    ambientLight: any;
    directionalLight: any;
    // 补充 Three.js 常用 JSX 元素
    torusGeometry: any;
    boxGeometry: any;
    coneGeometry: any;
    cylinderGeometry: any;
    tetrahedronGeometry: any;
    octahedronGeometry: any;
    icosahedronGeometry: any;
    dodecahedronGeometry: any;
    points: any;
    point: any;
    sprite: any;
    spriteMaterial: any;
    lineSegments: any;
    particleSystem: any;
    material: any;
    materials: any;
    primitives: any;
    primitive: any;
    triangleGeometry: any;
    ringGeometry: any;
    planeGeometry: any;
    wireframeGeometry: any;
    hexagonalPyramidGeometry: any;
    latheGeometry: any;
    orbit: any;
    shapeGeometry: any;
    sphere: any;
    cone: any;
    cylinder: any;
    torus: any;
    torusKnot: any;
    tube: any;
    instancedMesh: any;
    skinMesh: any;
    skeleton: any;
    skinnedMesh: any;
    fog: any;
    fogExp2: any;
    spotLight: any;
    rectAreaLight: any;
    hemisphereLight: any;
    perspectiveCamera: any;
    orthographicCamera: any;
    cubeCamera: any;
    group: any;
    scene: any;
    skeletonHelper: any;
    sprite: any;
  }
}

// ── 缺失的第三方模块 ──
declare module 'react-sankey' {
  import React from 'react';
  interface SankeyProps {
    data: { nodes: any[]; links: any[] };
    nodePadding?: number;
    nodeWidth?: number;
    height?: number;
    nodeColor?: (node: any) => string;
    margin?: { top: number; right: number; bottom: number; left: number };
  }
  export const Sankey: React.FC<SankeyProps>;
}

declare module '@react-three/fiber' {
  import * as React from 'react';
  export const Canvas: React.FC<any>;
  export function useFrame(callback: (state: any, delta: number) => void): void;
}

declare module '@react-three/drei' {
  import * as React from 'react';
  export const OrbitControls: React.FC<any>;
  export const Text: React.FC<any>;
  export const Html: React.FC<any>;
}

declare module 'three' {
  export class Group {}
  export class BufferAttribute {}
  export class Float32BufferAttribute extends BufferAttribute {}
  export class Matrix4 {}
}
