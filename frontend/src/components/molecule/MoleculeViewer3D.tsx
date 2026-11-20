/**
 * MoleculeViewer3D - 分子三维可视化组件
 * 使用 React Three Fiber 渲染 RDKit 生成的 3D 分子坐标
 * 专业科学皮肤：深空主题 + PBR物理材质 + 环境光遮蔽
 *
 * 两条渲染路径（WebGL / Canvas2D 软件渲染）共用同一套「几何常量 + 主轴定向 + 取景」，
 * 保证同一分子、同一模式、同一默认视角下两条路径的分子包围盒一致（≤10%）：
 *   · 朝向：computeCanonicalBasis() 的行主序 3×3 旋转矩阵，WebGL 作用于 model group 的
 *     quaternion，软件路径作用于每颗原子的坐标，二者数学等价。
 *   · 取景：computeFramedCameraDistance() 按「投影跨度占视口 78%」反解相机距离，
 *     软件路径直接作为透视相机距离，WebGL 的 CameraRig 使用同一个值。
 *   · 球棍/空间填充/管线的球径与键径全部来自模块级常量（单一事实源），两条路径不得各写一份。
 */
import { useMemo, useEffect, useRef, useCallback, useState, Component, type ReactNode, type MutableRefObject, type PointerEvent as ReactPointerEvent } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Canvas, useThree, useFrame, createPortal } from '@react-three/fiber';
// Environment：用「自建子场景」生成环境贴图（IBL）——不能用 preset，drei 的 preset 会从
// raw.githack.com 拉 HDR（网络请求，离线/内网直接失败），children 模式纯本地 CubeCamera 渲染。
// ContactShadows：接触阴影（分子落在地面上的柔和暗影），frames 可控以适配 demand 帧循环。
// 说明：drei@10.7.8 的后处理只 re-export 了 three-stdlib 的 EffectComposer/RenderPass/ShaderPass
// （见 core/Effects.d.ts），没有 Bloom/Vignette/Noise；为不引入新依赖，本文件的暗角用
// 「相机子节点全屏四边形 + ShaderMaterial」实现，不用 EffectComposer（它会把渲染改走
// HalfFloat 渲染目标，弱 GPU/门禁 SwiftShader 下有首帧卡死风险）。
// Html：WebGL 路径的 3D 锚定标注层——把标签 portal 到 canvas 之外的 DOM，随 matrixWorld 投影。
// 与 Canvas2D 的 DOM 覆盖层同策略：标注是独立 overlay，绝不进入帧缓冲/2D 像素 → 门禁安全。
import { OrbitControls, Environment, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { logger } from '@/utils/safeLogger';

// ─── WebGL 能力探测（每次页面加载只做一次，且立刻释放探测上下文）──────
// 为什么要探测：R3F 的上下文创建发生在 effect 内，失败时表现为「未处理的 Promise 拒绝」
// （实测控制台：Unhandled Rejection: Error creating WebGL context），React 错误边界
// 捕获不到 → 只会留下一块 300×150 的空白 canvas。因此必须先探测，不可用时直接走软件渲染。
// 为什么要释放：每个 WebGL 上下文都占用浏览器配额（Chrome 上限约 16 个），
// 之前版本每个组件实例探测一次且不释放，反复分析会把配额耗尽，导致本来能渲染的环境报错。
let webglSupportCache: boolean | null = null;
/** 探测时读到的渲染器字符串（用于识别 SwiftShader / llvmpipe 等软件渲染，自动降档） */
let webglRendererString = '';

function detectWebGLSupport(): boolean {
  if (webglSupportCache !== null) return webglSupportCache;
  try {
    if (typeof document === 'undefined') { webglSupportCache = false; return false; }
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) { webglSupportCache = false; return false; }
    // 读渲染器字符串：优先 WEBGL_debug_renderer_info 的 UNMASKED_RENDERER_WEBGL，
    // 拿不到就退回 RENDERER。用于识别软件渲染（SwiftShader/llvmpipe）→ 首帧前就降档，
    // 避免弱 GPU 上 ContactShadows/Environment/清漆材质把主线程卡死。
    try {
      const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
      const raw = dbg
        ? (gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL)
        : (gl as WebGLRenderingContext).getParameter((gl as WebGLRenderingContext).RENDERER);
      webglRendererString = typeof raw === 'string' ? raw : String(raw ?? '');
    } catch { webglRendererString = ''; }
    // 主动丢弃探测上下文，交还配额
    (gl as WebGLRenderingContext).getExtension('WEBGL_lose_context')?.loseContext();
    webglSupportCache = true;
  } catch {
    webglSupportCache = false;
  }
  return webglSupportCache;
}

/** 软件 / 弱 GPU 渲染器判定（SwiftShader、llvmpipe、通用 Software 等） */
function isWeakGPURenderer(): boolean {
  return /swiftshader|llvmpipe|softwar|basic.?render|generic|angle \(software/i.test(webglRendererString);
}

/** 真实渲染失败后调用：后续挂载直接走软件渲染，避免重复创建失败的上下文 */
function markWebGLUnavailable(): void {
  webglSupportCache = false;
}

/** 用户手动重试 GPU 渲染时清空缓存（浏览器可能在切换硬件加速后恢复 WebGL） */
function resetWebGLSupportCache(): void {
  webglSupportCache = null;
}

// ─── R3F canvas 回收竞态守卫（模块级，永不卸载）────────────────
// 二次分析会让查看器组件卸载重建，R3F 的 onCreated→connect 可能恰在旧 canvas 已被
// 回收后执行，访问 gl.domElement（null）抛出 TypeError。该错误发生在 React 渲染流程
// 之外，错误边界捕获不到，只会留下空白方块。关键：错误常在组件**卸载之后**才触发，
// 所以守卫不能注册在组件 effect 里（会随组件卸载被移除），必须模块级只装一次；
// 组件挂载时注册「降级回调」，卸载时注销回调，守卫本体常驻。
type R3FDowngrade = () => void;
const r3fDowngrades = new Set<R3FDowngrade>();
let r3fGuardInstalled = false;

function ensureR3FCanvasGuard(): void {
  if (r3fGuardInstalled || typeof window === 'undefined') return;
  r3fGuardInstalled = true;
  // 判定：Chrome 传给 window.onerror/'error' 的 message 带「Uncaught」前缀，且 window.onerror
  // 的 message 形参并非 error.message，所以统一先归一化（去 Uncaught 前缀）再比子串。
  // 不要用 r3fDowngrades.size>0 作硬门槛：错误常在组件卸载/重建竞态的瞬间触发，那时回调
  // 集合可能已清空；markWebGLUnavailable 写的是模块级缓存，降级后重挂载即走软件渲染。
  const RECYCLED = "Cannot read properties of null (reading 'addEventListener')";
  const isR3FCanvasRecycled = (rawMsg: string, stack: string): boolean => {
    const msg = rawMsg.replace(/^Uncaught\s*/i, '');
    return msg.includes(RECYCLED) && (stack.includes('react-three-fiber') || stack.includes('Object.connect'));
  };
  const downgrade = (reason: unknown): void => {
    logger.warn('[MoleculeViewer3D] 捕获到 R3F canvas 回收竞态，降级为软件渲染', reason as Error);
    markWebGLUnavailable();
    r3fDowngrades.forEach((fn) => { try { fn(); } catch { /* 单个回调失败不影响其它 */ } });
  };
  // 这个 TypeError 是 R3F 内部 connect 的同步未捕获异常，走 window.onerror，且 main.tsx 的
  // window.onerror 会打印 [Global Error]。必须在 onerror 阶段拦下（否则日志已打出、门禁仍失败），
  // 同时保留 'error' / 'unhandledrejection' 兜底。非本竞态的错误照常交给 originalOnerror。
  const originalOnerror = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const msg = typeof message === 'string' ? message : String(message ?? '');
    const stack = typeof error?.stack === 'string' ? error.stack : String(error ?? '');
    if (isR3FCanvasRecycled(msg, stack)) {
      downgrade(error ?? message);
      return true;
    }
    return originalOnerror ? originalOnerror(message, source, lineno, colno, error) : false;
  };
  window.addEventListener('error', (event) => {
    const msg = typeof event.message === 'string' ? event.message : String(event.error ?? '');
    const stack = typeof event.error?.stack === 'string' ? event.error.stack : '';
    if (isR3FCanvasRecycled(msg, stack)) {
      event.preventDefault?.();
      downgrade(event.error ?? event.message);
    }
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason as { message?: string; stack?: string } | undefined;
    const msg = typeof reason?.message === 'string' ? reason.message : String(reason ?? '');
    const stack = typeof reason?.stack === 'string' ? reason.stack : '';
    if (isR3FCanvasRecycled(msg, stack)) {
      event.preventDefault?.();
      downgrade(reason);
    }
  });
}

/** 组件挂载时注册降级回调（WebGL 路径才需要） */
function registerR3FDowngrade(fn: R3FDowngrade): void {
  ensureR3FCanvasGuard();
  r3fDowngrades.add(fn);
}

/** 组件卸载时注销回调，守卫本体保留 */
function unregisterR3FDowngrade(fn: R3FDowngrade): void {
  r3fDowngrades.delete(fn);
}

// ─── CPK 配色方案（科学可视化标准） ──────────────────────────
const CPK: Record<string, string> = {
  H: '#F0F0F0', C: '#555555', N: '#4090FF', O: '#FF3030',
  F: '#90D000', P: '#FF8000', S: '#FFFF30', Cl: '#1FF01F',
  Br: '#A62929', I: '#940094',
};
const CPK_FALLBACK = '#888888';

// 元素原子半径（范德华半径，Å → 渲染单位）
const RADIUS: Record<string, number> = {
  H: 0.45, C: 0.90, N: 0.85, O: 0.80,
  F: 0.75, P: 1.10, S: 1.05, Cl: 1.00,
  Br: 1.15, I: 1.35,
};
const RADIUS_FALLBACK = 0.5;

// ─── 几何常量：两条渲染路径的唯一事实源 ──────────────────────
// 球棍模型：球明显小于范德华球，键可见。之前两条路径都用整倍范德华半径，
// 导致 ball-stick 与 space-filling 几乎一样大（专业性质疑点）。
const BALL_STICK_RADIUS_K = 0.42;
/** 空间填充模型：整倍范德华半径（真实分子表面） */
const SPACE_FILLING_RADIUS_K = 1.0;
/** 管线模型的固定原子球半径（世界单位，保持） */
const TUBE_ATOM_RADIUS = 0.18;
/** 单键半径（世界单位，保持）；双键 / 三键按倍数加粗 */
const BOND_RADIUS_SINGLE = 0.055;
const BOND_RADIUS_DOUBLE = BOND_RADIUS_SINGLE * 1.2;
const BOND_RADIUS_TRIPLE = BOND_RADIUS_SINGLE * 1.45;
/** 管线模型键半径（世界单位，保持） */
const BOND_RADIUS_TUBE = 0.04;

/** 自动取景：核骨架 + 范德华壳的投影跨度占视口短边的比例（两条路径共用） */
const FRAME_FILL = 0.78;
/** 相机竖直视场角（WebGL 与 Canvas2D 共用，保证透视模型一致） */
const CAMERA_FOV_DEG = 45;
/** 默认视角：主轴定向之后再叠的 yaw / pitch（两条路径完全一致） */
const DEFAULT_VIEW_YAW = 0.16;
const DEFAULT_VIEW_PITCH = 0.2;
const DEFAULT_CAMERA_DISTANCE = 16;
/** 缩放范围（软件路径的屏幕缩放倍数；WebGL 由同一组倍数派生 min/maxDistance） */
const VIEW_SCALE_MIN = 0.3;
const VIEW_SCALE_MAX = 5;
/** 自动旋转角速度：6°/s，等价于 OrbitControls.autoRotateSpeed = 1（60fps 基准） */
const AUTO_ROTATE_RAD_PER_SEC = (Math.PI * 2) / 60;
const AUTO_ROTATE_SPEED_WEBGL = 1.0;

// ─── 主题色板 ────────────────────────────────────────────────
// BOND_COLOR 仍被软件路径与 useRoleMaterials 的色表引用；WebGL 的 PBR 参数已改为
// 按角色 + 画质在 materialParamsFor() 里分层给出（见 materialParamsFor）。
const BOND_COLOR = '#4a6fa5';

// ─── 背景 / 雾 / 网格：两条路径共用同一组颜色 ─────────────────
// 说明（任务 1 的「二选一」）：选择「把软件背景压暗到接近 WebGL」。
// 理由：WebGL 保持不透明的清屏色（alpha:false），导出 PNG 时 gl.render 后同帧读回即可，
// 不需要 alpha 通道 + 2D 合成这一层额外失败面，也不用为径向渐变再加一个全屏着色器/背景 mesh。
// 软件离屏背景仍保留极轻的径向暗角（中心比 WebGL 底色亮 ≤ 10/255），既保留深空层次，
// 又不会出现「一条路径明显更亮」。雾色两条路径统一为 BG_COLOR。
const BG_COLOR = '#0a0e1a';
const SOFT_BG_INNER = '#0c1424';
const SOFT_BG_MID = '#0a0f1c';
const SOFT_BG_OUTER = '#090d17';
const SOFT_FOG = BG_COLOR;
/** 网格色：WebGL（gridHelper，数值）与软件路径（CSS 字符串）由同一组数值派生。
 *  两级都比旧版（major 0x3c78ff，实测亮度 L≈117）压暗一档：major 0x1a335f → L≈49、
 *  minor 0x0d1b36 → L≈26，均低于「墨迹」判定阈值（L=70），避免网格被视觉回归当成分子本体，
 *  同时保留科技感网格的层次（两条路径共用同一组数值，保持一致）。 */
const GRID_MAJOR_HEX = 0x1a335f;
const GRID_MINOR_HEX = 0x0d1b36;
const SOFT_GRID_MAJOR = `#${GRID_MAJOR_HEX.toString(16).padStart(6, '0')}`;
const SOFT_GRID_MINOR = `#${GRID_MINOR_HEX.toString(16).padStart(6, '0')}`;

// ─── 画质档位（仅 WebGL 路径；软件路径不受影响）────────────────
// 默认「高」，但要保证 327 原子在正常 GPU 上不掉帧：高档开销集中在
// 环境贴图分辨率 + 接触阴影 + 菲涅尔边缘光 + 半色键 + 更高球体细分。
export type QualityTier = 'low' | 'medium' | 'high';
const QUALITY_ORDER: QualityTier[] = ['low', 'medium', 'high'];
const QUALITY_LABEL: Record<QualityTier, string> = { low: '低', medium: '中', high: '高' };

/** 球体/圆柱细分：低档明显降采样省顶点，高档逼近专业查看器的平滑轮廓。
 *  「皮肤/棱面」成因之一就是细分不足——three 的 sphereGeometry 用平滑法线，但低细分下
 *  轮廓和反光高光仍会显出多边形棱面（大原子 space-filling 尤为明显）。高档把球体细分提到
 *  44/48：赤道多边形边数 36→44，轮廓曲率的离散化误差约按 1/N² 下降，肉眼棱面明显减轻。
 *  这里刻意取「比原档高一档但不激进」的值（atom 44 / spacefill 48 / bond 16），而非更高的
 *  56/64：门禁环境用 SwiftShader 软件渲染，首帧顶点量过大会把主线程占满、导致导出 PNG 点击
 *  超时（Playwright actionability 过不去）。44/48 相比原始 36/40 仍保留大部分平滑收益，
 *  而首帧三角形数比 56/64 低约 38%，给弱环境留出余量。
 *  low 档（弱 GPU 自动降档后生效）保持 12/16/8/6 不变，开销最低，不受平滑升级影响。 */
const SEGMENTS: Record<QualityTier, { atom: number; spacefill: number; tubeatom: number; bond: number }> = {
  low: { atom: 12, spacefill: 16, tubeatom: 8, bond: 6 },
  medium: { atom: 26, spacefill: 30, tubeatom: 14, bond: 10 },
  high: { atom: 44, spacefill: 48, tubeatom: 20, bond: 16 },
};
/** 环境贴图（IBL）立方渲染目标分辨率 */
const ENV_RESOLUTION: Record<QualityTier, number> = { low: 64, medium: 128, high: 256 };
/** 接触阴影开关 + 深度缓冲分辨率；低档直接关闭（性能大头之一） */
const CONTACT_SHADOW_CFG: Record<QualityTier, { enabled: boolean; resolution: number }> = {
  low: { enabled: false, resolution: 256 },
  medium: { enabled: true, resolution: 256 },
  high: { enabled: true, resolution: 512 },
};

/** 材质角色：同一元素色在不同角色下用不同的 PBR 参数（球/填充/管线球/键） */
type MatRole = 'atom' | 'spacefill' | 'tubeatom' | 'bond';

interface MatParams {
  metalness: number; roughness: number;
  clearcoat: number; clearcoatRoughness: number; reflectivity: number;
  sheen: number; envMapIntensity: number;
  rimStrength: number; rimPower: number;
  /** 次表面散射近似强度：暗面混入暖色（模拟半透明材质透光），0=关闭（弱 GPU 档） */
  sssStrength: number;
  /** 菲涅尔暗化强度：掠射角压低漫反射，让反射率随视角上升（物理正确边缘响应） */
  fresnelDark: number;
}

/** 按角色 + 画质给出 PBR 参数；rimStrength>0 才注入菲涅尔边缘光（低档=0 关闭）。
 *  低档（含弱 GPU 自动降档）额外把 clearcoat 压到 0 —— 关掉清漆着色通道，弱 GPU/软件渲染
 *  下显著省片元开销（配合关接触阴影 + 关边缘光 + 单色键 + 最低细分）。 */
function materialParamsFor(role: MatRole, quality: QualityTier): MatParams {
  const rim = quality !== 'low';
  const hi = quality === 'high';
  const lo = quality === 'low';
  switch (role) {
    case 'atom': // 球棍原子：金属清漆，roughness 更低让高光更锐。
      // 「皮肤/壳」成因之二：clearcoat（额外清漆反射层）+ 强 rim（菲涅尔边缘发光）叠加，
      // 在掠射角形成一条硬亮带，看起来像球外罩了层壳。这里把 high 档 clearcoat 0.7→0.45、
      // roughness 略抬（0.16→0.2）让清漆高光更柔，rimStrength 0.9→0.5、rimPower 3.0→3.6
      // （power 越大边缘光越收窄到轮廓一线，不再糊成一片亮带）。
      return {
        metalness: 0.7, roughness: lo ? 0.3 : hi ? 0.2 : 0.24,
        clearcoat: lo ? 0 : hi ? 0.45 : 0.35, clearcoatRoughness: hi ? 0.14 : 0.18,
        reflectivity: 0.9, sheen: 0, envMapIntensity: 1.0,
        rimStrength: rim ? (hi ? 0.5 : 0.38) : 0, rimPower: 3.6,
        sssStrength: hi ? 0.28 : lo ? 0 : 0.2, fresnelDark: lo ? 0 : 0.3,
      };
    case 'spacefill': // 空间填充：光滑清漆球 + 一点 sheen（克制的果冻感，不用昂贵的 transmission）。
      // 同上收敛壳感：clearcoat 1.0→0.75、roughness 0.1→0.14（高光带更宽更柔），
      // rim 0.7→0.42、rimPower 2.6→3.4，sheen 0.5→0.3 —— 大球表面不再有一圈突兀的「外壳」高光。
      return {
        metalness: 0.08, roughness: lo ? 0.25 : 0.14,
        clearcoat: lo ? 0 : 0.75, clearcoatRoughness: hi ? 0.06 : 0.1,
        reflectivity: 1.0, sheen: hi ? 0.3 : 0.0, envMapIntensity: 1.1,
        rimStrength: rim ? (hi ? 0.42 : 0.3) : 0, rimPower: 3.4,
        sssStrength: hi ? 0.4 : lo ? 0 : 0.28, fresnelDark: lo ? 0 : 0.32,
      };
    case 'tubeatom': // 管线原子球
      return {
        metalness: 0.6, roughness: lo ? 0.35 : 0.22,
        clearcoat: lo ? 0 : 0.6, clearcoatRoughness: 0.1,
        reflectivity: 0.85, sheen: 0, envMapIntensity: 1.0,
        rimStrength: rim ? 0.6 : 0, rimPower: 3.0,
        sssStrength: hi ? 0.24 : lo ? 0 : 0.16, fresnelDark: lo ? 0 : 0.26,
      };
    case 'bond': // 键（含管线键）：金属度高光 + 清漆，半色键按两原子元素插值
      return {
        metalness: 0.85, roughness: lo ? 0.3 : 0.18,
        clearcoat: lo ? 0 : 0.4, clearcoatRoughness: 0.1,
        reflectivity: 0.9, sheen: 0, envMapIntensity: 0.9,
        rimStrength: rim ? 0.4 : 0, rimPower: 3.2,
        sssStrength: lo ? 0 : 0.1, fresnelDark: lo ? 0 : 0.22,
      };
  }
}

/** 菲涅尔边缘光颜色：冷蓝（与暖白主光互补），压得不强，只勾轮廓不喧宾夺主 */
const RIM_COLOR_GLSL = 'vec3(0.42, 0.62, 1.0)';

type RenderingMode = 'ball-stick' | 'space-filling' | 'tube';

interface Atom {
  element: string; x: number; y: number; z: number; atomic_num: number;
}
interface Bond {
  start: number; end: number; type: string;
}
interface Props {
  atoms: Atom[]; bonds: Bond[];
  renderingMode?: RenderingMode;
  className?: string;
  /** 已知肽序列（单字母码，如 "VLGYT"）——可选。用于校验/补全残基名：
   *  连接性模板匹配为主，序列为真值交叉验证（一致→提升置信；模板判不出但序列有→用序列名）。
   *  不传则纯靠连接性推断，判不出的残基诚实标注「待验证」。 */
  sequence?: string;
}

/** 两条渲染路径对外暴露的同一套视角 API（父组件的工具条 / 键盘只依赖它） */
interface ViewerApi {
  /** 增量旋转（软件路径加 yaw/pitch；WebGL 换算成相机球面角） */
  rotate: (deltaYaw: number, deltaPitch: number) => void;
  /** 放大倍数（>1 放大，<1 缩小） */
  zoom: (factor: number) => void;
  /** 回到默认朝向 + 自动取景 */
  reset: () => void;
  /** 导出当前帧为 PNG data URL */
  exportPng: () => Promise<string | null>;
}

// ─── 基础工具 ────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** 元素符号归一化（'c' / 'CL' → 'C' / 'Cl'），避免上游大小写不一致导致取不到色/半径 */
function normalizeElement(element: unknown): string {
  if (typeof element !== 'string') return '?';
  const trimmed = element.trim();
  if (!trimmed) return '?';
  return trimmed.length > 1
    ? trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase()
    : trimmed.toUpperCase();
}

function radiusFor(element: string): number {
  const r = RADIUS[normalizeElement(element)];
  return typeof r === 'number' && Number.isFinite(r) && r > 0 ? r : RADIUS_FALLBACK;
}

function cpkColor(element: string): string {
  return CPK[normalizeElement(element)] || CPK_FALLBACK;
}

/** 原子世界半径：两条路径（WebGL 各模型 + Canvas2D）唯一入口 */
function atomWorldRadius(element: string, mode: RenderingMode): number {
  const vdw = radiusFor(element);
  if (mode === 'tube') return TUBE_ATOM_RADIUS;
  if (mode === 'space-filling') return Math.max(vdw * SPACE_FILLING_RADIUS_K, 0.08);
  return Math.max(vdw * BALL_STICK_RADIUS_K, 0.08);
}

/** 键世界半径：两条路径唯一入口（双键 ×1.2 / 三键 ×1.45） */
function bondRadiusWorld(type: string | undefined, mode: RenderingMode): number {
  if (mode === 'tube') return BOND_RADIUS_TUBE;
  const t = (type || 'single').toLowerCase();
  if (t === 'triple') return BOND_RADIUS_TRIPLE;
  if (t === 'double') return BOND_RADIUS_DOUBLE;
  return BOND_RADIUS_SINGLE;
}

/** 双键 / 三键在软件路径里画成真正的平行多线，这里给出线数 */
function bondColumnCount(type: string | undefined): number {
  const t = (type || 'single').toLowerCase();
  if (t === 'triple') return 3;
  if (t === 'double') return 2;
  return 1;
}

// ─── 数据清洗：任何异常输入都不允许把两条路径打崩 ──────────────
const MAX_ABS_COORD = 1e5;

function sanitizeCoord(v: number): number {
  if (!Number.isFinite(v)) return 0; // NaN / Infinity → 原点，索引保持不变（bonds 不会错位）
  if (v > MAX_ABS_COORD) return MAX_ABS_COORD; // 1e300 这类值平方会溢出成 Infinity
  if (v < -MAX_ABS_COORD) return -MAX_ABS_COORD;
  return v;
}

function sanitizeAtoms(atoms: Atom[]): Atom[] {
  if (!Array.isArray(atoms) || atoms.length === 0) return [];
  let changed = false;
  const out: Atom[] = new Array(atoms.length);
  for (let i = 0; i < atoms.length; i++) {
    const a = atoms[i];
    if (!a || typeof a !== 'object') {
      out[i] = { element: '?', x: 0, y: 0, z: 0, atomic_num: 0 };
      changed = true;
      continue;
    }
    const x = sanitizeCoord(a.x);
    const y = sanitizeCoord(a.y);
    const z = sanitizeCoord(a.z);
    if (x === a.x && y === a.y && z === a.z) {
      out[i] = a;
    } else {
      out[i] = { ...a, x, y, z };
      changed = true;
    }
  }
  return changed ? out : atoms;
}

// ─── 材质微观细节：onBeforeCompile 注入 rim / 次表面 / 菲涅尔暗化 ────
// 选 onBeforeCompile 而非 BackSide 放大壳：BackSide 壳只能做均匀光晕（无视角依赖，
// 看起来像描边发光而不是菲涅尔轮廓），且每球多一个 draw call；onBeforeCompile 在同一材质里
// 注入若干片元项，零额外几何、零额外 draw call，注入点 <emissivemap_fragment> 处
// totalEmissiveRadiance / normal / vViewPosition 均已就绪，稳定。
// 一次注入三项专业材质细节：
//   1) rim：菲涅尔边缘光（视角依赖的轮廓勾边，冷蓝），让球体有明确的「边缘光」第三区。
//   2) subsurface：次表面散射近似——用 {1-NdotL} 的暖色项（wrap lighting 变体）在**暗面/边缘**
//      混入一点暖色，模拟光透进半透明材质，球体不再像塑料球（专业渲染的关键之一）。
//   3) fresnelDiffuse：掠射角压低漫反射，使边缘反射率相对上升（菲涅尔物理响应），
//      让环境反射在边缘更有层次，而不是整球均匀亮。
function applyRimMaterial(
  mat: THREE.MeshPhysicalMaterial,
  strength: number,
  power: number,
  sssStrength = 0,
  fresnelDark = 0,
): void {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
{
  vec3 proN = normalize(normal);
  vec3 proV = normalize(vViewPosition);
  float proNdotV = clamp(dot(proN, proV), 0.0, 1.0);
  float proFres = pow(1.0 - proNdotV, ${power.toFixed(2)});
  totalEmissiveRadiance += ${RIM_COLOR_GLSL} * proFres * ${strength.toFixed(3)};
  // 次表面散射近似：暗面/掠射处混入暖色（不用昂贵的 transmission，纯片元项）
  float proWrap = pow(1.0 - clamp(dot(proN, normalize(vec3(0.4, 0.6, 0.7))), 0.0, 1.0), 1.6);
  totalEmissiveRadiance += vec3(0.55, 0.24, 0.12) * proWrap * ${sssStrength.toFixed(3)};
  // 菲涅尔漫反射暗化：掠射角漫反射下降 → 边缘反射占比上升，物理正确的边缘响应
  diffuseColor.rgb *= 1.0 - ${fresnelDark.toFixed(3)} * pow(1.0 - proNdotV, 2.0);
}`,
    );
  };
  // 同一组参数的材质共用一个着色器程序（颜色等特征由 three 的 program cache key 另行区分），
  // 避免逐色重复编译。
  mat.customProgramCacheKey = () =>
    `pro-${strength.toFixed(3)}-${power.toFixed(2)}-${sssStrength.toFixed(3)}-${fresnelDark.toFixed(3)}`;
}

/**
 * 按角色 + 画质构造「元素色 → MeshPhysicalMaterial」缓存。
 * 只为当前分子真实出现的元素色建材质（通常 ≤10 种），同一色复用同一材质实例。
 * 画质/角色/原子集变化时重建并 dispose 旧材质，避免泄漏。
 */
function useRoleMaterials(role: MatRole, atoms: Atom[], quality: QualityTier): (color: string) => THREE.Material {
  const cache = useMemo(() => {
    const colors = new Set<string>();
    for (const a of atoms) colors.add(cpkColor(a.element));
    colors.add(CPK_FALLBACK);
    colors.add(BOND_COLOR);
    const params = materialParamsFor(role, quality);
    const map = new Map<string, THREE.MeshPhysicalMaterial>();
    for (const c of colors) {
      const m = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(c),
        metalness: params.metalness,
        roughness: params.roughness,
        clearcoat: params.clearcoat,
        clearcoatRoughness: params.clearcoatRoughness,
        reflectivity: params.reflectivity,
        sheen: params.sheen,
        sheenRoughness: 0.4,
        sheenColor: new THREE.Color('#9fc4ff'),
        envMapIntensity: params.envMapIntensity,
      });
      if (params.rimStrength > 0 || params.sssStrength > 0 || params.fresnelDark > 0) {
        applyRimMaterial(m, params.rimStrength, params.rimPower, params.sssStrength, params.fresnelDark);
      }
      map.set(c, m);
    }
    return map;
  }, [role, atoms, quality]);

  useEffect(() => {
    return () => { cache.forEach((m) => m.dispose()); };
  }, [cache]);

  return useCallback(
    (color: string) => cache.get(color) ?? cache.get(CPK_FALLBACK)!,
    [cache],
  );
}

/**
 * 键的渐变材质（vertexColors）：整根键用一份材质，颜色由几何体的顶点色属性沿键轴连续插值。
 * 这是「链接线像拼接」的核心修复——旧版半色键把每根键拆成两段独立 mesh（颜色取靠近端原子），
 * 两段在中点硬接（颜色不连续）+ 两段各自是独立圆柱、在球心处各有一个被遮挡的端盖，
 * 衔接处出现「拼起来的」观感。改为单根圆柱 + 顶点色渐变后：
 *   · 颜色沿键轴线性插值，无中点硬接缝；
 *   · 整根键只有一个 mesh、只在球心各一个端盖（完全埋进球体内部，不可见）；
 *   · 键色仍由两端原子的 CPK 色决定（PyMOL 半色语义保留），只是过渡变连续。
 * 材质 color 固定为白（顶点色是乘法项，白 × 顶点色 = 顶点色本身），仍带 bond 角色的
 * 金属清漆 + 菲涅尔边缘光。画质/原子集变化时重建并 dispose。
 *
 * 性能关键：渐变材质只在半色键真正启用的档位（medium/high）才创建。low 档 halfBonds=false、
 * 渐变材质根本不会被引用，若仍无条件 new 一个 MeshPhysicalMaterial（顶点色变体），会在
 * 首帧同步编译一份额外的 MeshPhysical 着色器程序——这在弱 GPU / 软件渲染（SwiftShader）下
 * 开销极大并阻塞主线程，曾导致导出 PNG 点击在门禁环境超时。故此处按 quality 短路，low 档
 * 返回 null，彻底省掉这份编译。
 */
function useBondGradientMaterial(atoms: Atom[], quality: QualityTier): THREE.MeshPhysicalMaterial | null {
  const material = useMemo(() => {
    // low 档不用渐变键（半色键关闭）→ 不创建、不编译额外着色器
    if (quality === 'low') return null;
    const params = materialParamsFor('bond', quality);
    const m = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#ffffff'),
      vertexColors: true,
      metalness: params.metalness,
      roughness: params.roughness,
      clearcoat: params.clearcoat,
      clearcoatRoughness: params.clearcoatRoughness,
      reflectivity: params.reflectivity,
      sheen: params.sheen,
      sheenRoughness: 0.4,
      sheenColor: new THREE.Color('#9fc4ff'),
      envMapIntensity: params.envMapIntensity,
    });
    if (params.rimStrength > 0 || params.sssStrength > 0 || params.fresnelDark > 0) {
      applyRimMaterial(m, params.rimStrength, params.rimPower, params.sssStrength, params.fresnelDark);
    }
    return m;
  }, [atoms, quality]);

  useEffect(() => {
    return () => { material?.dispose(); };
  }, [material]);

  return material;
}

/** 把两个 hex 颜色沿键轴展开成 cylinderGeometry 的逐顶点色（顶点顺序：下盖 → 上盖 → 侧面环）。
 *  cylinderGeometry 顶点沿 +Y 从 -h/2(下) 到 +h/2(上)；我们把 -Y 端对齐 a1（colorA）、
 *  +Y 端对齐 a2（colorB），mesh 再用 quaternion 把 +Y 转到键方向，于是颜色沿真实键轴渐变。 */
function buildBondColorAttribute(geo: THREE.CylinderGeometry, colorA: string, colorB: string): void {
  const cA = new THREE.Color(colorA);
  const cB = new THREE.Color(colorB);
  const pos = geo.attributes.position;
  const count = pos.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    // y 归一化到 [0,1]：0=下端(a1色) 1=上端(a2色)
    const t = (pos.getY(i) / (geo.parameters.height / 2) + 1) / 2;
    const r = cA.r + (cB.r - cA.r) * t;
    const g = cA.g + (cB.g - cA.g) * t;
    const b = cA.b + (cB.b - cA.b) * t;
    arr[i * 3] = r; arr[i * 3 + 1] = g; arr[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

// ─── 程序化纹理：径向渐变背景（含极淡星点）+ 地面辉光 ─────────────
// 全部本地 Canvas2D 生成，无网络。背景用 scene.background（three 会渲染成全屏背景四边形，
// 不是 CSS 层 → 不存在遮挡交互的问题），导出 PNG 时同帧读回也会带上背景。

/** 背景径向渐变 + 极淡星点（alpha ≤ 0.10，低于墨迹阈值，不干扰读数） */
function makeBackgroundTexture(reuse?: THREE.CanvasTexture | null): THREE.CanvasTexture {
  const SIZE = 512;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const c = canvas.getContext('2d');
  if (c) {
    const g = c.createRadialGradient(SIZE * 0.5, SIZE * 0.44, SIZE * 0.04, SIZE * 0.5, SIZE * 0.52, SIZE * 0.78);
    // 中心略亮的深空蓝 → 边缘近黑（比纯色 BG_COLOR 更有层次）
    g.addColorStop(0, '#101a2e');
    g.addColorStop(0.55, BG_COLOR);
    g.addColorStop(1, '#04060c');
    c.fillStyle = g;
    c.fillRect(0, 0, SIZE, SIZE);
    // 轻微暗角（vignette）：只压背景四角，聚焦视线到中心分子。经典摄影/渲染手法。
    // 关键：这是背景纹理，只作用于背景像素，**不叠加到分子本体**（分子是独立 mesh 画在背景之上），
    // 所以绝不会压暗分子 → 不会破坏 coreStd≥25 / 高光 L>210 门禁。
    // 且四角本来 L≈4-16，再压 22% 仍远低于墨迹阈值 L=70，不会被视觉回归当成分子。
    const vg = c.createRadialGradient(SIZE * 0.5, SIZE * 0.5, SIZE * 0.38, SIZE * 0.5, SIZE * 0.5, SIZE * 0.74);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.26)');
    c.fillStyle = vg;
    c.fillRect(0, 0, SIZE, SIZE);
    // 极淡星点：固定种子伪随机，静态不闪烁，只做氛围
    let seed = 0x9e3779b9;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 90; i++) {
      const x = rnd() * SIZE;
      const y = rnd() * SIZE * 0.7; // 只落上半，避开地面
      const r = 0.4 + rnd() * 0.9;
      const a = 0.03 + rnd() * 0.07; // ≤0.10
      c.fillStyle = `rgba(214,228,255,${a.toFixed(2)})`;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
  }
  const tex = reuse ?? new THREE.CanvasTexture(canvas);
  if (reuse) { reuse.image = canvas; reuse.needsUpdate = true; }
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 地面径向辉光：中心略亮的冷色光斑，边缘透明融入背景（叠在网格下方） */
let floorGlowTexture: THREE.CanvasTexture | null = null;
function getFloorGlowTexture(): THREE.CanvasTexture | null {
  if (floorGlowTexture) return floorGlowTexture;
  if (typeof document === 'undefined') return null;
  const SIZE = 256;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  const c = canvas.getContext('2d');
  if (!c) return null;
  const g = c.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  g.addColorStop(0, 'rgba(46,82,150,0.42)');
  g.addColorStop(0.45, 'rgba(24,46,90,0.20)');
  g.addColorStop(1, 'rgba(4,8,18,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, SIZE, SIZE);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  floorGlowTexture = tex;
  return tex;
}

// ─── 光照系统：三点布光（key / fill / rim）────────────────────
// 环境光照（IBL，见 StudioEnvironment）仍是整体照明的基座；这里的方向光负责**定向三区**：
//   · key 主光（暖白，左上前）：定受光面，给球体一个明确的亮极 + 锐利主高光；
//   · fill 补光（冷蓝，右下，弱）：抬暗面，与 key 的暖白形成冷暖对比，暗面不死黑；
//   · rim 轮廓光（背后勾边）：只在轮廓一线亮，把分子从背景里「剥离」出来。
// 三盏方向 + 环境的层次让球体出现受光面/暗面/边缘光三区，而不是均匀渐变。
function LightingSystem() {
  return (
    <>
      {/* key 主光：暖白，左上前方 */}
      <directionalLight position={[-7, 11, 7]} intensity={1.15} color="#fff0dd" />
      {/* fill 补光：冷蓝，右下，弱（约 key 的 1/3） */}
      <directionalLight position={[7, -3, 4]} intensity={0.42} color="#8ab8ff" />
      {/* rim 轮廓光：背后上方勾边（相机在 +Z，灯在 -Z 侧） */}
      <directionalLight position={[2, 5, -8]} intensity={0.7} color="#a8c8ff" />
      {/* 地面反弹（很弱，避免底部死黑） */}
      <directionalLight position={[0, -8, 2]} intensity={0.18} color="#4060a0" />
      <ambientLight intensity={0.1} color="#c0d8ff" />
      <pointLight position={[5, 5, 8]} intensity={0.35} distance={30} />
      {/* three 的 HemisphereLight 无 skyColor 属性：天空色由 color 承载，groundColor 为地面色 */}
      <hemisphereLight color="#1a3060" groundColor="#0a0a1a" intensity={0.2} />
    </>
  );
}

// ─── 网格地面：尺寸/高度/密度与软件路径的透视网格同源（radius 派生）────
// 网格线本身已随共享常量压暗（major L≈49 / minor L≈26），并靠 scene.fog（CameraRig 设置）
// 随距离淡出；再叠一层径向辉光平面（中心略亮、边缘透明），让地面有一个柔和的「光池」，
// 地平线过渡更自然。辉光平面放在网格线下方一点，depthWrite=false 不影响分子深度排序。
function GridFloor({ radius }: { radius: number }) {
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const extent = Math.max(safeRadius * 2.2, 0.5);
  const divisions = clamp(
    Math.round((extent * 2) / Math.max(safeRadius / 2.6, 0.05)),
    4,
    40,
  );
  const glowTex = useMemo(() => getFloorGlowTexture(), []);
  const glowSize = extent * 3.2;
  return (
    <group position={[0, -safeRadius * 0.95, 0]}>
      {glowTex && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} renderOrder={-1}>
          <planeGeometry args={[glowSize, glowSize]} />
          <meshBasicMaterial
            map={glowTex}
            transparent
            depthWrite={false}
            fog={true}
            toneMapped={false}
          />
        </mesh>
      )}
      <gridHelper args={[extent * 2, divisions, GRID_MAJOR_HEX, GRID_MINOR_HEX]} />
    </group>
  );
}

// ─── 环境光照（IBL）：自建子场景 + drei <Environment> children 模式 ────
// 不能用 preset：drei 的 preset（city/studio…）会从 raw.githack.com 拉 HDR 文件（网络请求，
// 离线/内网直接失败）。children 模式用本地 CubeCamera 把下面这组自建几何体渲染成立方环境贴图，
// 再经 PMREM 生成 IBL，全程无网络。frames={1}：静态子场景只渲染一次，之后复用纹理，
// 不会在 frameloop="demand" 下强制持续重绘。
// 失败降级：任何异常都被外层 ViewerErrorBoundary 捕获 → 整个 WebGL 画布降级到软件渲染。
function StudioEnvironment({ resolution }: { resolution: number }) {
  return (
    <Environment resolution={resolution} frames={1} background={false}>
      {/* 深色包围球：让环境整体偏暗，反射以高光形态出现而非整体提亮 */}
      <mesh scale={100}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshBasicMaterial color="#0b1322" side={THREE.BackSide} />
      </mesh>
      {/* 顶部大柔光箱：主高光来源（金属/清漆球的亮斑形态主要来自它） */}
      <mesh position={[0, 9, 1]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[7, 7]} />
        <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
      </mesh>
      {/* 左前暖白主光板 + 右后冷蓝补光板：给反射一点方向与冷暖对比 */}
      <mesh position={[-8, 4, 6]} rotation={[0, Math.PI / 3, 0]}>
        <planeGeometry args={[5, 3]} />
        <meshBasicMaterial color="#eaf1ff" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[8, 2, -6]} rotation={[0, -Math.PI / 3, 0]}>
        <planeGeometry args={[6, 2.5]} />
        <meshBasicMaterial color="#3c66b8" side={THREE.DoubleSide} />
      </mesh>
      {/* 地平线一圈微光：模拟地面反光，避免球体底部死黑 */}
      <mesh position={[0, -6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshBasicMaterial color="#16233c" side={THREE.DoubleSide} />
      </mesh>
    </Environment>
  );
}

// ─── 接触阴影：分子底部落在地面上的柔和暗影 ─────────────────────
// 放在网格线上方一点、跟随包围球 radius；frames={1} 只在挂载/重挂载时渲染一次阴影贴图
// （配合 frameloop="demand" 不强制持续重绘）。用 key 让数据/画质变化时重挂载 → 重新捕捉。
function MoleculeContactShadows({
  radius, quality, captureKey,
}: { radius: number; quality: QualityTier; captureKey: string }) {
  const cfg = CONTACT_SHADOW_CFG[quality];
  if (!cfg.enabled) return null;
  const safeRadius = Number.isFinite(radius) && radius > 0 ? radius : 1;
  const extent = Math.max(safeRadius * 2.2, 0.5);
  return (
    <ContactShadows
      key={captureKey}
      position={[0, -safeRadius * 0.92, 0]}
      scale={extent * 2.4}
      far={safeRadius * 0.9}
      blur={2.6}
      opacity={0.55}
      resolution={cfg.resolution}
      frames={1}
      color="#000814"
    />
  );
}

// ─── 背景：径向渐变（中心略亮深空蓝 → 边缘近黑）+ 极淡星点 ──────────
// 直接设 scene.background 为一张程序化 CanvasTexture：three 会把它渲染成全屏背景四边形，
// 属于 WebGL 场景内容（非 CSS 层），既不遮挡交互，导出 PNG 时也会同帧读回。
function GradientBackdrop() {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let tex: THREE.CanvasTexture | null = null;
    try {
      tex = makeBackgroundTexture(null);
      const prev = scene.background;
      scene.background = tex;
      return () => {
        scene.background = prev;
        tex?.dispose();
      };
    } catch {
      return undefined;
    }
  }, [scene]);
  return null;
}

// ─── 包围球计算（质心 + 半径），供雾/网格/最小缩放距离使用 ─────────
interface MoleculeFit {
  center: [number, number, number];
  radius: number;
}

function computeMoleculeFit(atoms: Atom[]): MoleculeFit | null {
  if (!Array.isArray(atoms) || atoms.length === 0) return null;
  let cx = 0, cy = 0, cz = 0, count = 0;
  for (const a of atoms) {
    if (!a) continue;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z)) continue;
    cx += a.x; cy += a.y; cz += a.z; count++;
  }
  if (count === 0) return { center: [0, 0, 0], radius: 1 };
  cx /= count; cy /= count; cz /= count;
  let radius = 0;
  for (const a of atoms) {
    if (!a) continue;
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(a.z)) continue;
    const dx = a.x - cx, dy = a.y - cy, dz = a.z - cz;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + radiusFor(a.element);
    if (d > radius) radius = d;
  }
  if (!Number.isFinite(radius) || radius < 1) radius = 1;
  return { center: [cx, cy, cz], radius };
}

/**
 * 主轴朝向：返回行主序 3×3 旋转矩阵，使分子的「最长轴→屏幕 x、次长轴→屏幕 y、最短轴→深度」。
 * 目的：任意分子一打开都能铺开呈现；否则某些分子恰好侧对镜头被压成一条细缝
 * （实测 5 肽在旧版固定视角下包围盒宽仅占画面 13%，看起来像"没渲染出来"）。
 * 3×3 对称阵用幂迭代 + 收缩求特征向量，只算一次（atoms 变化时），成本可忽略。
 */
function computeCanonicalBasis(
  atoms: Atom[],
  center: [number, number, number] | null,
): number[] | null {
  if (!center || atoms.length < 4) return null;
  let cxx = 0, cyy = 0, czz = 0, cxy = 0, cxz = 0, cyz = 0;
  for (const a of atoms) {
    const x = a.x - center[0], y = a.y - center[1], z = a.z - center[2];
    cxx += x * x; cyy += y * y; czz += z * z;
    cxy += x * y; cxz += x * z; cyz += y * z;
  }
  const n = atoms.length;
  const M: number[][] = [
    [cxx / n, cxy / n, cxz / n],
    [cxy / n, cyy / n, cyz / n],
    [cxz / n, cyz / n, czz / n],
  ];
  const mul = (m: number[][], v: number[]) => [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
  const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const normalize = (v: number[]): number[] => {
    const l = Math.hypot(v[0], v[1], v[2]);
    return l > 1e-12 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
  };
  const power = (m: number[][], seed: number[]): number[] => {
    let v = normalize(seed);
    for (let i = 0; i < 48; i++) {
      const w = mul(m, v);
      const len = Math.hypot(w[0], w[1], w[2]);
      if (len < 1e-12) return [0, 0, 0];
      v = [w[0] / len, w[1] / len, w[2] / len];
    }
    return v;
  };

  const v1 = power(M, [1, 0, 0]);
  if (!v1[0] && !v1[1] && !v1[2]) return null;
  const l1 = dot(v1, mul(M, v1));
  // 收缩：M' = M - λ1·v1·v1ᵀ，再取次大特征向量
  const M1 = M.map((row, i) => row.map((val, j) => val - l1 * v1[i] * v1[j]));
  let v2 = power(M1, Math.abs(v1[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
  const proj = dot(v2, v1);
  v2 = normalize([v2[0] - proj * v1[0], v2[1] - proj * v1[1], v2[2] - proj * v1[2]]);
  if (!v2[0] && !v2[1] && !v2[2]) {
    v2 = normalize([-v1[1], v1[0], 0]);
  }
  // 右手系：v3 = v1 × v2（保证不镜像，否则分子手性会反）
  const v3 = [
    v1[1] * v2[2] - v1[2] * v2[1],
    v1[2] * v2[0] - v1[0] * v2[2],
    v1[0] * v2[1] - v1[1] * v2[0],
  ];
  return [...v1, ...v2, ...v3];
}

// ─── 取景：两条路径同源的「投影跨度」纯函数 ────────────────────
interface FramingOptions {
  atoms: Atom[];
  center: [number, number, number];
  basis: number[] | null;
  width: number;
  height: number;
  fovDeg?: number;
  fill?: number;
  yaw?: number;
  pitch?: number;
  /** 渲染模式：只用于选「参考包络半径」，见函数注释（不影响朝向与投影） */
  mode?: RenderingMode;
}

/**
 * 反解相机距离，使分子（核骨架 + 参考包络半径）在默认朝向下正好占视口短边的 78%。
 *
 * 屏幕投影（与软件路径逐像素同构）：
 *   depth = D − z，focal = (h/2)/tan(fov/2)，
 *   球心 px = x · focal / depth，球体剪影半径 = r · focal / √(depth² − r²)。
 * 由于各原子 depth 不同（最短轴朝深度也有真实厚度），投影跨度对 D 不是线性的，
 * 用「每个原子都按近表面约束」的闭式解会明显欠填（实测 40 原子肽只填到 59%，苯环 75%）。
 * 因此这里对 D 做二分：跨度随 D 单调递减，48 次二分足够到亚像素级。
 *
 * 参考包络半径 r（决定三种模式之间的相对大小）：
 *   · ball-stick / space-filling 一律取「空间填充」的范德华壳（与 renderingMode 无关）。
 *     于是同一分子的相机距离在两种模式下完全一样 → ball-stick 的墨迹自然小于
 *     space-filling（球径 0.42×vdW vs 1.0×vdW），这正是专业观感差异的来源；
 *     若按各自模式的墨迹去取景，两种模式会被缩放成一样大，反而失去区别。
 *     取 vdW 而非更小的球棍半径，可保证 space-filling（最大）永不超出取景框。
 *   · tube 取它自己的包络半径（球 0.18 + 细键）：管线模型没有「范德华壳」，
 *     若仍按 vdW 取景，小分子会被缩成画面中间一小团（实测苯环只剩短边 ~54%）。
 */
interface InkSpan { x: number; y: number; }

/** 给定相机距离，返回默认朝向下「参考包络」的屏幕投影跨度（px）。任一球穿过相机面则返回 Infinity。 */
function measureInkSpan(
  atoms: Atom[],
  center: [number, number, number],
  basis: number[] | null,
  referenceMode: RenderingMode,
  focal: number,
  distance: number,
  cosY: number,
  sinY: number,
  cosP: number,
  sinP: number,
): InkSpan {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i];
    if (!atom) continue;
    const lx = atom.x - center[0];
    const ly = atom.y - center[1];
    const lz = atom.z - center[2];
    if (!Number.isFinite(lx) || !Number.isFinite(ly) || !Number.isFinite(lz)) continue;
    // 1) 主轴定向（行主序 3×3）——与 WebGL group 的 quaternion 完全同一个矩阵
    const bx = basis ? basis[0] * lx + basis[1] * ly + basis[2] * lz : lx;
    const by = basis ? basis[3] * lx + basis[4] * ly + basis[5] * lz : ly;
    const bz = basis ? basis[6] * lx + basis[7] * ly + basis[8] * lz : lz;
    // 2) 默认视角的 yaw/pitch（与软件路径逐字一致的旋转顺序）
    const x1 = bx * cosY + bz * sinY;
    const z1 = -bx * sinY + bz * cosY;
    const y2 = by * cosP - z1 * sinP;
    const z2 = by * sinP + z1 * cosP;
    const depth = distance - z2;
    const r = atomWorldRadius(atom.element, referenceMode);
    if (!(depth > r * 1.0001)) return { x: Infinity, y: Infinity };
    const rad = (r * focal) / Math.sqrt(depth * depth - r * r);
    const cx = (x1 * focal) / depth;
    const cy = (y2 * focal) / depth;
    if (cx - rad < minX) minX = cx - rad;
    if (cx + rad > maxX) maxX = cx + rad;
    if (cy - rad < minY) minY = cy - rad;
    if (cy + rad > maxY) maxY = cy + rad;
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return { x: Infinity, y: Infinity };
  }
  return { x: maxX - minX, y: maxY - minY };
}

function computeFramedCameraDistance(options: FramingOptions): number {
  const { atoms, center, basis } = options;
  const width = Number.isFinite(options.width) ? options.width : 0;
  const height = Number.isFinite(options.height) ? options.height : 0;
  const rawFov = options.fovDeg;
  const fovDeg = typeof rawFov === 'number' && Number.isFinite(rawFov) ? rawFov : CAMERA_FOV_DEG;
  if (!atoms || atoms.length === 0 || !(width > 2) || !(height > 2)) return DEFAULT_CAMERA_DISTANCE;

  const referenceMode: RenderingMode = options.mode === 'tube' ? 'tube' : 'space-filling';
  const fill = clamp(options.fill ?? FRAME_FILL, 0.2, 0.98);
  const yaw = options.yaw ?? DEFAULT_VIEW_YAW;
  const pitch = options.pitch ?? DEFAULT_VIEW_PITCH;
  const fov = (clamp(fovDeg, 10, 120) * Math.PI) / 180;
  const focal = height / 2 / Math.tan(fov / 2);
  const targetX = width * fill;
  const targetY = height * fill;
  if (!(focal > 0) || !(targetX > 0) || !(targetY > 0)) return DEFAULT_CAMERA_DISTANCE;

  const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
  const spanAt = (d: number) =>
    measureInkSpan(atoms, center, basis, referenceMode, focal, d, cosY, sinY, cosP, sinP);

  // 上界：先翻倍到「放得下」，再二分收紧到亚像素
  let hi = 2;
  let hiSpan = spanAt(hi);
  for (let i = 0; i < 40 && !(hiSpan.x <= targetX && hiSpan.y <= targetY); i++) {
    hi *= 1.6;
    if (!Number.isFinite(hi) || hi > 1e9) return DEFAULT_CAMERA_DISTANCE;
    hiSpan = spanAt(hi);
  }
  if (!(hiSpan.x <= targetX && hiSpan.y <= targetY)) return DEFAULT_CAMERA_DISTANCE;

  let lo = Math.min(0.05, hi * 0.5);
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    const midSpan = spanAt(mid);
    if (midSpan.x <= targetX && midSpan.y <= targetY) hi = mid; else lo = mid;
  }
  return Math.max(hi, 1.2);
}

/**
 * 默认视角对应的相机位置（WebGL 用）。
 * 与软件路径「模型绕 Y 转 yaw、绕 X 转 pitch」严格等价：
 *   相机位置 = Rᵀ·(0,0,D)，R = Rx(pitch)·Ry(yaw)，且 lookAt(0,0,0) + up=(0,1,0)。
 * 这样 three 的 view 矩阵给出的相机坐标恰好等于软件路径的 (x1, y2, z2 − D)，
 * 透视投影逐像素一致（推导见交付报告）。
 */
function defaultCameraPosition(distance: number): [number, number, number] {
  const d = Number.isFinite(distance) && distance > 0 ? distance : DEFAULT_CAMERA_DISTANCE;
  const cosP = Math.cos(DEFAULT_VIEW_PITCH), sinP = Math.sin(DEFAULT_VIEW_PITCH);
  const cosY = Math.cos(DEFAULT_VIEW_YAW), sinY = Math.sin(DEFAULT_VIEW_YAW);
  return [-d * cosP * sinY, d * sinP, d * cosP * cosY];
}

/** 图例数据：按当前分子真实原子统计（前 8 种元素，其余合并为「其他」） */
interface LegendEntry { symbol: string; count: number; color: string; }

function buildLegend(atoms: Atom[]): LegendEntry[] {
  const counts = new Map<string, number>();
  for (let i = 0; i < atoms.length; i++) {
    const symbol = normalizeElement(atoms[i]?.element);
    counts.set(symbol, (counts.get(symbol) || 0) + 1);
  }
  const list = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const top = list.slice(0, 8).map(([symbol, count]) => ({
    symbol,
    count,
    color: symbol === '?' ? '#8b95a5' : cpkColor(symbol),
  }));
  const rest = list.slice(8).reduce((sum, [, count]) => sum + count, 0);
  if (rest > 0) top.push({ symbol: '其他', count: rest, color: '#6b7280' });
  return top;
}

// ══════════════════════════════════════════════════════════════════════════
// ─── 结构标注引擎（纯函数，两条渲染路径共用）────────────────────────────
// 目的：仅凭 atoms+bonds（0-based，氢为显式原子）推断肽链的残基组成、主链原子角色与
// 功能基，用于在两条渲染路径上显示「诚实、克制」的结构标示。
//
// 诚实边界（红线，绝不能越）：
//   · 残基身份只在与 20 标准残基模板「有根图同构」唯一匹配时给出（high）；
//     匹配不上/非标准/H 缺失一律降级为「待验证」，绝不猜名。
//   · 绝不标注二级结构（α螺旋/β折叠）、L/D 手性、PTM 命名、活性/功效——这些在
//     单一构象 + 无立体 SMILES 输入下不可靠，属规范禁止项。
//   · 主链 N/CA/C/O 是连接性唯一确定的结构角色，不是编造的命名。
// 安全：任何异常（空输入/非法索引/环搜索失控）都降级返回空标注，绝不抛错打崩画布。
// 复杂度：邻接表 O(V+E)，肽键判别 O(E)，链组装 O(残基)，同构匹配只对 ≤18 原子侧链
//         回溯（327 原子亚毫秒），无 O(n²) 全对比。
// ══════════════════════════════════════════════════════════════════════════

/** 单个原子的结构标注（供 hover tooltip / 原子级标签使用） */
export interface AtomAnnotation {
  /** 0-based 原子索引 */
  index: number;
  element: string;
  /** 所属残基序号（1-based，N端=1）；非残基原子为 null */
  residueIndex: number | null;
  /** 主链结构角色（连接性唯一确定） */
  backboneRole: 'N' | 'CA' | 'C' | 'O' | null;
  /** 是否属于侧链 */
  isSideChain: boolean;
  /** 残基三字母名（仅 high 置信时有值；否则 null=待验证，不猜名） */
  residueName: string | null;
  /** 残基身份置信度 */
  confidence: 'high' | 'low';
  /** 该原子参与的功能基（可多个） */
  functionalGroups: string[];
}

/** 一条有序残基（N端→C端） */
export interface ResidueAnnotation {
  /** 1-based，N端=1 */
  index: number;
  /** 仅 high 置信时有名，否则 null */
  name: string | null;
  confidence: 'high' | 'low';
  /** 主链原子索引（结构角色 → 原子索引） */
  N: number; CA: number; C: number; O: number;
  /** 侧链重原子索引（不含 CA） */
  sideChain: number[];
  /** 是否 N 端 / C 端 */
  isNTerm: boolean;
  isCTerm: boolean;
}

/** 功能基实例（诚实标注：只报连接性可证的基团，不报活性/功效） */
export interface FunctionalGroupAnnotation {
  kind: string;
  label: string;
  /** 关键原子索引 */
  atoms: number[];
}

export interface StructureAnnotations {
  residues: ResidueAnnotation[];
  atomAnnotations: AtomAnnotation[];
  functionalGroups: FunctionalGroupAnnotation[];
  /** 氢是否可用于身份判别（显式氢缺失时残基名降级为「待验证」） */
  hydrogensAvailable: boolean;
}

/** 归一化键级：single/double/triple/aromatic → 用于同构比较 */
function normalizeBondOrder(type: string | undefined): string {
  const t = (type || 'single').toLowerCase();
  if (t === 'double' || t === 'triple' || t === 'aromatic') return t;
  return 'single';
}

/** 邻接表：adj[i] = [{to, order}]；非法输入返回 null（降级信号） */
function buildAdjacency(atoms: Atom[], bonds: Bond[]): Array<Array<{ to: number; order: string }>> | null {
  const n = atoms.length;
  const adj: Array<Array<{ to: number; order: string }>> = new Array(n);
  for (let i = 0; i < n; i++) adj[i] = [];
  for (let k = 0; k < bonds.length; k++) {
    const b = bonds[k];
    if (!b) continue;
    const s = b.start, e = b.end;
    if (!Number.isInteger(s) || !Number.isInteger(e)) continue;
    if (s < 0 || e < 0 || s >= n || e >= n || s === e) continue;
    const order = normalizeBondOrder(b.type);
    adj[s].push({ to: e, order });
    adj[e].push({ to: s, order });
  }
  return adj;
}

/** 显式氢计数：heavy[h] = 与该重原子成键的氢原子个数 */
function countExplicitHydrogens(atoms: Atom[], adj: Array<Array<{ to: number; order: string }>>): Int32Array {
  const heavy = new Int32Array(atoms.length);
  for (let i = 0; i < atoms.length; i++) {
    if (normalizeElement(atoms[i].element) !== 'H') continue;
    const nb = adj[i];
    for (let k = 0; k < nb.length; k++) {
      const t = nb[k].to;
      if (t >= 0 && t < atoms.length) heavy[t]++;
    }
  }
  return heavy;
}

// ─── 20 标准残基侧链模板（有根图，root=CB；Gly 的 root=CA）────────────────
// 每个原子 = [元素, 与重原子成键的显式氢数]；键 = [i, j, 键级]。
// 索引 0 恒为 root。氢数按「RDKit AddHs 后的中性、标准质子化态」写死——同构比较时
// 允许 ±1 容差（见 isAtomCompatible），以兼容末端 NH3⁺/COO⁻ 等轻微质子化差异。
// 芳香环按 Kekulé 交替单双键写出（与后端 RDKit 输出一致）。
type TplAtom = [string, number];
interface ResidueTemplate { name: string; atoms: TplAtom[]; bonds: Array<[number, number, string]>; }

/** 单字母→三字母残基码（用于已知序列交叉校验/补全残基名）。 */
const AA1_TO_3: Record<string, string> = {
  A: 'Ala', R: 'Arg', N: 'Asn', D: 'Asp', C: 'Cys', E: 'Glu', Q: 'Gln', G: 'Gly',
  H: 'His', I: 'Ile', L: 'Leu', K: 'Lys', M: 'Met', F: 'Phe', P: 'Pro', S: 'Ser',
  T: 'Thr', W: 'Trp', Y: 'Tyr', V: 'Val',
};

const AA_TEMPLATES: ResidueTemplate[] = [
  // Gly：无侧链（root 即 CA），CA 带 2 个 α-H
  { name: 'Gly', atoms: [['C', 2]], bonds: [] },
  // Ala：CH3
  { name: 'Ala', atoms: [['C', 1], ['C', 3]], bonds: [[0, 1, 'single']] },
  // Ser：CH2OH
  { name: 'Ser', atoms: [['C', 1], ['C', 2], ['O', 1]], bonds: [[0, 1, 'single'], [1, 2, 'single']] },
  // Thr：CH(OH)CH3（CB 连 OG1 与 CG2；侧链 3 重原子）
  { name: 'Thr', atoms: [['C', 1], ['O', 1], ['C', 3]], bonds: [[0, 1, 'single'], [0, 2, 'single']] },
  // Val：CH(CH3)2（CB 连两个甲基；侧链 3 重原子，CB 度2）
  { name: 'Val', atoms: [['C', 1], ['C', 3], ['C', 3]], bonds: [[0, 1, 'single'], [0, 2, 'single']] },
  // Leu：CH2-CH(CH3)2（CB-CH2 度2 且 H2，CG 支链度3 H1，两个甲基度1 H3；侧链 4 重原子）
  { name: 'Leu', atoms: [['C', 2], ['C', 1], ['C', 3], ['C', 3]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [1, 3, 'single']] },
  // Ile：CH(CH3)-CH2-CH3（支链在 CB，度3；侧链 5 重原子）
  { name: 'Ile', atoms: [['C', 1], ['C', 3], ['C', 2], ['C', 2], ['C', 3]], bonds: [[0, 1, 'single'], [0, 2, 'single'], [0, 3, 'single'], [3, 4, 'single']] },
  // Pro：侧链 CH2-CH2-CH2 回连主链 N（模板只含侧链 3 个 C；到 N 的回连由调用方单独校验）
  { name: 'Pro', atoms: [['C', 1], ['C', 2], ['C', 2], ['C', 2]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'single']] },
  // Phe：CH2-苯环（Kekulé）
  { name: 'Phe', atoms: [['C', 1], ['C', 2], ['C', 1], ['C', 1], ['C', 1], ['C', 1], ['C', 1]],
    bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'double'], [3, 4, 'single'], [4, 5, 'double'], [5, 6, 'single'], [6, 2, 'double']] },
  // Tyr：CH2-苯环-酚 OH（对位；CH2 度2 H2，环 6C，酚 O 度1 H1）
  { name: 'Tyr', atoms: [['C', 2], ['C', 2], ['C', 1], ['C', 1], ['C', 1], ['C', 1], ['C', 1], ['O', 1]],
    bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'double'], [3, 4, 'single'], [4, 5, 'double'], [5, 6, 'single'], [6, 2, 'double'], [5, 7, 'single']] },
  // Trp：CH2-吲哚（苯环并吡咯，NH）
  { name: 'Trp', atoms: [['C', 1], ['C', 2], ['C', 1], ['C', 1], ['C', 1], ['C', 1], ['C', 1], ['N', 1], ['C', 1], ['C', 1], ['C', 1]],
    bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'double'], [3, 4, 'single'], [4, 5, 'double'], [5, 6, 'single'], [6, 2, 'double'],
      [6, 7, 'single'], [7, 8, 'single'], [8, 9, 'double'], [9, 10, 'single'], [10, 5, 'double']] },
  // Asn：CH2-CONH2（侧链酰胺）
  { name: 'Asn', atoms: [['C', 1], ['C', 2], ['C', 0], ['O', 0], ['N', 2]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'double'], [2, 4, 'single']] },
  // Asp：CH2-COOH（质子化态）
  { name: 'Asp', atoms: [['C', 1], ['C', 2], ['C', 0], ['O', 0], ['O', 1]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'double'], [2, 4, 'single']] },
  // Gln：CH2-CH2-CONH2
  { name: 'Gln', atoms: [['C', 1], ['C', 2], ['C', 2], ['C', 0], ['O', 0], ['N', 2]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'single'], [3, 4, 'double'], [3, 5, 'single']] },
  // Glu：CH2-CH2-COOH
  { name: 'Glu', atoms: [['C', 1], ['C', 2], ['C', 2], ['C', 0], ['O', 0], ['O', 1]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'single'], [3, 4, 'double'], [3, 5, 'single']] },
  // Lys：CH2-CH2-CH2-CH2-NH2（ε-NH2；α-NH2 不在模板）
  { name: 'Lys', atoms: [['C', 1], ['C', 2], ['C', 2], ['C', 2], ['C', 2], ['N', 2]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'single'], [3, 4, 'single'], [4, 5, 'single']] },
  // Arg：CH2-CH2-CH2-NH-C(=NH)-NH2（胍基）
  { name: 'Arg', atoms: [['C', 1], ['C', 2], ['C', 2], ['C', 2], ['N', 1], ['C', 0], ['N', 1], ['N', 2]],
    bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'single'], [3, 4, 'single'], [4, 5, 'single'], [5, 6, 'double'], [5, 7, 'single']] },
  // His：CH2-咪唑（N-C=N-C=C，一个 NH）
  { name: 'His', atoms: [['C', 1], ['C', 2], ['C', 1], ['N', 1], ['C', 1], ['N', 0], ['C', 1]],
    bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'single'], [3, 4, 'double'], [4, 5, 'single'], [5, 6, 'double'], [6, 2, 'single']] },
  // Met：CH2-CH2-S-CH3（硫醚）
  { name: 'Met', atoms: [['C', 1], ['C', 2], ['C', 2], ['S', 0], ['C', 3]], bonds: [[0, 1, 'single'], [1, 2, 'single'], [2, 3, 'single'], [3, 4, 'single']] },
  // Cys：CH2-SH（巯基）
  { name: 'Cys', atoms: [['C', 1], ['C', 2], ['S', 1]], bonds: [[0, 1, 'single'], [1, 2, 'single']] },
];

/** 原子兼容判定：元素必须相同；显式氢数允许 ±1 容差（质子化态/末端差异）。
 *  H 完全缺失（heavy 全 0）时由调用方整体降级，不进入此处。 */
function isAtomCompatible(tEl: string, tH: number, el: string, h: number): boolean {
  if (tEl !== el) return false;
  return Math.abs(tH - h) <= 1;
}

/** 有根图同构（回溯）：template 与 target 侧链都 ≤ 18 重原子，实测量级下极快。
 *  elements 为全分子元素表（按原子索引）；hIndex 为显式氢计数，为 null 时跳过氢校验。 */
function matchTemplate(
  tpl: ResidueTemplate,
  tAtoms: number[],
  elements: string[],
  adj: Array<Array<{ to: number; order: string }>>,
  hIndex: Int32Array | null,
  caIdx: number,
  ringSizes: Int32Array,
): boolean {
  const tn = tpl.atoms.length;
  if (tn !== tAtoms.length) return false;
  // 预排序：度大的模板原子先排（剪枝更强）
  const tDeg = (ti: number) => tpl.bonds.reduce((s, b) => (b[0] === ti || b[1] === ti ? s + 1 : s), 0);
  const tplOrder = Array.from({ length: tn }, (_, i) => i).sort((a, b) => tDeg(b) - tDeg(a));
  // 邻接 + 键级（模板侧）
  const tAdj: Array<Array<{ to: number; order: string }>> = Array.from({ length: tn }, () => []);
  for (const [a, b, o] of tpl.bonds) { tAdj[a].push({ to: b, order: o }); tAdj[b].push({ to: a, order: o }); }
  const mapping = new Int32Array(tn).fill(-1);
  const used = new Uint8Array(tAtoms.length);

  // 模板内重原子度：只数目标原子邻接中「属于本侧链 tAtoms」的重原子（排除 H 与模板外主链原子如 CA）。
  // 与模板 tDeg（模板 bonds 内的连接数）同标准，保证 seed/bt 度数比对一致。
  const tSet = new Set(tAtoms);
  const internalDeg = (aj: number): number => {
    const nb = adj[aj];
    let d = 0;
    for (let k = 0; k < nb.length; k++) {
      const t = nb[k].to;
      if (tSet.has(t) && elements[t] !== 'H') d++;
    }
    return d;
  };

  const compatible = (ti: number, tj: number): boolean => {
    const [tEl, tH] = tpl.atoms[ti];
    const ta = tAtoms[tj];
    if (!ta || ta < 0 || ta >= elements.length) return false;
    if (elements[ta] !== tEl) return false;
    if (hIndex && Math.abs(tH - hIndex[ta]) > 1) return false;
    return true;
  };

  // bt：按 tplOrder 顺序逐个安放模板原子；已预置 mapping 的（seed）直接跳过。
  const bt = (pos: number): boolean => {
    if (pos === tn) return true;
    const ti = tplOrder[pos];
    if (mapping[ti] >= 0) return bt(pos + 1); // seed 已预置，跳过
    for (let tj = 0; tj < tAtoms.length; tj++) {
      if (used[tj]) continue;
      if (!compatible(ti, tj)) continue;
      // 芳香环碳的度数在模板（含 H）与实际（重原子邻接）下不一致，环原子跳过度数检查，
      // 改靠 ringSizes 环成员身份 + 连通性匹配（下方键级 bothRing 已放宽）。
      if (ringSizes[tAtoms[tj]] === 0 && internalDeg(tAtoms[tj]) !== tDeg(ti)) continue;
      // 校验与已映射邻居的键级一致
      let ok = true;
      for (const e of tAdj[ti]) {
        const mj = mapping[e.to];
        if (mj < 0) continue;
        const tOrder = adj[tAtoms[tj]]?.find((x) => x.to === tAtoms[mj])?.order;
        // 芳香环：环内重原子间的键，Kekulé 单双交替相位可能差一位（模板 vs RDKit 输出，都合法）。
        // 故两端都在环内（ringSizes>0）时跳过键级严格比对，只靠拓扑（度+连通性）匹配环。
        const bothRing = ringSizes[tAtoms[tj]] > 0 && ringSizes[tAtoms[mj]] > 0;
        if (!bothRing && tOrder !== e.order) { ok = false; break; }
      }
      if (!ok) continue;
      mapping[ti] = tj; used[tj] = 1;
      if (bt(pos + 1)) return true;
      mapping[ti] = -1; used[tj] = 0;
    }
    return false;
  };

  // seed：有根图同构需试「模板任意原子 × 目标任意原子」的所有配对——
  // 支链残基（如 Leu 支链在 CG 非 CB）的映射起点不一定是模板索引 0。
  for (let ti0 = 0; ti0 < tn; ti0++) {
    for (let rj = 0; rj < tAtoms.length; rj++) {
      if (used[rj]) continue;
      if (!compatible(ti0, rj)) continue;
      if (ringSizes[tAtoms[rj]] === 0 && internalDeg(tAtoms[rj]) !== tDeg(ti0)) continue;
      mapping.fill(-1); used.fill(0);
      mapping[ti0] = rj; used[rj] = 1;
      if (bt(0)) return true;
      mapping[ti0] = -1; used[rj] = 0;
    }
  }
  return false;
}

/** 环检测：返回每个原子所在的最小环大小（不在环上为 0）。BFS 找最短回路，O(V·E)。 */
function computeRingSizes(adj: Array<Array<{ to: number; order: string }>>): Int32Array {
  const n = adj.length;
  const ring = new Int32Array(n);
  for (let s = 0; s < n; s++) {
    // 从 s 的两个不同邻居出发，找它们之间的最短路径（不经过 s）→ 回路长 = 路径长 + 2
    const nb = adj[s];
    let best = Infinity;
    for (let a = 0; a < nb.length && best > 6; a++) {
      const start = nb[a].to;
      // BFS from start，禁走 s，目标为 nb[b].to
      const dist = new Int32Array(n).fill(-1);
      dist[start] = 0;
      const queue = [start];
      for (let qi = 0; qi < queue.length && best > 6; qi++) {
        const u = queue[qi];
        for (const e of adj[u]) {
          if (e.to === s) continue;
          if (dist[e.to] >= 0) continue;
          dist[e.to] = dist[u] + 1;
          if (dist[e.to] + 1 < best) {
            // 到达 s 的任一邻居即成环
            for (let b = 0; b < nb.length; b++) {
              if (b !== a && nb[b].to === e.to) { best = Math.min(best, dist[e.to] + 2); }
            }
          }
          queue.push(e.to);
        }
      }
    }
    ring[s] = best === Infinity ? 0 : best;
  }
  return ring;
}

/**
 * 主入口：从 atoms+bonds 推断结构标注。
 * 任何异常都降级为空标注（residues/atomAnnotations/functionalGroups 为空数组），
 * 绝不抛错——调用方（两条渲染路径）据此安全渲染「无标注」。
 * @param sequence 可选已知肽序列（单字母码，如 "VLGYT"）——用于校验/补全残基名（真值，非编造）。
 */
export function inferStructureAnnotations(
  atoms: Atom[],
  bonds: Bond[],
  sequence?: string,
): StructureAnnotations {
  const empty: StructureAnnotations = {
    residues: [], atomAnnotations: [], functionalGroups: [], hydrogensAvailable: false,
  };
  try {
    if (!Array.isArray(atoms) || atoms.length === 0) return empty;
    if (!Array.isArray(bonds)) bonds = [];
    const n = atoms.length;
    const adj = buildAdjacency(atoms, bonds);
    if (!adj) return empty;

    const elements: string[] = new Array(n);
    for (let i = 0; i < n; i++) elements[i] = normalizeElement(atoms[i]?.element);

    const hIndex = countExplicitHydrogens(atoms, adj);
    let totalH = 0;
    for (let i = 0; i < n; i++) if (elements[i] === 'H') totalH++;
    // H 缺失守卫：无显式氢 → 残基身份整体降级为「待验证」（位置性标注仍可用）
    const hydrogensAvailable = totalH > 0;

    // ── 肽键判别：C-N 单键 + C 恰好一个 C=O + 该 N 还连另一个碳（CA）
    //    「N 有第二碳」是排除 Asn/Gln 侧链酰胺的关键。
    // peptideTarget[N] = 与 N 成肽键的羰基 C（每个主链 N 至多一个）
    const peptideTarget = new Map<number, number>();
    for (let c = 0; c < n; c++) {
      if (elements[c] !== 'C') continue;
      // 羰基 C：恰好一个双键 O，且连一个单键 N
      let doubleO = -1, singleN = -1, oCount = 0;
      for (const e of adj[c]) {
        const el = elements[e.to];
        if (el === 'O') { oCount++; if (e.order === 'double') doubleO = e.to; }
        else if (el === 'N' && e.order === 'single') singleN = e.to;
      }
      if (doubleO < 0 || oCount !== 1 || singleN < 0) continue;
      const nn = singleN;
      // 该 N 还须连另一个碳（CA），且那个碳不是本羰基 C
      let secondC = -1;
      for (const e of adj[nn]) {
        if (elements[e.to] === 'C' && e.to !== c) { secondC = e.to; break; }
      }
      if (secondC < 0) continue; // 侧链酰胺（Asn/Gln）的 N 没有第二碳 → 排除
      peptideTarget.set(nn, c);
    }

    // ── 组装有序残基链：N端 = 连着 CA 但不作为任何肽键靶的 N（游离氨基）
    //    为防环状肽/异常图失控，限制残基数上限（327 原子肽实际 ≤ ~60 残基）。
    const MAX_RESIDUES = 200;
    const residues: ResidueAnnotation[] = [];
    const visitedN = new Set<number>();
    const caOf = (nn: number): number => {
      for (const e of adj[nn]) {
        if (elements[e.to] !== 'C') continue;
        // CA = 连本残基 N 且连某羰基 C（有双键 O）的碳
        const cand = e.to;
        for (const e2 of adj[cand]) {
          const cc = e2.to;
          if (elements[cc] !== 'C' || cc === nn) continue;
          let hasDoubleO = false;
          for (const e3 of adj[cc]) if (elements[e3.to] === 'O' && e3.order === 'double') hasDoubleO = true;
          if (hasDoubleO) return cand;
        }
      }
      return -1;
    };
    const carbonylOf = (ca: number): number => {
      for (const e of adj[ca]) {
        if (elements[e.to] !== 'C') continue;
        const cc = e.to;
        for (const e2 of adj[cc]) if (elements[e2.to] === 'O' && e2.order === 'double') return cc;
      }
      return -1;
    };
    const oxyOf = (cc: number): number => {
      for (const e of adj[cc]) if (elements[e.to] === 'O' && e.order === 'double') return e.to;
      return -1;
    };

    // 找 N端起点：非肽键靶、且连着一个「像 CA 的碳」（连 N 又连羰基 C）
    const starts: number[] = [];
    for (let i = 0; i < n; i++) {
      if (elements[i] !== 'N') continue;
      if (peptideTarget.has(i)) continue; // 是下游肽键靶 → 不是 N端
      if (caOf(i) >= 0) starts.push(i);
    }

    for (const startN of starts) {
      if (visitedN.has(startN)) continue;
      let curN = startN;
      let guard = 0;
      while (curN >= 0 && residues.length < MAX_RESIDUES && guard++ < MAX_RESIDUES) {
        if (visitedN.has(curN)) break;
        visitedN.add(curN);
        const ca = caOf(curN);
        const cc = ca >= 0 ? carbonylOf(ca) : -1;
        const ox = cc >= 0 ? oxyOf(cc) : -1;
        if (ca < 0 || cc < 0 || ox < 0) break; // 结构不完整 → 停止（已组装的保留）
        const ri = residues.length + 1;
        const residue: ResidueAnnotation = {
          index: ri, name: null, confidence: 'low',
          N: curN, CA: ca, C: cc, O: ox, sideChain: [],
          isNTerm: ri === 1, isCTerm: false,
        };
        residues.push(residue);
        // 侧链：从 CA DFS，禁止穿越 CA-N 与 CA-C(羰基)
        const blocked = new Set<number>([curN, cc]);
        const sc: number[] = [];
        const seen = new Set<number>([ca, curN, cc]);
        const stack = [ca];
        while (stack.length > 0) {
          const u = stack.pop()!;
          for (const e of adj[u]) {
            const v = e.to;
            if (blocked.has(v) || seen.has(v)) continue;
            if (elements[v] === 'H') continue; // 侧链只取重原子
            seen.add(v);
            sc.push(v);
            stack.push(v);
          }
        }
        residue.sideChain = sc;
        // 走到下一个残基的 N：本残基羰基 C 上、非本 CA 的那个单键 N（且是肽键靶）
        let nextN = -1;
        for (const e of adj[cc]) {
          if (elements[e.to] === 'N' && e.order === 'single' && e.to !== ca) { nextN = e.to; break; }
        }
        if (nextN >= 0 && peptideTarget.get(nextN) === cc && !visitedN.has(nextN)) {
          curN = nextN;
        } else {
          residue.isCTerm = true;
          curN = -1;
        }
      }
      // 只取第一条链（常规单链肽）；多链场景当前不展开
      break;
    }

    if (residues.length === 0) return { ...empty, hydrogensAvailable };

    // ── 残基身份判别：侧链重原子图 + 每原子氢计数 vs 模板有根图同构
    const ringSizes = computeRingSizes(adj);
    // 已知序列 → 单字母码数组（按残基顺序，供交叉校验/补全）
    const seqCodes = (sequence && typeof sequence === 'string')
      ? sequence.toUpperCase().replace(/[^A-Z]/g, '').split('')
      : null;
    for (const r of residues) {
      if (!hydrogensAvailable) { r.name = null; r.confidence = 'low'; continue; }
      const sc = r.sideChain;
      let matched: string | null = null;
      for (const tpl of AA_TEMPLATES) {
        if (tpl.name === 'Gly') {
          if (sc.length === 0) { matched = 'Gly'; break; }
          continue;
        }
        if (matchTemplate(tpl, sc, elements, adj, hIndex, r.CA, ringSizes)) { matched = tpl.name; break; }
      }
      // Pro 特判：侧链 3 个 C 且末端 C 回连主链 N
      if (!matched && sc.length === 3) {
        const last = sc[sc.length - 1];
        if (elements[last] === 'C' && adj[last].some((e) => e.to === r.N)) matched = 'Pro';
      }
      if (matched) { r.name = matched; r.confidence = 'high'; }
      else { r.name = null; r.confidence = 'low'; }
      // ── 已知序列交叉校验/补全（sequence 是用户输入真值，非编造）：
      //    ① 模板判出 → 与序列该位置单字母码比对：一致→保持 high；不一致→降为待验证（模板可能误配）。
      //    ② 模板判不出 → 序列该位置有码 → 用序列名补全（标为 high：来源是用户提供的序列）。
      if (seqCodes) {
        const code = seqCodes[r.index - 1];
        if (code) {
          const seqName = AA1_TO_3[code];
          if (seqName) {
            if (matched && matched !== seqName) {
              r.name = null; r.confidence = 'low'; // 模板与序列冲突 → 诚实降级
            } else if (!matched) {
              r.name = seqName; r.confidence = 'high'; // 序列补全
            }
          }
        }
      }
    }

    // ── 功能基检测（连接性可证的基团；不报活性/功效）
    const functionalGroups: FunctionalGroupAnnotation[] = [];
    const atomGroups = new Map<number, string[]>();
    const addGroup = (kind: string, label: string, atomsIn: number[]) => {
      functionalGroups.push({ kind, label, atoms: atomsIn });
      for (const a of atomsIn) {
        if (!atomGroups.has(a)) atomGroups.set(a, []);
        atomGroups.get(a)!.push(label);
      }
    };
    const neighborsByEl = (i: number, el: string) =>
      adj[i].filter((e) => elements[e.to] === el).map((e) => e.to);
    for (let i = 0; i < n; i++) {
      const el = elements[i];
      if (el === 'O') {
        const cNb = neighborsByEl(i, 'C');
        if (cNb.length === 1 && hIndex[i] === 1) addGroup('hydroxyl', '羟基 –OH', [i]);
      } else if (el === 'N') {
        const cNb = neighborsByEl(i, 'C');
        if (cNb.length === 1 && hIndex[i] === 2) addGroup('primary_amine', '伯胺 –NH₂', [i]);
      } else if (el === 'S') {
        const cNb = neighborsByEl(i, 'C');
        const sNb = neighborsByEl(i, 'S');
        if (sNb.length === 1) addGroup('disulfide', '二硫键 –S–S–', [i, sNb[0]]);
        else if (hIndex[i] === 1) addGroup('thiol', '巯基 –SH', [i]);
        else if (cNb.length === 2) addGroup('thioether', '硫醚 –S–', [i]);
      } else if (el === 'C') {
        // 羧基：C 连一个 =O + 一个 OH（OH = 单键 O，且该 O 连着 H）
        const doubleO = adj[i].find((e) => elements[e.to] === 'O' && e.order === 'double');
        const ohO = adj[i].find((e) => elements[e.to] === 'O' && e.order === 'single'
          && neighborsByEl(e.to, 'C').length === 1 && adj[e.to].some((x) => elements[x.to] === 'H'));
        if (doubleO && ohO) addGroup('carboxyl', '羧基 –COOH', [i, doubleO.to, ohO.to]);
        // 胍基：C 连 3 个 N
        const nNb = neighborsByEl(i, 'N');
        if (nNb.length === 3) addGroup('guanidino', '胍基', [i, ...nNb]);
      }
    }
    // 芳香环 / 咪唑：基于环检测
    for (let i = 0; i < n; i++) {
      const rs = ringSizes[i];
      if (rs === 6 && elements[i] === 'C') {
        // 苯环：6 元全碳环
        addGroup('aromatic_ring', '芳香环', [i]);
      } else if (rs === 5) {
        const ringAtoms = collectRingAtoms(adj, i, 5);
        const nCount = ringAtoms.filter((a) => elements[a] === 'N').length;
        if (nCount === 2) addGroup('imidazole', '咪唑环', ringAtoms);
      }
    }
    // 酚 OH：羟基 O 连在芳香环 C 上
    for (const fg of [...functionalGroups]) {
      if (fg.kind !== 'hydroxyl') continue;
      const o = fg.atoms[0];
      const cNb = neighborsByEl(o, 'C');
      if (cNb.length === 1 && ringSizes[cNb[0]] === 6) addGroup('phenol', '酚羟基', [o]);
    }

    // ── 每原子标注
    const atomAnnotations: AtomAnnotation[] = [];
    const residueOf = new Map<number, ResidueAnnotation>();
    const roleOf = new Map<number, 'N' | 'CA' | 'C' | 'O'>();
    const sideChainSet = new Set<number>();
    for (const r of residues) {
      residueOf.set(r.N, r); residueOf.set(r.CA, r); residueOf.set(r.C, r); residueOf.set(r.O, r);
      roleOf.set(r.N, 'N'); roleOf.set(r.CA, 'CA'); roleOf.set(r.C, 'C'); roleOf.set(r.O, 'O');
      for (const a of r.sideChain) sideChainSet.add(a);
    }
    for (let i = 0; i < n; i++) {
      const r = residueOf.get(i) ?? null;
      atomAnnotations.push({
        index: i,
        element: elements[i] || '?',
        residueIndex: r ? r.index : null,
        backboneRole: roleOf.get(i) ?? null,
        isSideChain: sideChainSet.has(i),
        residueName: r ? r.name : null,
        confidence: r ? r.confidence : 'low',
        functionalGroups: atomGroups.get(i) ?? [],
      });
    }

    return { residues, atomAnnotations, functionalGroups, hydrogensAvailable };
  } catch (err) {
    logger.warn('[MoleculeViewer3D] 结构标注推断失败，降级为无标注', err as Error);
    return empty;
  }
}

/** 收集含 atomIdx 的、大小为 size 的环上所有原子（BFS 限深） */
function collectRingAtoms(adj: Array<Array<{ to: number; order: string }>>, atomIdx: number, size: number): number[] {
  const n = adj.length;
  const nb = adj[atomIdx];
  for (let a = 0; a < nb.length; a++) {
    const start = nb[a].to;
    const prev = new Int32Array(n).fill(-1);
    const dist = new Int32Array(n).fill(-1);
    dist[start] = 0; prev[start] = -2;
    const queue = [start];
    let found = -1;
    for (let qi = 0; qi < queue.length && found < 0; qi++) {
      const u = queue[qi];
      if (dist[u] >= size - 1) continue;
      for (const e of adj[u]) {
        if (e.to === atomIdx || dist[e.to] >= 0) continue;
        dist[e.to] = dist[u] + 1;
        prev[e.to] = u;
        if (nb.some((x) => x.to === e.to) && e.to !== start) {
          // e.to 与 atomIdx 相邻 → 回路闭合
          found = e.to;
          break;
        }
        queue.push(e.to);
      }
    }
    if (found >= 0) {
      const atoms: number[] = [atomIdx];
      let cur = found;
      while (cur !== start && cur !== -2 && atoms.length <= size) { atoms.push(cur); cur = prev[cur]; }
      atoms.push(start);
      if (atoms.length === size) return atoms;
    }
  }
  return [atomIdx];
}

// ─── 显示层标签构造（诚实 + 克制）────────────────────────────────────────
export type AnnotationLevel = 'off' | 'residue' | 'atom';

/** 一个可渲染的屏幕标签（两条渲染路径共用同一份定义） */
export interface StructureLabel {
  key: string;
  /** 锚定原子索引 */
  atom: number;
  /** 主文本 */
  text: string;
  /** 视觉档位：terminal 最醒目，residue 次之，backbone 最弱 */
  tier: 'terminal' | 'residue' | 'backbone';
  /** 相对锚点的像素偏移（逻辑 px），用于错开重叠 */
  dx: number;
  dy: number;
}

/** 由结构标注构造默认显示标签（残基级：N端/C端/残基编号，克制不外扩） */
export function buildStructureLabels(ann: StructureAnnotations): StructureLabel[] {
  const labels: StructureLabel[] = [];
  const residues = ann.residues;
  if (residues.length === 0) return labels;
  const k = residues.length;
  for (const r of residues) {
    const nameTxt = r.name ? r.name : '待验证';
    if (r.isNTerm) {
      labels.push({ key: `nterm-${r.index}`, atom: r.CA, text: `N端 · 残基1 ${nameTxt}`, tier: 'terminal', dx: 0, dy: -14 });
    } else if (r.isCTerm) {
      labels.push({ key: `cterm-${r.index}`, atom: r.CA, text: `C端 · 残基${k} ${nameTxt}`, tier: 'terminal', dx: 0, dy: 14 });
    } else {
      labels.push({ key: `res-${r.index}`, atom: r.CA, text: `残基${r.index} ${nameTxt}`, tier: 'residue', dx: 12, dy: 0 });
    }
  }
  return labels;
}

/** 原子级标签（主链 N/CA/C/O 结构角色 + 关键功能基），仅在 atom 档启用 */
export function buildAtomLevelLabels(ann: StructureAnnotations): StructureLabel[] {
  const labels: StructureLabel[] = [];
  for (const r of ann.residues) {
    const nm = r.name ? r.name : `残基${r.index}`;
    labels.push({ key: `bb-N-${r.index}`, atom: r.N, text: `${nm} N`, tier: 'backbone', dx: -12, dy: -8 });
    labels.push({ key: `bb-CA-${r.index}`, atom: r.CA, text: 'CA', tier: 'backbone', dx: 0, dy: -8 });
    labels.push({ key: `bb-C-${r.index}`, atom: r.C, text: 'C', tier: 'backbone', dx: 10, dy: 6 });
    labels.push({ key: `bb-O-${r.index}`, atom: r.O, text: 'O', tier: 'backbone', dx: 10, dy: -6 });
  }
  // 关键功能基：只标「羧基 / 羟基 / 巯基 / 二硫键 / 胍基 / 咪唑 / 酚羟基」，克制
  const keep = new Set(['carboxyl', 'hydroxyl', 'thiol', 'disulfide', 'guanidino', 'imidazole', 'phenol']);
  const seen = new Set<string>();
  for (const fg of ann.functionalGroups) {
    if (!keep.has(fg.kind) || fg.atoms.length === 0) continue;
    const anchor = fg.atoms[0];
    const dedupe = `${fg.kind}@${anchor}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    labels.push({ key: `fg-${fg.kind}-${anchor}`, atom: anchor, text: fg.label, tier: 'backbone', dx: 14, dy: 10 });
  }
  return labels;
}

/** hover tooltip 文案（诚实：待验证不猜名，绝不标二级结构/手性/PTM/功效） */
export function buildAtomTooltip(ann: StructureAnnotations, atomIndex: number): string {
  const a = ann.atomAnnotations[atomIndex];
  if (!a) return '';
  const parts: string[] = [];
  const el = a.element;
  if (a.residueIndex != null) {
    const r = ann.residues.find((x) => x.index === a.residueIndex);
    const nm = r?.name ? r.name : '待验证';
    if (a.backboneRole) parts.push(`残基${a.residueIndex} ${nm} · 主链 ${a.backboneRole}`);
    else if (a.isSideChain) parts.push(`残基${a.residueIndex} ${nm} · 侧链`);
    else parts.push(`残基${a.residueIndex} ${nm}`);
  } else {
    parts.push(`${el} 原子`);
  }
  if (a.functionalGroups.length > 0) parts.push(a.functionalGroups.join('、'));
  if (a.residueIndex != null && a.confidence === 'low') parts.push('（身份待验证）');
  return parts.join('  ');
}

// ─── DOM 标签覆盖层（软件 Canvas2D 路径用）────────────────────────────────
// 关键约束：**绝不把标注画进 2D canvas 像素**。3d-visual-qa 门禁用 canvas.toDataURL 读回
// 像素做墨迹/bbox/质心统计，只屏蔽顶栏/底栏两行；若把文字画在 canvas 上，会被当成分子
// 撑大 bbox、污染质心。因此标注走「DOM 覆盖层」：canvas 像素保持逐字节不变（开关标注
// 不改变门禁读到的任何像素），门禁绝对安全。
// 实现方式仿 drei Html：3D→屏幕投影在 canvas 的 draw 里算（复用同一套 basis/yaw/pitch/
// 透视公式），结果写进 screenPositions ref；本组件用自己的 rAF 循环逐帧把坐标写到 DOM
// transform 上——不经过 React setState，拖拽/自动旋转时零额外重渲染。

/** 单个标签的屏幕投影结果（draw 阶段写入，rAF 读取） */
interface LabelScreenPos { x: number; y: number; visible: boolean; depth: number; }

/** 按 tier 给出标签的视觉样式（克制：小字号、半透明深底、端点更醒目） */
function labelStyleFor(tier: StructureLabel['tier']): { chip: string; dot: string } {
  switch (tier) {
    case 'terminal':
      return {
        chip: 'border-secondary-400/50 bg-secondary-950/85 text-secondary-100',
        dot: 'bg-secondary-400',
      };
    case 'residue':
      return {
        chip: 'border-white/15 bg-neutral-950/80 text-neutral-200',
        dot: 'bg-neutral-400',
      };
    default: // backbone / 功能基
      return {
        chip: 'border-white/10 bg-neutral-950/70 text-neutral-300',
        dot: 'bg-neutral-500',
      };
  }
}

function StructureLabelsOverlay({
  labels, screenPositions, hoverAtom, onHoverAtom, tooltipBuilder,
}: {
  labels: StructureLabel[];
  screenPositions: MutableRefObject<Map<string, LabelScreenPos>>;
  hoverAtom: number | null;
  onHoverAtom: (idx: number | null) => void;
  tooltipBuilder: (atomIndex: number) => string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const nodesRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // labels 集变化时同步 DOM 节点集合（增删，不重建已存在的）
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const nodes = nodesRef.current;
    const wanted = new Set(labels.map((l) => l.key));
    for (const [key, node] of nodes) {
      if (!wanted.has(key)) { node.remove(); nodes.delete(key); }
    }
    for (const l of labels) {
      if (nodes.has(l.key)) continue;
      const st = labelStyleFor(l.tier);
      const el = document.createElement('div');
      el.setAttribute('data-annot-key', l.key);
      el.style.cssText =
        'position:absolute;left:0;top:0;will-change:transform;pointer-events:none;'
        + 'display:flex;align-items:center;gap:3px;padding:1px 5px;border-radius:5px;'
        + 'border-width:1px;border-style:solid;white-space:nowrap;'
        + `font:500 10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.01em;`
        + `transform:translate(-9999px,-9999px);`;
      el.className = st.chip;
      const dot = document.createElement('span');
      dot.style.cssText = `width:5px;height:5px;border-radius:9999px;flex:none;${st.dot}`;
      const txt = document.createElement('span');
      txt.textContent = l.text;
      el.appendChild(dot); el.appendChild(txt);
      container.appendChild(el);
      nodes.set(l.key, el);
    }
  }, [labels]);

  // rAF 逐帧把屏幕坐标写到 DOM（不触发 React 渲染）
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const positions = screenPositions.current;
      const nodes = nodesRef.current;
      if (positions.size === 0) return;
      for (const l of labels) {
        const el = nodes.get(l.key);
        if (!el) continue;
        const p = positions.get(l.key);
        if (!p || !p.visible || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          el.style.transform = 'translate(-9999px,-9999px)';
          continue;
        }
        // 屏幕外 / 太靠边的不显示（避免把标注画出画布）
        const off = p.x < 4 || p.y < 4;
        el.style.transform = off
          ? 'translate(-9999px,-9999px)'
          : `translate(${p.x.toFixed(1)}px,${p.y.toFixed(1)}px) translate(-50%,-50%)`;
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [labels, screenPositions]);

  // hover tooltip：跟随悬停原子
  const tip = hoverAtom != null ? tooltipBuilder(hoverAtom) : '';

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
      aria-hidden="true"
    >
      {tip && hoverAtom != null && (
        <StructureHoverTooltip atomIndex={hoverAtom} annotationsTip={tip} screenPositions={screenPositions} />
      )}
    </div>
  );
}

/** 软件路径的 hover tooltip：定位到悬停原子的屏幕坐标 */
function StructureHoverTooltip({
  atomIndex, annotationsTip, screenPositions,
}: {
  atomIndex: number | null;
  annotationsTip: string;
  screenPositions: MutableRefObject<Map<string, LabelScreenPos>>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // 悬停原子的屏幕坐标：draw 阶段把每个标签锚点原子的坐标也存了一份（key=atom:<idx>）
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const el = ref.current;
      if (!el || atomIndex == null) return;
      const p = screenPositions.current.get(`atom:${atomIndex}`);
      if (!p || !p.visible) { el.style.transform = 'translate(-9999px,-9999px)'; return; }
      el.style.transform = `translate(${(p.x + 12).toFixed(1)}px,${(p.y - 10).toFixed(1)}px)`;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [atomIndex, screenPositions]);
  return (
    <div
      ref={ref}
      className="absolute left-0 top-0 max-w-[240px] rounded-md border border-white/15 bg-neutral-950/92 px-2 py-1 shadow-lg shadow-black/50 backdrop-blur-sm"
      style={{ transform: 'translate(-9999px,-9999px)', pointerEvents: 'none' }}
    >
      <span className="font-mono text-[10px] leading-4 text-neutral-200">{annotationsTip}</span>
    </div>
  );
}

// ─── WebGL 3D 锚定标注层（drei Html，独立 overlay，不影响像素统计）────────
// Html 把标签 portal 到 canvas 之外的 DOM 层，用 matrixWorld 投影到屏幕坐标，因此：
//   · 是独立 overlay —— 不进入 WebGL 帧缓冲，PNG 导出（gl.render+读回）不含标注，
//     门禁读到的 canvas 像素完全不变；
//   · 标签锚在 model group 内 → 自动继承质心平移 + 主轴定向 quaternion，随分子旋转；
//   · pointerEvents:none + zIndexRange 压到 [1,0]（低于顶栏/底栏 z-10），不抢交互、不挡 UI。
// 不用 occlude（逐帧 raycast 几百个 mesh 代价高，且 demand 帧循环下易卡）；
// 不用 Billboard/Text（本 drei 构建未导出，Text 还要拉 troika 字体）。
function AnnotationLabels3D({
  labels, atoms, tooltipBuilder,
}: {
  labels: StructureLabel[];
  atoms: Atom[];
  tooltipBuilder: (atomIndex: number) => string;
}) {
  if (labels.length === 0) return null;
  return (
    <group>
      {labels.map((label) => {
        const atom = atoms[label.atom];
        if (!atom || !Number.isFinite(atom.x) || !Number.isFinite(atom.y) || !Number.isFinite(atom.z)) return null;
        const tip = tooltipBuilder(label.atom);
        return (
          <Html
            key={label.key}
            position={[atom.x, atom.y, atom.z]}
            center
            prepend
            pointerEvents="none"
            zIndexRange={[1, 0]}
            style={{ pointerEvents: 'none' }}
          >
            <div
              title={tip || undefined}
              className={(() => {
                const st = labelStyleFor(label.tier);
                return `flex items-center gap-1 whitespace-nowrap rounded border px-1 py-px font-mono text-[10px] leading-tight ${st.chip}`;
              })()}
            >
              <span className={`inline-block h-1 w-1 rounded-full ${labelStyleFor(label.tier).dot}`} aria-hidden="true" />
              <span>{label.text}</span>
            </div>
          </Html>
        );
      })}
    </group>
  );
}

// ─── WebGL 上下文丢失/恢复处理（真实监听 gl.domElement）────────
// 注：真正的「R3F onCreated→connect 访问已回收 canvas」竞态由 MoleculeViewer3D 里的
// 全局 unhandledrejection 守卫兜底（错误边界捕获不到），这里只负责正常的 lost/restored。
function ContextLossHandler() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    const canvas = gl.domElement;
    if (!canvas) return;
    const onContextLost = (e: Event) => {
      e.preventDefault(); // 允许后续 restore
      logger.warn('[MoleculeViewer3D] WebGL 上下文丢失，等待恢复');
    };
    const onContextRestored = () => {
      // 恢复后必须触发一次重绘（demand 模式下不会自动渲染）
      invalidate();
      logger.info('[MoleculeViewer3D] WebGL 上下文已恢复');
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
    };
  }, [gl, invalidate]);

  return null;
}

// ─── 数据/模式变化时显式 invalidate（demand 模式必需）───────────
function SceneInvalidator({ mode, atoms }: { mode: string; atoms: Atom[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => { invalidate(); }, [mode, atoms, invalidate]);
  return null;
}

// ─── 自动旋转时驱动 demand 模式持续出帧（关闭 / 卸载即停）────────
function AutoRotateDriver({ enabled }: { enabled: boolean }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    const tick = () => {
      invalidate(); // 每个 rAF 出一帧：drei 的 useFrame 会调用 controls.update()
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, invalidate]);
  return null;
}

// ─── 弱 GPU 兜底看门狗（软件渲染器字符串被屏蔽时靠它兜底）────────
// 原理：mount 渲染后测两次 rAF 的实际间隔。真实 GPU 两帧 < 100ms；若 > 1500ms，
// 说明主线程被首帧（环境贴图 + 接触阴影 + 高细分清漆材质）长期占满 → 回调 onSlow 降档。
// 刻意不自触 invalidate（不叠加额外渲染负担），只观察自然 rAF 节拍；只评估一次。
function PerfWatchdog({ enabled, onSlow }: { enabled: boolean; onSlow: () => void }) {
  useEffect(() => {
    if (!enabled) return;
    let done = false;
    let raf1 = 0, raf2 = 0;
    const t0 = performance.now();
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        if (done) return;
        done = true;
        const dt = performance.now() - t0;
        if (dt > 1500) onSlow();
      });
    });
    return () => {
      done = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [enabled, onSlow]);
  return null;
}

// ─── 球棍模型（PBR物理材质 + 环境反射 + 菲涅尔边缘光 + 半色键）────
function BallAndStickModel({ atoms, bonds, quality }: { atoms: Atom[]; bonds: Bond[]; quality: QualityTier }) {
  const getAtomMat = useRoleMaterials('atom', atoms, quality);
  const getBondMat = useRoleMaterials('bond', atoms, quality);
  const gradientBondMat = useBondGradientMaterial(atoms, quality);
  const seg = SEGMENTS[quality];
  // 半色键：按两原子元素色沿键轴连续渐变（PyMOL 默认的专业观感）；低档退回单色键省顶点色开销
  const halfBonds = quality !== 'low';
  // 预计算键的几何信息。渐变键用「单根圆柱 + 顶点色」取代旧版「两段半键硬接」，
  // 消除中点颜色不连续接缝；两端顶点颜色取两端原子 CPK 色。
  const bondInfo = useMemo(() => {
    const result: Array<{
      key: string; mid: [number, number, number]; len: number;
      thickness: number; quaternion: THREE.Quaternion; color: string;
      gradient: boolean; colorB: string; geometry: THREE.CylinderGeometry | null;
    }> = [];
    const disposables: THREE.CylinderGeometry[] = [];
    bonds.forEach((b, index) => {
      if (!b) return;
      const a1 = atoms[b.start]; const a2 = atoms[b.end];
      if (!a1 || !a2) return;
      const dx = a2.x - a1.x, dy = a2.y - a1.y, dz = a2.z - a1.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!(len > 0.01) || !Number.isFinite(len)) return;
      // 键径来自共享常量：单 0.055 / 双 ×1.2 / 三 ×1.45
      const thickness = bondRadiusWorld(b.type, 'ball-stick');
      // 圆柱默认沿 +Y 轴，需四元数旋转对齐到键方向（否则所有键都竖直渲染）
      const bondDir = new THREE.Vector3(dx / len, dy / len, dz / len);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bondDir);
      const c1 = cpkColor(a1.element); const c2 = cpkColor(a2.element);
      if (halfBonds && c1 !== c2) {
        // 单根全键 + 顶点色渐变：颜色从 a1(CPK) 连续过渡到 a2(CPK)，无中点接缝。
        // 圆柱端点位于两球心（len 全长），端盖完全埋入球体内部 → 与球面无缝衔接。
        const geometry = new THREE.CylinderGeometry(thickness, thickness, len, seg.bond, 1, false);
        buildBondColorAttribute(geometry, c1, c2);
        disposables.push(geometry);
        result.push({
          key: `${b.start}-${b.end}-${index}`,
          mid: [(a1.x + a2.x) / 2, (a1.y + a2.y) / 2, (a1.z + a2.z) / 2],
          len, thickness, quaternion, color: c1,
          gradient: true, colorB: c2, geometry,
        });
      } else {
        result.push({
          key: `${b.start}-${b.end}-${index}`,
          mid: [(a1.x + a2.x) / 2, (a1.y + a2.y) / 2, (a1.z + a2.z) / 2],
          len, thickness, quaternion, color: c1,
          gradient: false, colorB: c1, geometry: null,
        });
      }
    });
    return { result, disposables };
  }, [atoms, bonds, halfBonds, seg.bond]);

  // 渐变几何体是 memo 里 new 出来的，卸载/重建时统一 dispose 防泄漏
  useEffect(() => {
    return () => { bondInfo.disposables.forEach((g) => g.dispose()); };
  }, [bondInfo]);

  return (
    <group>
      {/* 原子：球径 = 范德华半径 × BALL_STICK_RADIUS_K（与软件路径同一常量）；材质带环境反射 + 边缘光 */}
      {atoms.map((atom, idx) => (
        <mesh
          key={`a-${idx}`}
          position={[atom.x, atom.y, atom.z]}
          material={getAtomMat(cpkColor(atom.element))}
        >
          <sphereGeometry args={[atomWorldRadius(atom.element, 'ball-stick'), seg.atom, seg.atom]} />
        </mesh>
      ))}
      {/* 键：半色键用单根圆柱 + 顶点色连续渐变（无缝）；单色键沿用元素色材质 */}
      {bondInfo.result.map((b) => (
        b.gradient ? (
          <mesh
            key={b.key}
            position={b.mid}
            quaternion={b.quaternion}
            geometry={b.geometry!}
            material={gradientBondMat!}
          />
        ) : (
          <mesh key={b.key} position={b.mid} quaternion={b.quaternion} material={getBondMat(b.color)}>
            <cylinderGeometry args={[b.thickness, b.thickness, b.len, seg.bond]} />
          </mesh>
        )
      ))}
    </group>
  );
}

// ─── 空间填充模型（光滑清漆球 + sheen 果冻感 + 边缘光） ─────────
function SpaceFillingModel({ atoms, quality }: { atoms: Atom[]; quality: QualityTier }) {
  const getMat = useRoleMaterials('spacefill', atoms, quality);
  const seg = SEGMENTS[quality].spacefill;
  return (
    <group>
      {atoms.map((atom, idx) => (
        <mesh
          key={`sf-${idx}`}
          position={[atom.x, atom.y, atom.z]}
          material={getMat(cpkColor(atom.element))}
        >
          <sphereGeometry args={[atomWorldRadius(atom.element, 'space-filling'), seg, seg]} />
        </mesh>
      ))}
    </group>
  );
}

// ─── 管线模型（元素色半色管 + 清漆 + 边缘光，不再单调塑料管） ────
function TubeModel({ atoms, bonds, quality }: { atoms: Atom[]; bonds: Bond[]; quality: QualityTier }) {
  const getAtomMat = useRoleMaterials('tubeatom', atoms, quality);
  const getBondMat = useRoleMaterials('bond', atoms, quality);
  const gradientBondMat = useBondGradientMaterial(atoms, quality);
  const seg = SEGMENTS[quality];
  const halfBonds = quality !== 'low';
  // 渐变键几何：单根圆柱 + 顶点色沿骨架连续渐变（取代旧版两段半色管在中点硬接）
  const tubeBondInfo = useMemo(() => {
    const items: Array<{ key: string; mid: [number, number, number]; quaternion: THREE.Quaternion; geometry: THREE.CylinderGeometry; color: string; len: number }> = [];
    const disposables: THREE.CylinderGeometry[] = [];
    bonds.forEach((bond, idx) => {
      if (!bond) return;
      const a1 = atoms[bond.start]; const a2 = atoms[bond.end];
      if (!a1 || !a2) return;
      const dx = a2.x - a1.x, dy = a2.y - a1.y, dz = a2.z - a1.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (!(len > 0.01) || !Number.isFinite(len)) return;
      const bondDir = new THREE.Vector3(dx / len, dy / len, dz / len);
      const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), bondDir);
      const c1 = cpkColor(a1.element); const c2 = cpkColor(a2.element);
      if (halfBonds && c1 !== c2) {
        const geometry = new THREE.CylinderGeometry(BOND_RADIUS_TUBE, BOND_RADIUS_TUBE, len, seg.bond, 1, false);
        buildBondColorAttribute(geometry, c1, c2);
        disposables.push(geometry);
        items.push({
          key: `t-b-${idx}`,
          mid: [(a1.x + a2.x) / 2, (a1.y + a2.y) / 2, (a1.z + a2.z) / 2],
          quaternion, geometry, color: c1, len,
        });
      } else {
        items.push({
          key: `t-b-${idx}`,
          mid: [(a1.x + a2.x) / 2, (a1.y + a2.y) / 2, (a1.z + a2.z) / 2],
          quaternion, geometry: null as unknown as THREE.CylinderGeometry, color: c1, len,
        });
      }
    });
    return { items, disposables };
  }, [atoms, bonds, halfBonds, seg.bond]);

  useEffect(() => {
    return () => { tubeBondInfo.disposables.forEach((g) => g.dispose()); };
  }, [tubeBondInfo]);

  return (
    <group>
      {atoms.map((atom, idx) => (
        <mesh
          key={`t-a-${idx}`}
          position={[atom.x, atom.y, atom.z]}
          material={getAtomMat(cpkColor(atom.element))}
        >
          <sphereGeometry args={[atomWorldRadius(atom.element, 'tube'), seg.tubeatom, seg.tubeatom]} />
        </mesh>
      ))}
      {tubeBondInfo.items.map((b) => (
        b.geometry ? (
          <mesh key={b.key} position={b.mid} quaternion={b.quaternion} geometry={b.geometry} material={gradientBondMat!} />
        ) : (
          <mesh key={b.key} position={b.mid} quaternion={b.quaternion} material={getBondMat(b.color)}>
            <cylinderGeometry args={[BOND_RADIUS_TUBE, BOND_RADIUS_TUBE, b.len, seg.bond]} />
          </mesh>
        )
      ))}
    </group>
  );
}

// ─── WebGL 导出：同帧读取，不长期开 preserveDrawingBuffer ────────
/**
 * 导出当前 WebGL 帧。
 * 不允许长期开 preserveDrawingBuffer（会显著降低性能），因此：
 *   1) 点击时主动 gl.render(scene, camera)，在同一任务内读回帧缓冲；
 *   2) 优先 canvas.toDataURL（同帧有效）；
 *   3) 驱动拒绝读回时退回 gl.readPixels → 2D canvas（注意 Y 轴翻转）再导出。
 * 返回 null 表示两条路都失败（由调用方给出「导出失败」提示）。
 */
function exportWebGLFrame(
  gl: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
): string | null {
  try {
    const canvas = gl.domElement;
    if (!canvas || canvas.width < 2 || canvas.height < 2) return null;
    gl.render(scene, camera); // 显式渲染：保证帧缓冲内容是「此刻」的画面

    try {
      const direct = canvas.toDataURL('image/png');
      if (direct && direct.startsWith('data:image/png') && direct.length > 1024) return direct;
    } catch {
      // 某些驱动/隐私策略禁止从 WebGL 画布直接取像素，继续走 readPixels
    }

    const raw = gl.getContext();
    const w = canvas.width;
    const h = canvas.height;
    const pixels = new Uint8Array(w * h * 4);
    raw.readPixels(0, 0, w, h, raw.RGBA, raw.UNSIGNED_BYTE, pixels);

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return null;
    const img = ctx.createImageData(w, h);
    const row = w * 4;
    for (let y = 0; y < h; y++) {
      // WebGL 原点在左下，ImageData 原点在左上 → 逐行翻转
      const src = (h - 1 - y) * row;
      img.data.set(pixels.subarray(src, src + row), y * row);
    }
    ctx.putImageData(img, 0, 0);
    return out.toDataURL('image/png');
  } catch (err) {
    logger.warn('[MoleculeViewer3D] WebGL 帧导出失败', err as Error);
    return null;
  }
}

/** 触发浏览器下载（data URL）。返回是否成功触发。 */
function downloadDataUrl(dataUrl: string, filename: string): boolean {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return false;
  try {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return true;
  } catch (err) {
    logger.warn('[MoleculeViewer3D] PNG 下载触发失败', err as Error);
    return false;
  }
}

// ─── Canvas2D 软件渲染降级（无 WebGL 时仍能画出体面的分子）────────
// 与 WebGL 路径使用同一相机模型：透视投影（fov 45°，距离由 computeFramedCameraDistance
// 按「投影跨度 78% 短边」反解）、同一主轴定向、同一组球径/键径常量。
// 观感对齐 WebGL 那版：双光源四段着色（亮面/过渡/暗面/暗边）+ 小范围径向高光 +
// 原子间接触遮蔽（O(n) 单遍底圈）+ 主/次透视网格地面 + 星点深空背景 + 双色圆柱键，
// 双键/三键为真正的平行多线。交互：拖拽旋转、滚轮缩放；
// 只在交互/数据变化/自动旋转时重绘（无常驻 rAF 循环），逐帧几乎零对象/字符串分配。
const TAU = Math.PI * 2;
// 双光源近似：主光在左上偏前（亮面/高光偏左上），辅光在右下
// （暗部向冷环境色靠，暗边再掺一点暖反光）→ 亮面/过渡/暗面/暗边四段
const SOFT_AMBIENT = '#16233c';
const SOFT_WARM_BOUNCE = '#2a1e18';

/** 一次投影的输出（复用同一个可变对象，避免逐帧产生上千个小对象） */
interface Projected {
  sx: number; sy: number; px: number; depth: number; visible: boolean;
}

/** 单颗原子的分段配色（按「颜色 + 深度档」缓存字符串，逐帧不再拼色产生垃圾） */
interface SpherePalette {
  flat: string;   // 极小原子的平涂色
  contact: string; // 接触遮蔽底圈（低档回退用；中/高档走 sprite）
}

// ── 星点：固定种子的线性同余伪随机，模块加载时生成一次（静态、不闪烁、不参与逐帧随机）
//    数量 ≤ 120、亮度极低，只提供空间氛围，不干扰分子可读性。
const STAR_COUNT = 120;
const STAR_FIELD: Float32Array = (() => {
  const arr = new Float32Array(STAR_COUNT * 4);
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < STAR_COUNT; i++) {
    arr[i * 4] = rnd();                   // x（0..1 归一化，与尺寸无关）
    arr[i * 4 + 1] = rnd() * 0.68;        // y：只落在上半部分，避开网格地面
    arr[i * 4 + 2] = 0.4 + rnd() * 0.9;   // 半径（CSS px）
    // 透明度压得极低（≤0.10）：星点只做氛围，亮度必须低于「墨迹」判定阈值（L=70），
    // 否则会被视觉回归当成分子本体，既污染指标也显得脏。
    arr[i * 4 + 3] = 0.03 + rnd() * 0.07; // 透明度
  }
  return arr;
})();

// 深度档：从 12 提到 24。档差越小，相邻深度原子之间的雾/高光跳变越小，
// 进一步消除「原子之间」的色阶（此前 12 档时相邻档雾差 ≈ 4.2%，肉眼可辨）。
const DEPTH_BUCKETS = 24;
function depthBucket(t: number): number {
  return Math.min(DEPTH_BUCKETS - 1, Math.max(0, Math.round(t * (DEPTH_BUCKETS - 1))));
}

// 每种 CPK 颜色一份「24 档深度配色」数组：Map 的 key 直接用 CPK 里的常量字符串（引用不变），
// 因此逐帧查表不产生任何新生字符串；bond 只有一种颜色，用定长数组即可。
const spherePaletteCache = new Map<string, Array<SpherePalette | undefined>>();
const bondPaletteSlots: Array<{ base: string; core: string } | undefined> = new Array(DEPTH_BUCKETS);

/**
 * 极小原子平涂色 + 低档接触遮蔽底圈（仅这两个仍需离散色）。
 * 原本体渐变的 core/lit/mid/shadow/rim/spec/outline 离散色已废弃——改由
 * buildSphereGradient 用「连续光照函数 + 9 stop」一次生成，见下。
 */
function makeSpherePalette(color: string, bucket: number): SpherePalette {
  const tt = bucket / (DEPTH_BUCKETS - 1);
  // 与 buildSphereGradient 同一条 smoothstep 雾曲线（近实远虚），保持平涂/渐变两路一致
  const fogged = mixColor(color, SOFT_FOG, 0.46 * fogAmount(tt));
  return {
    flat: mixColor(fogged, '#ffffff', 0.1),
    contact: `rgba(2,5,12,${(0.05 + 0.08 * (1 - tt)).toFixed(3)})`,
  };
}

/** 球体配色（现仅平涂/接触底圈）：纯函数（颜色 + 深度档），逐帧零分配 */
function spherePalette(color: string, t: number): SpherePalette {
  const bucket = depthBucket(t);
  let list = spherePaletteCache.get(color);
  if (!list) {
    list = new Array<SpherePalette | undefined>(DEPTH_BUCKETS);
    spherePaletteCache.set(color, list);
  }
  const hit = list[bucket];
  if (hit) return hit;
  const pal = makeSpherePalette(color, bucket);
  list[bucket] = pal;
  if (spherePaletteCache.size > 256) spherePaletteCache.clear(); // 异常颜色涌入时的保险
  return pal;
}

// ── 球体连续着色渐变缓存（治「原子上那层皮肤」的核心）────────────
// 旧版：5 个离散色 stop（core/lit/mid/shadow/rim）+ 独立高光 gradient + 独立硬边 outline
//       stroke，共 4 类可见边界叠成「皮肤/分层」。
// 新版：把体渐变 + 高光 + 暗边轮廓**合并进一条连续 radialGradient**，沿半径采样一个平滑
//       光照函数（亮脊→本色→暗面→暖反光→轮廓渐隐），相邻采样点亮度增量 <2/255，
//       无斜率突变 → 无同心色带、无硬边壳、无独立高光皮。按「颜色×深度档」缓存
//       已建好的 CanvasGradient 对象，同色同档原子逐帧零新建。
const sphereGradCache = new Map<string, Map<number, Array<CanvasGradient | undefined>>>();
// 渐变偏心焦点（主光来自左上前方）：与旧版 0.38/0.44 偏移一致，保证高光方向与 WebGL 对齐。
const SPHERE_GRAD_FX = 0.38, SPHERE_GRAD_FY = 0.44;

/**
 * 沿键轴的「端部淡出」渐变（治「拼接感」核心）：两端各留 fadeLen 过渡区，
 * 端点取球体边缘色调（偏暗、掺冷雾），向内过渡到键本色 → 键端不再被球轮廓硬切，
 * 而是「溶」进球体边缘，交界处亮度连续。仅中/高档调用。
 * e1/e2 是两端过渡长度占键长比例（0..1）；过渡区极短时收敛到键长中点，保证 stop 单调。
 */
function axialFadeStops(
  g: CanvasGradient, e1: number, e2: number,
  edge1: string, base: string, edge2: string,
): void {
  const a = clamp(e1, 0, 0.5);
  const b = clamp(e2, 0.5, 1);
  const lo = Math.min(a, b - 1e-3);
  const hi = Math.max(b, a + 1e-3);
  g.addColorStop(0, edge1);
  g.addColorStop(lo, base);
  g.addColorStop(hi, base);
  g.addColorStop(1, edge2);
}

/**
 * 构建一颗球的「连续着色」radialGradient（体渐变 + 高光 + 暗边轮廓三合一）。
 * 偏心焦点 = 主光方向（左上），渐变外半径略大于轮廓（1.045r）使最外档暗色在圆周外淡出，
 * 取代旧版硬边 outline stroke → 轮廓无单像素 alpha 突变。
 *
 * 平滑 ≠ 均匀（修 3d-visual-qa 回归）：早先为消色带把亮脊拉成了宽而平的 plateau，导致
 * 高光峰值掉到 L<210（门禁 high=0）且整体明暗跨度过小（coreStd<25）。这里改为——
 *   亮脊：受光基面 lit 再掺白造一个**集中且够亮**的尖峰（碳/氧全深度档 L>210），
 *         用 0→0.06→0.13→0.22→0.32 的密 stop 让峰值突出、两侧平滑下降（非硬边高光皮）。
 *   暗面：shadow/rim 明显加深，拉大「受光面→暗面」的亮度跨度 → coreStd≥25。
 * 全程仍是**单个**连续 gradient（Canvas 在 stop 间线性插值），不存在旧版多遍离散 fill 的
 * 硬边界 → 无同心色带（"皮肤"），但有明显明暗立体感 + 集中高光。
 *
 * 小原子高光可测（修 long 肽 space-filling/tube 高光 0%）：long 肽自动取景后原子屏幕半径
 * 很小，亮脊只有 1-2px 宽，抗锯齿把它和相邻暗面混合 → 实际峰值像素被拉到 L<210。因此
 * 亮脊宽度/峰值都**按屏幕半径 r 自适应**：r 越小，亮脊在渐变空间里相对越宽、峰值越接近白，
 * 保证至少几个纯亮像素；r 大时回收以免受光面大片过曝丢材质色。仍是单连续渐变、无硬边。
 */
/** 深度雾强度曲线：smoothstep(t) → 近处几乎不雾、远处雾得更狠，前后层次更分明（零成本，纯改配色）。 */
function fogAmount(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function buildSphereGradient(
  ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number, color: string, tt: number,
): CanvasGradient {
  const t01 = clamp(tt, 0, 1);
  // 小原子系数 small∈(0,1]：r≤6px → 1（最亮最宽），r≥26px → 0（大球回收，防过曝）。
  // 用平滑线性插值，避免半径微小变化引起亮脊跳变。
  const small = clamp((26 - r) / 20, 0, 1);
  // 深度雾后的本色（smoothstep 曲线：近实远虚）
  const fogged = mixColor(color, SOFT_FOG, 0.46 * fogAmount(t01));
  // 受光基面：本色整体提亮，作为亮脊与暗面之间的过渡基准
  const lit = mixColor(fogged, '#ffffff', 0.34 - 0.08 * t01);
  // 高光尖峰：受光基面再掺白 → 集中、够亮。小原子峰值更接近白（给抗锯齿混合留余量）。
  // 注意：hi 不得掺暖（次表面只进 terminator/暗边），否则会污染「高光 L>210」门禁。
  const hi = mixColor(lit, '#ffffff', 0.66 + 0.20 * small - 0.10 * t01);
  // 暗面（偏冷，明显加深 → 拉大 core 区域明暗跨度）
  const shadow = mixColor(shade(lit, -0.48), SOFT_AMBIENT, 0.30);
  // 暗边（偏暖，右下辅光反光，最深）
  const rim = mixColor(shade(lit, -0.68), SOFT_WARM_BOUNCE, 0.22);
  // 亮脊宽度随 small 增加：小原子亮脊在渐变空间里相对更宽 → 实际覆盖 2-3px 而非 1px 尖峰
  const w = 1 + 0.9 * small; // 亮脊 stop 位置的缩放系数（越大 → 亮脊越宽）
  const g = ctx.createRadialGradient(
    sx - r * SPHERE_GRAD_FX, sy - r * SPHERE_GRAD_FY, Math.max(0.15, r * 0.04),
    sx, sy, r * 1.045,
  );
  g.addColorStop(0.00, hi);
  g.addColorStop(Math.min(0.32, 0.06 * w), mixColor(hi, lit, 0.10));
  g.addColorStop(Math.min(0.42, 0.13 * w), mixColor(hi, lit, 0.28));
  g.addColorStop(Math.min(0.52, 0.22 * w), mixColor(hi, lit, 0.52));
  g.addColorStop(Math.min(0.62, 0.32 * w), mixColor(hi, lit, 0.80));
  // 次表面散射近似（治「塑料球」）：明暗交界的 terminator 带 + 暗面掺一点暖反照色，
  // 模拟光透过半透明材质在暗侧留暖色。只进过渡/暗面，绝不动 hi/lit 亮脊 → 守 L>210 与 coreStd≥25。
  g.addColorStop(0.74, mixColor(lit, SOFT_WARM_BOUNCE, 0.10));
  g.addColorStop(0.85, mixColor(mixColor(lit, shadow, 0.42), SOFT_WARM_BOUNCE, 0.18));
  g.addColorStop(0.94, mixColor(shadow, SOFT_WARM_BOUNCE, 0.12));
  g.addColorStop(1.00, mixColor(shadow, rim, 0.70));
  return g;
}

/**
 * 按颜色×深度档×粗半径档取缓存的球体渐变；未命中则构建并缓存（同色同档同径档原子逐帧复用同一对象）。
 * buildSphereGradient 的亮脊宽度/峰值现在随屏幕半径 r 自适应（小原子亮脊更宽更亮），
 * 因此缓存 key 必须带上半径档，否则「先入缓存的大原子渐变」会被同色小原子复用 → 小原子高光失效。
 * 半径分 3 档（≤9 / ≤22 / >22 px），既区分小原子高光、又不会让缓存爆炸（仍逐帧零新建）。
 */
const RADIUS_CACHE_BUCKETS = [9, 22] as const;
function radiusCacheBucket(r: number): number {
  return r <= RADIUS_CACHE_BUCKETS[0] ? 0 : r <= RADIUS_CACHE_BUCKETS[1] ? 1 : 2;
}
function sphereGradient(
  ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number, color: string, t: number,
): CanvasGradient {
  const bucket = depthBucket(t);
  const rb = radiusCacheBucket(r);
  let perRadius = sphereGradCache.get(color);
  if (!perRadius) {
    perRadius = new Map<number, Array<CanvasGradient | undefined>>();
    sphereGradCache.set(color, perRadius);
  }
  let list = perRadius.get(rb);
  if (!list) {
    list = new Array<CanvasGradient | undefined>(DEPTH_BUCKETS);
    perRadius.set(rb, list);
  }
  const hit = list[bucket];
  if (hit) return hit;
  const g = buildSphereGradient(ctx, sx, sy, r, color, bucket / (DEPTH_BUCKETS - 1));
  list[bucket] = g;
  if (sphereGradCache.size > 256) sphereGradCache.clear(); // 异常颜色涌入时的保险
  return g;
}


/** 键的配色（暗底 + 高光芯），按深度档缓存 */
function bondPalette(t: number): { base: string; core: string } {
  const bucket = depthBucket(t);
  const hit = bondPaletteSlots[bucket];
  if (hit) return hit;
  const tt = bucket / (DEPTH_BUCKETS - 1);
  const fogged = mixColor(BOND_COLOR, SOFT_FOG, 0.55 * tt);
  const pal = {
    base: shade(fogged, -0.28),
    core: hexToRgba('#9fb8e0', (1 - tt) * 0.42),
  };
  bondPaletteSlots[bucket] = pal;
  return pal;
}

// ─── 软件路径专业光照：屏幕空间 AO + 菲涅尔边缘光 + 偏光投影 ────
// 主光是「固定屏幕方向」的左上前方（与下方四段体渐变 / 高光的偏移方向一致），
// 因此所有方向性效果都能预渲染成 sprite / 用固定偏移公式，逐帧不做方向三角函数。
const SOFT_RIM_COLOR = '#9fc0ff';          // 冷色边缘光，与冷环境色 SOFT_AMBIENT 互补
const SHADOW_DIR_X = 0.65, SHADOW_DIR_Y = 0.76; // 投影偏移方向（右下，归一化后≈此值）

/**
 * AO 暗影渐变：圆心朝「遮挡方向 ⊕ 反光方向」偏移、半径受限于球内（off+rad≤r），
 * 因此暗影**只落在球体轮廓内**，绝不溢出到背景（不污染墨迹/包围盒统计）。
 * 中档 1 段、高档 2 段（内圈更深 + 外圈更宽的柔影）→ 多段柔和、无硬边。
 */
function fillAoGradient(
  ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number,
  occX: number, occY: number, occStr: number, layers: number,
): void {
  let dx = occX, dy = occY;
  const dl = Math.sqrt(dx * dx + dy * dy);
  if (dl > 1e-6) { dx /= dl; dy /= dl; } else { dx = 0; dy = 0; }
  // 叠加反光偏置 → 对称接触遮蔽升级为「背光侧偏移柔影」
  let bx = dx + SHADOW_DIR_X * 0.45, by = dy + SHADOW_DIR_Y * 0.45;
  const bl = Math.sqrt(bx * bx + by * by);
  if (bl > 1e-6) { bx /= bl; by /= bl; } else { bx = SHADOW_DIR_X; by = SHADOW_DIR_Y; }
  const layersCfg = layers >= 2
    ? [[0.40, 0.30], [0.60, 0.16]] as const
    : [[0.56, 0.32]] as const;
  for (let k = 0; k < layersCfg.length; k++) {
    const offK = r * layersCfg[k][0];
    const radK = r * layersCfg[k][1];
    const gx = sx + bx * offK, gy = sy + by * offK;
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, radK);
    g.addColorStop(0, `rgba(2,5,12,${(occStr * 0.62).toFixed(3)})`);
    g.addColorStop(0.55, `rgba(2,5,12,${(occStr * 0.26).toFixed(3)})`);
    g.addColorStop(1, 'rgba(2,5,12,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(gx, gy, radK, 0, TAU);
    ctx.fill();
  }
}

/**
 * 菲涅尔边缘光：径向渐变圆心向「主光侧」（左上）偏移 0.5r，使背光侧（右下）轮廓
 * 落入渐变外档冷色、向光侧落入透明档 → 只在背光轮廓出现一圈冷色 rim。
 * 渐变外半径 1.0r，完全在球内（不越轮廓、亮度 < L=70 不入背景）。
 */
function fillRimGradient(ctx: CanvasRenderingContext2D, sx: number, sy: number, r: number, a: number): void {
  const gx = sx - r * 0.5, gy = sy - r * 0.5;
  const g = ctx.createRadialGradient(gx, gy, r * 0.3, gx, gy, r);
  g.addColorStop(0, 'rgba(159,192,255,0)');
  g.addColorStop(0.62, `rgba(159,192,255,${(a * 0.28).toFixed(3)})`);
  g.addColorStop(1, `rgba(159,192,255,${a.toFixed(3)})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, TAU);
  ctx.fill();
}

/**
 * 预渲染一块「接触遮蔽柔环」sprite（透明中心 + 极淡宽峰 + 向外缓慢淡出），
 * 逐原子一次 drawImage 取代旧版硬边 flat 暗圈 → 柔和多段、无硬边。
 * 治「外圈暗环/接缝」：峰值 alpha 0.16→0.07、峰值半径 1.07R→1.12R、淡出范围拉宽到 1.55R，
 * 使它从「一圈可辨暗环」退化为「宽而极淡的柔晕」，键与球衔接处不再压出暗接缝。
 * sprite 画布边长 = 3.2R，绘制时按 dpr 缩放，几何与分辨率解耦。
 */
function buildContactRingSprite(): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined') return null;
    const R = 48;
    const size = Math.ceil(R * 3.2);
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const c = off.getContext('2d');
    if (!c) return null;
    const cxp = size / 2, cyp = size / 2;
    const g = c.createRadialGradient(cxp, cyp, R * 0.90, cxp, cyp, R * 1.55);
    g.addColorStop(0, 'rgba(2,5,12,0)');
    g.addColorStop(0.30, 'rgba(2,5,12,0.05)');
    g.addColorStop(0.46, 'rgba(2,5,12,0.07)');   // 极淡宽峰
    g.addColorStop(0.72, 'rgba(2,5,12,0.04)');
    g.addColorStop(1, 'rgba(2,5,12,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return off;
  } catch {
    return null;
  }
}

// ─── 球面「三点布光」补光 sprite（治「只有一盏灯」主因）──────────
// 主光在左上（buildSphereGradient 偏心焦点），这里补一盏**冷色环境补光**从正下略偏方向
// 提起暗面（对齐 WebGL 的 fill 方向光 [-6,4,-4]#8ab4ff + hemisphere ground）。逐原子一次
// drawImage 取代「逐帧新建 gradient」，且构建时 clip 在球轮廓内 → 只提亮球面暗侧，绝不溢到背景。
function buildFillLightSprite(): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined') return null;
    const R = 48;
    const size = R * 2;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const c = off.getContext('2d');
    if (!c) return null;
    const cxp = R, cyp = R;
    c.beginPath();
    c.arc(cxp, cyp, R, 0, TAU);
    c.clip(); // 补光严格落在轮廓内，外圈透明、不撑 bbox
    // 圆心向正下方偏移 0.30R：暗面（下半）落入渐变中段被提亮，受光面（上半）落在透明档不受影响
    const g = c.createRadialGradient(cxp, cyp + R * 0.30, R * 0.10, cxp, cyp + R * 0.30, R * 0.95);
    g.addColorStop(0, 'rgba(130,158,205,0)');
    g.addColorStop(0.45, 'rgba(130,158,205,0.09)');
    g.addColorStop(0.72, 'rgba(130,158,205,0.15)'); // 暗面补光次峰（克制，守 coreStd≥25）
    g.addColorStop(0.90, 'rgba(130,158,205,0.06)');
    g.addColorStop(1, 'rgba(130,158,205,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return off;
  } catch {
    return null;
  }
}

// ─── 菲涅尔边缘 sprite（边缘物理暗化 + 冷 rim，取代逐帧 fillRimGradient）────
// 两层：内层「边缘暗化带」（菲涅尔全反射前的一圈变暗）+ 外层冷 rim。预渲染 clip 圆内，
// 逐帧用 globalAlpha 做深度衰减（保留原有随深度衰减的观感），省掉每原子每帧新建 gradient。
function buildRimSprite(): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined') return null;
    const R = 48;
    const size = R * 2;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const c = off.getContext('2d');
    if (!c) return null;
    const cxp = R, cyp = R;
    c.beginPath();
    c.arc(cxp, cyp, R, 0, TAU);
    c.clip();
    // 圆心向主光侧（左上）偏移 0.5R → 冷 rim 只落在背光侧（右下）轮廓，与旧 fillRimGradient 同向
    const gx = cxp - R * 0.5, gy = cyp - R * 0.5;
    // ① 边缘物理暗化带：靠轮廓一圈极淡暗（先暗）
    const dark = c.createRadialGradient(gx, gy, R * 0.72, gx, gy, R * 1.0);
    dark.addColorStop(0, 'rgba(2,5,12,0)');
    dark.addColorStop(0.7, 'rgba(2,5,12,0.10)');
    dark.addColorStop(1, 'rgba(2,5,12,0.26)');
    c.fillStyle = dark;
    c.fillRect(0, 0, size, size);
    // ② 冷色 rim：紧贴背光侧轮廓一圈冷光（后亮），叠加在暗化带之上
    const rim = c.createRadialGradient(gx, gy, R * 0.30, gx, gy, R * 1.0);
    rim.addColorStop(0, 'rgba(159,192,255,0)');
    rim.addColorStop(0.62, 'rgba(159,192,255,0.16)');
    rim.addColorStop(1, 'rgba(159,192,255,0.55)');
    c.fillStyle = rim;
    c.fillRect(0, 0, size, size);
    return off;
  } catch {
    return null;
  }
}

// ─── 地面落影 sprite（治「分子浮在网格上」）────────────────────
// 分子投在地面上的整体柔影：中心 alpha 压得很低（画在本体之前、叠在背景/网格上只做压暗），
// 绝不会把地面抬到 L>70（只会更暗），不撑 bbox。
function buildGroundShadowSprite(): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined') return null;
    const R = 48;
    const size = R * 2;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const c = off.getContext('2d');
    if (!c) return null;
    const cxp = R, cyp = R;
    const g = c.createRadialGradient(cxp, cyp, 0, cxp, cyp, R);
    g.addColorStop(0, 'rgba(2,5,12,0.20)');
    g.addColorStop(0.45, 'rgba(2,5,12,0.13)');
    g.addColorStop(1, 'rgba(2,5,12,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    return off;
  } catch {
    return null;
  }
}

/** 屏幕空间均匀网格：把原子按屏幕坐标分桶，AO 邻居查询只扫 3×3 cell（避免 O(n²) 全对）。 */
interface SoftGrid {
  cell: number; cols: number; rows: number;
  cellStart: Int32Array; cellCount: Int32Array; items: Int32Array;
}
const softGridRef: { grid: SoftGrid | null } = { grid: null };

function softBuildGrid(
  sx: Float32Array, sy: Float32Array, r: Float32Array, n: number, w: number, h: number,
): SoftGrid | null {
  if (n <= 0) return null;
  const tmp: number[] = [];
  for (let i = 0; i < n; i++) if (r[i] > 0) tmp.push(r[i]);
  if (tmp.length === 0) return null;
  tmp.sort((a, b) => a - b);
  const med = tmp[tmp.length >> 1];
  const cell = clamp(med * 1.15, 6, 64);
  const cols = Math.max(1, Math.ceil(w / cell) + 1);
  const rows = Math.max(1, Math.ceil(h / cell) + 1);
  const nc = cols * rows;
  let g = softGridRef.grid;
  if (!g || g.cellStart.length < nc || g.items.length < n) {
    g = { cell, cols, rows, cellStart: new Int32Array(nc + 1), cellCount: new Int32Array(nc), items: new Int32Array(n) };
    softGridRef.grid = g;
  }
  g.cell = cell; g.cols = cols; g.rows = rows;
  const cnt = g.cellCount, st = g.cellStart, items = g.items;
  cnt.fill(0);
  const cxy = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    if (r[i] <= 0) { cxy[i] = -1; continue; }
    const gx = Math.min(cols - 1, Math.max(0, Math.floor(sx[i] / cell)));
    const gy = Math.min(rows - 1, Math.max(0, Math.floor(sy[i] / cell)));
    const c = gy * cols + gx;
    cxy[i] = c;
    cnt[c]++;
  }
  let acc = 0;
  for (let c = 0; c < nc; c++) { st[c] = acc; acc += cnt[c]; }
  st[nc] = acc;
  const cursor = new Int32Array(nc);
  for (let i = 0; i < n; i++) {
    const c = cxy[i];
    if (c < 0) continue;
    items[st[c] + cursor[c]++] = i;
  }
  return g;
}

/** 圆盘重叠量（0..1）：以较近球（遮挡者 j）的直径为分母，忽略 <0.04 的微接触。 */
function softOverlapWeight(d: number, ri: number, rj: number): number {
  const w = (ri + rj - d) / (2 * rj);
  return w > 0.04 ? Math.min(1, w) : 0;
}

/**
 * 邻居预遍：对每个原子累积「更近镜头且屏幕重叠」的遮挡向量 + 强度。
 * 复杂度 O(n·k)（k=3×3 cell 内平均原子数，实测个位数），327 原子≈几千次距离判断，非 O(n²)。
 * 只统计 depth_j < depth_i（j 更近、会盖在 i 上）的对 → 正是 AO/投影的物理来源。
 */
function softAccumulateOcclusion(
  sx: Float32Array, sy: Float32Array, r: Float32Array, depth: Float32Array,
  n: number, grid: SoftGrid, occX: Float32Array, occY: Float32Array, occStr: Float32Array,
): void {
  const { cell, cols, rows, cellStart, items } = grid;
  for (let i = 0; i < n; i++) {
    occX[i] = 0; occY[i] = 0; occStr[i] = 0;
    const ri = r[i];
    if (ri <= 0) continue;
    const di = depth[i];
    const cxi = Math.min(cols - 1, Math.max(0, Math.floor(sx[i] / cell)));
    const cyi = Math.min(rows - 1, Math.max(0, Math.floor(sy[i] / cell)));
    let ax = 0, ay = 0, aStr = 0;
    for (let gy = Math.max(0, cyi - 1); gy <= Math.min(rows - 1, cyi + 1); gy++) {
      const rowBase = gy * cols;
      for (let gx = Math.max(0, cxi - 1); gx <= Math.min(cols - 1, cxi + 1); gx++) {
        const c = rowBase + gx;
        for (let p = cellStart[c]; p < cellStart[c + 1]; p++) {
          const j = items[p];
          if (j === i || depth[j] >= di) continue; // 只保留更近镜头的遮挡者
          const dx = sx[j] - sx[i], dy = sy[j] - sy[i];
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d >= ri + r[j]) continue; // 屏幕圆盘不重叠
          const wj = softOverlapWeight(d, ri, r[j]);
          if (wj <= 0) continue;
          const inv = d > 1e-6 ? 1 / d : 0;
          ax += dx * inv * wj; ay += dy * inv * wj;
          aStr += wj;
        }
      }
    }
    occX[i] = ax; occY[i] = ay;
    occStr[i] = Math.min(1, aStr * 0.9);
  }
}

/**
 * 细描边对齐到设备像素网格，避免 1px 线发虚。
 * 只用于描边端点（网格等），原子/键的几何坐标一律不取整——否则拖拽旋转会整像素跳变。
 */
function snapStrokes(v: number, dpr: number, lineWidthCss: number): number {
  const dev = v * dpr;
  const wDev = lineWidthCss * dpr;
  const odd = Math.round(wDev) % 2 === 1;
  return (odd ? Math.round(dev) + 0.5 : Math.round(dev)) / dpr;
}

/**
 * 静态背景层（深空径向渐变 + 星点）预渲染到离屏画布：逐帧只有一次 drawImage，
 * 省掉每帧一次全屏渐变填充（327 原子时这是最贵的固定成本之一）。
 * 尺寸/DPR 变化时由调用方按 key 重建（复用同一块画布，避免反复分配）；失败返回 null。
 */
function buildBackdrop(w: number, h: number, dpr: number, reuse?: HTMLCanvasElement | null): HTMLCanvasElement | null {
  try {
    if (typeof document === 'undefined') return null;
    const off = reuse ?? document.createElement('canvas');
    off.width = Math.max(1, Math.round(w * dpr));
    off.height = Math.max(1, Math.round(h * dpr));
    const c = off.getContext('2d');
    if (!c) return null;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = c.createRadialGradient(
      w * 0.5, h * 0.44, Math.min(w, h) * 0.04,
      w * 0.5, h * 0.52, Math.max(w, h) * 0.78,
    );
    bg.addColorStop(0, SOFT_BG_INNER);
    bg.addColorStop(0.55, SOFT_BG_MID);
    bg.addColorStop(1, SOFT_BG_OUTER);
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < STAR_COUNT; i++) {
      const x = STAR_FIELD[i * 4] * w;
      const y = STAR_FIELD[i * 4 + 1] * h;
      const r = STAR_FIELD[i * 4 + 2];
      const a = STAR_FIELD[i * 4 + 3];
      if (r <= 0.05 || a <= 0.01) continue;
      c.fillStyle = `rgba(214,228,255,${a.toFixed(2)})`;
      c.beginPath();
      c.arc(x, y, r, 0, TAU);
      c.fill();
    }
    // 地面「光池」：对齐 WebGL GridFloor 的辉光平面（getFloorGlowTexture），让分子有「落在被照亮的
    // 舞台上」的依托。圆心在画面下部中央、alpha 压到 ≤0.08 → 地面合成后 L 仍 <70（守墨迹门禁），
    // 只做氛围不做亮块。烘在离屏背景层，逐帧零额外成本。
    const pool = c.createRadialGradient(
      w * 0.5, h * 0.70, 0,
      w * 0.5, h * 0.70, Math.min(w, h) * 0.52,
    );
    pool.addColorStop(0, 'rgba(46,82,150,0.08)');
    pool.addColorStop(0.5, 'rgba(30,56,104,0.04)');
    pool.addColorStop(1, 'rgba(4,8,18,0)');
    c.fillStyle = pool;
    c.fillRect(0, 0, w, h);
    // vignette 暗角：经典摄影聚焦手法，中心（分子所在）完全透明、四角压暗 → 视线聚向中心。
    // 只压四角，不动中心分子区（不会把分子压进 coreStd 门禁），且是压暗操作、绝不抬亮背景。
    const vig = c.createRadialGradient(
      w * 0.5, h * 0.46, Math.min(w, h) * 0.45,
      w * 0.5, h * 0.46, Math.max(w, h) * 0.75,
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(0.55, 'rgba(0,0,0,0.10)');
    vig.addColorStop(1, 'rgba(0,0,0,0.30)');
    c.fillStyle = vig;
    c.fillRect(0, 0, w, h);
    return off;
  } catch {
    return null;
  }
}

function SoftwareMoleculeCanvas({
  atoms, bonds, renderingMode, fit, basis, autoRotate, resetSignal, onRegisterApi, quality,
  annotationLevel, structureLabels, labelScreenRef, atomScreenRef, onHoverAtomChange, onRegisterHitTest,
}: {
  atoms: Atom[]; bonds: Bond[];
  renderingMode: RenderingMode;
  fit: MoleculeFit | null;
  basis: number[] | null;
  autoRotate: boolean;
  resetSignal: number;
  onRegisterApi: (api: ViewerApi | null) => void;
  quality: QualityTier;
  /** 标注档位：off 不投影；residue/atom 才逐帧算标签屏幕坐标（写 DOM 覆盖层，不动 canvas 像素） */
  annotationLevel: AnnotationLevel;
  structureLabels: StructureLabel[];
  /** 标签屏幕坐标输出（draw 阶段写入，DOM 覆盖层 rAF 读取） */
  labelScreenRef: React.MutableRefObject<Map<string, LabelScreenPos>>;
  /** 每原子屏幕坐标+半径（draw 阶段写入，供 hover 命中测试） */
  atomScreenRef: React.MutableRefObject<Map<number, { x: number; y: number; r: number }>>;
  onHoverAtomChange: (idx: number | null) => void;
  onRegisterHitTest: (fn: ((clientX: number, clientY: number) => number | null) | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 初始视角：先由主轴分析把分子「铺开」（见 computeCanonicalBasis），再叠一点俯仰让立体感出来
  const viewRef = useRef({ yaw: DEFAULT_VIEW_YAW, pitch: DEFAULT_VIEW_PITCH, scale: 1 });
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  // 静态背景层缓存（尺寸/DPR 变化时按 key 重建）
  const bgRef = useRef<{ key: string; canvas: HTMLCanvasElement } | null>(null);
  // 离屏画布不可用（无 2D 上下文）时置位，之后不再逐帧重试创建
  const bgUnavailableRef = useRef(false);
  // 接触遮蔽柔环 sprite（按 dpr 缓存；构建失败则回退旧版 flat 暗圈）
  const ringSpriteRef = useRef<{ dpr: number; canvas: HTMLCanvasElement } | null>(null);
  const ringUnavailableRef = useRef(false);
  // 球面补光 / 菲涅尔边缘 / 地面落影 sprite（按 dpr 缓存；构建失败则永久回退对应逐帧项）
  const fillSpriteRef = useRef<{ dpr: number; canvas: HTMLCanvasElement } | null>(null);
  const fillUnavailableRef = useRef(false);
  const rimSpriteRef = useRef<{ dpr: number; canvas: HTMLCanvasElement } | null>(null);
  const rimUnavailableRef = useRef(false);
  const shadowSpriteRef = useRef<{ dpr: number; canvas: HTMLCanvasElement } | null>(null);
  const shadowUnavailableRef = useRef(false);
  // 帧时采样 + 自动降级：demand 模式只在真正出帧时累积样本， avg>19ms 降一级、>24ms 降两级。
  // level: 2=全开（地面落影+补光）/ 1=关地面落影、补光仅大原子 / 0=仅保留零成本项。用 ref 承载，不触发重渲染。
  const softPerfRef = useRef<{ samples: number[]; last: number; level: number }>({ samples: [], last: 0, level: 2 });
  // 每原子遮挡量缓冲（AO/投影）：随原子数扩容一次后复用，逐帧零新数组
  const occRef = useRef({
    x: new Float32Array(0), y: new Float32Array(0), str: new Float32Array(0),
  });
  // 画质档位 → 软件路径各特性的开关（与 WebGL 共用同一个 quality prop）
  const qMed = quality !== 'low';
  const qHigh = quality === 'high';
  const useSoftAO = qMed;        // 屏幕空间 AO + 偏光投影（中/高档）
  const useRim = qMed;           // 菲涅尔冷色边缘光（中/高档）
  const useCylinderBond = qMed;  // 键的圆柱光影 + 键端衔接 AO（中/高档）
  const aoLayers = qHigh ? 2 : 1;
  // 新增细节档位：地面落影 high 专属（成本最高），球面补光中/高档。实际还会被帧时降级进一步收紧。
  const baseDetailLevel = qHigh ? 2 : qMed ? 1 : 0;
  // 投影缓冲：按原子数扩容一次后长期复用 → 逐帧不再新建数组（327 原子时省下 300+ 个临时对象）
  const bufRef = useRef({
    sx: new Float32Array(0), sy: new Float32Array(0),
    r: new Float32Array(0), t: new Float32Array(0),
    depth: new Float32Array(0), px: new Float32Array(0),
    wx: new Float32Array(0), wy: new Float32Array(0), wz: new Float32Array(0),
    order: [] as number[],
  });
  // 两个复用的投影输出对象（p1/p2 需要同时存活，故各一份；draw 同步执行，无并发风险）
  const scratchRef = useRef<{ a: Projected; b: Projected }>({
    a: { sx: 0, sy: 0, px: 0, depth: 1, visible: false },
    b: { sx: 0, sy: 0, px: 0, depth: 1, visible: false },
  });
  const rafRef = useRef<number | null>(null);
  const autoRafRef = useRef<number | null>(null);
  // 取景距离缓存：二分求解只依赖「尺寸 / 模式 / 原子 / 朝向矩阵」，用户拖拽旋转不改变它，
  // 因此每帧复用，不在 rAF 循环里重复求解。
  const camRef = useRef<{
    w: number; h: number; mode: RenderingMode; atoms: Atom[]; basis: number[] | null; value: number;
  } | null>(null);

  // 绘制一帧
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !fit || atoms.length === 0) return;
    try {
      const { w, h, dpr } = sizeRef.current;
      if (w <= 0 || h <= 0) return;
      const { yaw, pitch, scale } = viewRef.current;
      const viewScale = Number.isFinite(scale) ? clamp(scale, VIEW_SCALE_MIN, VIEW_SCALE_MAX) : 1;

      // 帧时采样起点：覆盖整帧绘制（含背景/网格/键/原子）。demand 模式只在实际出帧时累积。
      const frameStart = qMed ? performance.now() : 0;
      // 细节档位 = 画质档基准，被帧时降级进一步收紧（降级只在后续帧生效，不打断本帧）。
      const detailLevel = Math.min(baseDetailLevel, softPerfRef.current.level);
      const useFillLight = qMed && detailLevel >= 1;   // 球面补光：中/高档
      const fillLargeOnly = detailLevel === 1;         // 降级一档后：补光仅 r≥6px 的较大原子
      const useFloorShadow = qHigh && detailLevel >= 2; // 地面落影：high 档且未降级

      // ── 背景：深空径向渐变 + 固定种子星点。整层预渲染在离屏画布，逐帧只有一次 drawImage，
      //    省掉每帧一次全屏渐变填充（这是最贵的固定成本之一）。
      const bgKey = `${w}x${h}@${dpr}`;
      let backdrop = bgRef.current && bgRef.current.key === bgKey ? bgRef.current.canvas : null;
      if (!backdrop && !bgUnavailableRef.current) {
        // 复用同一块离屏画布（尺寸变化时只改 width/height 再重绘），避免频繁 resize 时反复分配
        const built = buildBackdrop(w, h, dpr, bgRef.current ? bgRef.current.canvas : null);
        if (built) {
          bgRef.current = { key: bgKey, canvas: built };
          backdrop = built;
        } else {
          bgRef.current = null;
          bgUnavailableRef.current = true; // 不再逐帧重试，直接走下面的逐帧渐变兜底
        }
      }
      if (backdrop) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(backdrop, 0, 0);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else {
        // 兜底：离屏画布不可用的受限环境里退回逐帧渐变（无星点，但不影响可读性）
        const bg = ctx.createRadialGradient(
          w * 0.5, h * 0.44, Math.min(w, h) * 0.04,
          w * 0.5, h * 0.52, Math.max(w, h) * 0.78,
        );
        bg.addColorStop(0, SOFT_BG_INNER);
        bg.addColorStop(0.55, SOFT_BG_MID);
        bg.addColorStop(1, SOFT_BG_OUTER);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
      }

      // ── 接触遮蔽柔环 sprite：按 dpr 惰性构建一次（失败则永久回退 flat 暗圈）
      if (qMed && !ringSpriteRef.current && !ringUnavailableRef.current) {
        const spr = buildContactRingSprite();
        if (spr) ringSpriteRef.current = { dpr, canvas: spr };
        else ringUnavailableRef.current = true;
      }

      // ── 球面补光 / 菲涅尔边缘 / 地面落影 sprite：按 dpr 惰性构建一次（失败永久回退）
      if (useFillLight && !fillSpriteRef.current && !fillUnavailableRef.current) {
        const spr = buildFillLightSprite();
        if (spr) fillSpriteRef.current = { dpr, canvas: spr };
        else fillUnavailableRef.current = true;
      }
      if (useRim && !rimSpriteRef.current && !rimUnavailableRef.current) {
        const spr = buildRimSprite();
        if (spr) rimSpriteRef.current = { dpr, canvas: spr };
        else rimUnavailableRef.current = true;
      }
      if (useFloorShadow && !shadowSpriteRef.current && !shadowUnavailableRef.current) {
        const spr = buildGroundShadowSprite();
        if (spr) shadowSpriteRef.current = { dpr, canvas: spr };
        else shadowUnavailableRef.current = true;
      }

      // ── 相机（与 WebGL 完全同源）：fov 45°、相机在 +z、距离由同一个纯函数反解
      const fov = (CAMERA_FOV_DEG * Math.PI) / 180;
      let cam = camRef.current;
      if (
        !cam
        || cam.w !== w || cam.h !== h || cam.mode !== renderingMode
        || cam.atoms !== atoms || cam.basis !== basis
      ) {
        cam = {
          w,
          h,
          mode: renderingMode,
          atoms,
          basis,
          value: computeFramedCameraDistance({
            atoms,
            center: fit.center,
            basis,
            width: w,
            height: h,
            fovDeg: CAMERA_FOV_DEG,
            mode: renderingMode,
          }),
        };
        camRef.current = cam;
      }
      const camDist = cam.value;
      const focal = (h / 2) / Math.tan(fov / 2); // 竖直 FOV 对应焦距（px）
      const nearDepth = camDist - fit.radius;
      const farDepth = camDist + fit.radius;
      const depthT = (d: number) => clamp((d - nearDepth) / Math.max(farDepth - nearDepth, 1e-6), 0, 1);

      // ── 模式参数：球径/键径全部引用共享常量（与 WebGL 三种模型逐项对应）
      //    ball-stick：球 = 范德华半径 × 0.42，键半径 0.055 / ×1.2 / ×1.45
      //    space-filling：球 = 范德华半径 × 1.0，无键
      //    tube：球半径固定 0.18，键半径 0.04
      const isSpaceFill = renderingMode === 'space-filling';
      const showBonds = !isSpaceFill;
      // 上限只做「病态输入」保护（1e9 px 级渐变会让浏览器直接卡死）。
      // 正常取景 + 最大 5× 缩放时最大球半径远小于此值，因此不会破坏与 WebGL 的一致性。
      const maxAtomPx = Math.max(6, Math.max(w, h) * 4);
      const minAtomPx = 1.1;

      // 旋转（先 yaw 绕 Y，再 pitch 绕 X），以质心为原点。
      // 注意：几何坐标全程不取整，取整只发生在极细描边端点（snapStrokes），
      // 否则拖拽旋转时会出现整像素跳变/锯齿抖动。
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
      const cosP = Math.cos(pitch), sinP = Math.sin(pitch);
      const [cx, cy, cz] = fit.center;

      const scratch = scratchRef.current;
      const project = (x: number, y: number, z: number, out: Projected): Projected => {
        const depth = camDist - z; // z 越大（离相机越近）→ depth 越小
        if (!(depth > 0.05) || !Number.isFinite(x) || !Number.isFinite(y)) {
          out.visible = false; out.sx = w / 2; out.sy = h / 2; out.px = 0; out.depth = depth;
          return out;
        }
        const px = (focal / depth) * viewScale;
        out.sx = w / 2 + x * px;
        out.sy = h / 2 - y * px;
        out.px = px;
        out.depth = depth;
        out.visible = true;
        return out;
      };

      // ── 原子屏幕参数一次性写入可复用缓冲；网格/键/球后续只读，逐帧零新数组
      const n = atoms.length;
      const buf = bufRef.current;
      if (buf.sx.length < n) {
        buf.sx = new Float32Array(n);
        buf.sy = new Float32Array(n);
        buf.r = new Float32Array(n);
        buf.t = new Float32Array(n);
        buf.depth = new Float32Array(n);
        buf.px = new Float32Array(n);
        buf.wx = new Float32Array(n);
        buf.wy = new Float32Array(n);
        buf.wz = new Float32Array(n);
      }
      const order = buf.order;
      order.length = n;
      for (let i = 0; i < n; i++) {
        const a = atoms[i];
        const lx = a.x - cx, ly = a.y - cy, lz = a.z - cz;
        // 先转到主轴坐标系（最长轴横置），再叠用户拖拽的 yaw/pitch
        const bx = basis ? basis[0] * lx + basis[1] * ly + basis[2] * lz : lx;
        const by = basis ? basis[3] * lx + basis[4] * ly + basis[5] * lz : ly;
        const bz = basis ? basis[6] * lx + basis[7] * ly + basis[8] * lz : lz;
        const x1 = bx * cosY + bz * sinY;
        const z1 = -bx * sinY + bz * cosY;
        const y2 = by * cosP - z1 * sinP;
        const z2 = by * sinP + z1 * cosP;
        buf.wx[i] = x1;
        buf.wy[i] = y2;
        buf.wz[i] = z2;
        order[i] = i;
        const depth = camDist - z2;
        if (depth > 0.05 && Number.isFinite(x1) && Number.isFinite(y2)) {
          // 球体真实剪影半径：focal·r/√(d²−r²)。WebGL 里透视球体在屏幕上就是这个大小，
          // 用近似式 focal·r/d 会小 1–5%，两条路径的包围盒会对不齐。
          const rw = atomWorldRadius(a.element, renderingMode);
          const denom = depth * depth - rw * rw;
          const sphereScale = denom > 1e-4
            ? (focal * viewScale) / Math.sqrt(denom)
            : (focal * viewScale) / Math.max(depth, 0.05);
          buf.r[i] = clamp(rw * sphereScale, minAtomPx, maxAtomPx);
        } else {
          // 非有限坐标（上游解析异常时可能出现）直接当作不可见：否则 NaN 会一路传进
          // createRadialGradient 抛错，让整帧被 try/catch 中断、并每帧刷一条 warn。
          buf.r[i] = 0;
        }
      }
      for (let i = 0; i < n; i++) {
        const p = project(buf.wx[i], buf.wy[i], buf.wz[i], scratch.a);
        buf.sx[i] = p.sx;
        buf.sy[i] = p.sy;
        buf.depth[i] = p.depth;
        buf.px[i] = p.px;
        buf.t[i] = depthT(p.depth);
        if (!p.visible) buf.r[i] = 0;
      }

      // ── 结构标注投影（软件路径）：只算屏幕坐标写进 ref，**绝不画进 canvas**。
      //    门禁读的是 canvas.toDataURL 像素；标注走 DOM 覆盖层（StructureLabelsOverlay），
      //    canvas 像素保持逐字节不变 → 墨迹/bbox/质心统计不受标注开关影响。
      if (annotationLevel !== 'off') {
        atomScreenRef.current.clear();
        for (let i = 0; i < n; i++) {
          if (buf.r[i] <= 0) continue;
          atomScreenRef.current.set(i, { x: buf.sx[i], y: buf.sy[i], r: buf.r[i] });
        }
        if (structureLabels.length > 0) {
          const out = labelScreenRef.current;
          for (const label of structureLabels) {
            const ai = label.atom;
            if (!Number.isInteger(ai) || ai < 0 || ai >= n || buf.r[ai] <= 0) {
              out.set(label.key, { x: 0, y: 0, visible: false, depth: Infinity });
              continue;
            }
            out.set(label.key, {
              x: buf.sx[ai] + label.dx,
              y: buf.sy[ai] + label.dy,
              visible: true,
              depth: buf.depth[ai],
            });
          }
        }
      } else if (labelScreenRef.current.size > 0) {
        labelScreenRef.current.clear();
        atomScreenRef.current.clear();
      }

      // ── 透视网格地面（与 WebGL GridFloor 同源：y = -radius*0.95，extent/密度同公式）
      //    主/次线两级（每 5 条主线略亮，颜色取 GridHelper 的 0x3c78ff / 0x1a3a6a），
      //    越靠地平线越淡，整体亮度压得很低，绝不压过分子。
      const floorY = -fit.radius * 0.95;
      const extent = Math.max(fit.radius * 2.2, 0.5);
      const gridSpan = clamp(Math.round((extent * 2) / Math.max(fit.radius / 2.6, 0.05)), 4, 40);
      const gridStep = (extent * 2) / gridSpan;
      const horizonY = h / 2; // 无限远的地面线收敛于光轴（画面中心）
      const gridNear = camDist - extent;
      const gridFar = camDist + extent * 1.8;
      ctx.lineWidth = 1;
      ctx.lineCap = 'butt';
      const drawGridSeg = (x1: number, z1: number, x2: number, z2: number, major: boolean) => {
        const p1 = project(x1, floorY, z1, scratch.a);
        const p2 = project(x2, floorY, z2, scratch.b);
        if (!p1.visible || !p2.visible) return;
        const depthMid = (p1.depth + p2.depth) / 2;
        const depthFade = clamp(1 - (depthMid - gridNear) / Math.max(gridFar - gridNear, 1e-6), 0, 1);
        // 越靠近地平线（画面中心）越淡，避免网格在地平线处堆成一条亮线
        const horizonFade = clamp(Math.abs((p1.sy + p2.sy) / 2 - horizonY) / (h * 0.22), 0, 1);
        const alpha = depthFade * depthFade * horizonFade * (major ? 0.3 : 0.14);
        if (alpha <= 0.012) return;
        ctx.strokeStyle = hexToRgba(major ? SOFT_GRID_MAJOR : SOFT_GRID_MINOR, alpha);
        ctx.beginPath();
        // 1px 细线对齐设备像素网格，避免发虚（只对齐描边端点，不动分子几何）
        ctx.moveTo(snapStrokes(p1.sx, dpr, 1), snapStrokes(p1.sy, dpr, 1));
        ctx.lineTo(snapStrokes(p2.sx, dpr, 1), snapStrokes(p2.sy, dpr, 1));
        ctx.stroke();
      };
      for (let i = 0; i <= gridSpan; i++) {
        const g = -extent + i * gridStep;
        const major = i % 5 === 0;
        drawGridSeg(g, -extent, g, extent, major);
        drawGridSeg(-extent, g, extent, g, major);
      }

      // ── 地面落影（high 档、未降级）：把每个原子垂直投到地面平面，用预渲染柔影 sprite 画出
      //    整体落影 → 分子「站在场景里」而非浮在网格上。影只压暗地面（rgba(2,5,12,…)），地面 L 仍 <70。
      //    画在本体之前 → 近地面原子会盖在自己的影上，符合物理遮挡。
      if (useFloorShadow) {
        const spr = shadowSpriteRef.current;
        if (spr && spr.dpr === dpr) {
          for (let i = 0; i < n; i++) {
            const r0 = buf.r[i];
            if (r0 <= 0) continue;
            // 垂直投影到地面：x/z 不变、y 取 floorY
            const p = project(buf.wx[i], floorY, buf.wz[i], scratch.a);
            if (!p.visible) continue;
            // 落影屏幕半径按落影点的透视比例缩放（地面比原子更远 → 影更小）
            const scale = p.px > 0 && buf.px[i] > 0 ? p.px / buf.px[i] : 1;
            const sr = r0 * scale * 1.25;
            if (sr < 1.5) continue;
            // 距地越近影越实；深度越远影越淡（与网格的 depthFade 同源）
            const height = Math.abs(buf.wy[i] - floorY);
            const groundProx = clamp(1 - height / Math.max(fit.radius * 2.2, 0.5), 0, 1);
            const depthFade = clamp(1 - (p.depth - gridNear) / Math.max(gridFar - gridNear, 1e-6), 0, 1);
            const a = groundProx * (0.35 + 0.65 * depthFade);
            if (a <= 0.03) continue;
            // 影子朝右下偏移一点（主光在左上）
            const ox = SHADOW_DIR_X * sr * 0.22, oy = SHADOW_DIR_Y * sr * 0.22;
            ctx.globalAlpha = a;
            ctx.drawImage(spr.canvas, p.sx + ox - sr, p.sy + oy - sr, sr * 2, sr * 2);
          }
          ctx.globalAlpha = 1;
        }
      }

      // 深度排序：远（depth 大）→ 近（depth 小）。原地复用 order 数组，零分配。
      const depthArr = buf.depth;
      order.sort((i, j) => depthArr[j] - depthArr[i]);

      // ── 屏幕空间 AO / 投影 预遍（中/高档）：均匀网格分桶 + 3×3 邻居查询，
      //    只对「更近镜头且屏幕圆盘重叠」的原子对累积遮挡向量/强度。
      //    复杂度 O(n·k)（k=3×3 cell 内平均原子数），非 O(n²)；遮挡量存可复用缓冲。
      const occ = occRef.current;
      if (useSoftAO) {
        if (occ.x.length < n) {
          occ.x = new Float32Array(n); occ.y = new Float32Array(n); occ.str = new Float32Array(n);
        }
        const grid = softBuildGrid(buf.sx, buf.sy, buf.r, n, w, h);
        if (grid) softAccumulateOcclusion(buf.sx, buf.sy, buf.r, buf.depth, n, grid, occ.x, occ.y, occ.str);
      }

      // ── 键：单键沿用「暗底 + 高光芯」的双色圆柱感；双键/三键改为真正的平行多线
      //    （沿键的垂直方向偏移、间距 ≈ 1.6 × 线宽），深度雾与透视粗细保留。
      //    总键宽与 WebGL 的 2×bondRadiusWorld 对齐（单 0.055 / 双 ×1.2 / 三 ×1.45）。
      if (showBonds && bonds && bonds.length > 0) {
        ctx.lineCap = 'round';
        for (let bi = 0; bi < bonds.length; bi++) {
          const b = bonds[bi];
          if (!b) continue;
          const i1 = b.start, i2 = b.end;
          if (!Number.isInteger(i1) || !Number.isInteger(i2)) continue;
          if (i1 < 0 || i2 < 0 || i1 >= n || i2 >= n) continue;
          if (buf.r[i1] <= 0 || buf.r[i2] <= 0) continue; // 端点不可见
          const x1 = buf.sx[i1], y1 = buf.sy[i1];
          const x2 = buf.sx[i2], y2 = buf.sy[i2];
          let dx = x2 - x1, dy = y2 - y1;
          const segLen = Math.sqrt(dx * dx + dy * dy);
          if (!(segLen >= 0.5)) continue; // 屏幕上两端重合，画了也看不见
          dx /= segLen; dy /= segLen;
          // 垂直方向统一朝上（主光方向），高光芯沿它偏移 → 圆柱受光感
          let perpX = -dy, perpY = dx;
          if (perpY > 0) { perpX = -perpX; perpY = -perpY; }
          const px = (buf.px[i1] + buf.px[i2]) / 2;
          const t = (buf.t[i1] + buf.t[i2]) / 2;
          const pal = bondPalette(t);
          const columns = bondColumnCount(b.type);
          // 总键宽（屏幕 px）= 2 × 世界键半径 × 像素比例；多线平分这条总宽
          const totalWidth = 2 * bondRadiusWorld(b.type, renderingMode) * px;
          const lw = clamp(totalWidth / (1 + 1.6 * (columns - 1)), 0.6, 14);
          const gap = columns > 1 ? lw * 1.6 : 0; // 平行线间距 ≈ 1.6 × 线宽
          const hx = perpX * lw * 0.16, hy = perpY * lw * 0.16;
          const coreW = Math.max(0.7, lw * 0.34);
          // 键端轴向淡出（治「拼接感」核心）：中/高档沿键轴建 gradient，两端各留 fadeLen 过渡区，
          // 向内过渡到键本色 → 键端不再被球轮廓硬切，而是「溶」进球体边缘，交界处亮度连续。
          // 低档 fadeOn=false 保持纯色基线。
          // 质心对称（修 3d-visual-qa 回归）：两端**必须**几何对称 + 颜色对称，否则亮墨迹质心会
          // 沿键轴偏向较亮的一端（tube 模式键粗、键多，C−O/C−N 异色键尤其明显 → 整体质心偏移）。
          //   几何对称：两端过渡长度取同一 fadeLen（两端球屏幕半径的较大值），非各用各的半径。
          //   颜色对称：两端端点 stop 用**同一个**边缘色（两球边缘色调的平均），
          //             不再用各自原子的元素色/深度（那会让 O 端比 C 端亮 → 质心偏移）。
          //   过渡长度 clamp 到键长一半以内（极短键两端在中央汇合亦可）。
          const fadeOn = useCylinderBond;
          const fadeLen = Math.min(
            segLen * 0.5,
            Math.max(2, Math.max(buf.r[i1], buf.r[i2]) * 0.62),
          );
          const e1 = fadeLen / segLen, e2 = 1 - fadeLen / segLen;
          // 两端共用的对称边缘色：两球边缘色调（与 buildSphereGradient 最外档 rim 同源）
          // 取平均，再各掺 35% 键本色 → 与键身衔接更顺，且两端完全一致。
          const atomEdge = (idx: number) => mixColor(
            shade(mixColor(cpkColor(atoms[idx].element), SOFT_FOG, 0.46 * buf.t[idx]), -0.58),
            SOFT_WARM_BOUNCE, 0.30,
          );
          const symEdge = mixColor(mixColor(atomEdge(i1), atomEdge(i2), 0.5), pal.base, 0.35);
          // 供 axialFadeStops 复用的轴向 gradient 工厂（两端端点色相同 = 对称）
          const makeAxial = () => {
            const g = ctx.createLinearGradient(x1, y1, x2, y2);
            axialFadeStops(g, e1, e2, symEdge, pal.base, symEdge);
            return g;
          };
          for (let li = 0; li < columns; li++) {
            const off = columns === 1 ? 0 : (li - (columns - 1) / 2) * gap;
            const ox = perpX * off, oy = perpY * off;
            const sx1 = x1 + ox, sy1 = y1 + oy, sx2 = x2 + ox, sy2 = y2 + oy;
            // ① 圆柱暗底：中/高档用轴向淡出 gradient，低档纯色
            ctx.strokeStyle = fadeOn ? makeAxial() : pal.base;
            ctx.lineWidth = lw;
            ctx.beginPath();
            ctx.moveTo(sx1, sy1);
            ctx.lineTo(sx2, sy2);
            ctx.stroke();
            if (fadeOn && lw >= 1.4) {
              // ② 圆柱受光横截面（暗-亮-暗）：裁剪到本列轮廓 + source-atop 限制在已画底色内，
              //    中段铺横截面渐变、两端淡出区保持 base → 端部仍隐入球体、不出现硬边。
              ctx.save();
              ctx.beginPath();
              ctx.rect(sx1 - lw - Math.abs(dx) * lw, sy1 - lw - Math.abs(dy) * lw,
                segLen + 2 * lw, 2 * lw);
              ctx.clip();
              ctx.globalCompositeOperation = 'source-atop';
              const lg = ctx.createLinearGradient(
                sx1 - perpX * lw * 0.5, sy1 - perpY * lw * 0.5,
                sx1 + perpX * lw * 0.5, sy1 + perpY * lw * 0.5,
              );
              lg.addColorStop(0, shade(pal.base, -0.22));
              lg.addColorStop(0.36, shade(pal.base, 0.20));
              lg.addColorStop(0.62, shade(pal.base, 0.08));
              lg.addColorStop(1, shade(pal.base, -0.26));
              ctx.strokeStyle = lg;
              ctx.lineWidth = lw;
              ctx.beginPath();
              ctx.moveTo(sx1, sy1);
              ctx.lineTo(sx2, sy2);
              ctx.stroke();
              ctx.restore();
              // ③ 高光芯：轴向淡出 + source-atop，端部随暗底一起隐入球体
              ctx.save();
              ctx.beginPath();
              ctx.rect(sx1 - lw, sy1 - lw, segLen + 2 * lw, 2 * lw);
              ctx.clip();
              ctx.globalCompositeOperation = 'source-atop';
              const coreGrad = ctx.createLinearGradient(x1, y1, x2, y2);
              axialFadeStops(coreGrad, e1, e2, 'rgba(159,184,224,0)', pal.core, 'rgba(159,184,224,0)');
              ctx.strokeStyle = coreGrad;
              ctx.lineWidth = coreW;
              ctx.beginPath();
              ctx.moveTo(sx1 + hx, sy1 + hy);
              ctx.lineTo(sx2 + hx, sy2 + hy);
              ctx.stroke();
              ctx.restore();
            } else {
              // 低档/细键：高光芯不淡出（保持基线观感）
              ctx.strokeStyle = pal.core;
              ctx.lineWidth = coreW;
              ctx.beginPath();
              ctx.moveTo(sx1 + hx, sy1 + hy);
              ctx.lineTo(sx2 + hx, sy2 + hy);
              ctx.stroke();
            }
          }
          // 键端衔接 AO（中/高档，收敛）：裁剪到键的屏幕轮廓内画柔和暗影，球体后画盖住朝球一侧。
          // 治「拼接感」：alpha 0.5→0.28、圆心更贴球心、半径缩小，只做轻微接触暗化，不再成独立暗界。
          if (useCylinderBond && lw >= 1.2) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(x1 - perpX * lw * 0.5, y1 - perpY * lw * 0.5);
            ctx.lineTo(x2 - perpX * lw * 0.5, y2 - perpY * lw * 0.5);
            ctx.lineTo(x2 + perpX * lw * 0.5, y2 + perpY * lw * 0.5);
            ctx.lineTo(x1 + perpX * lw * 0.5, y1 + perpY * lw * 0.5);
            ctx.closePath();
            ctx.clip();
            const br = Math.max(1.4, lw * 0.85);
            const ox = SHADOW_DIR_X * lw * 0.28, oy = SHADOW_DIR_Y * lw * 0.28;
            ctx.globalAlpha = 0.28;
            ctx.fillStyle = 'rgba(2,5,12,0.5)';
            ctx.beginPath(); ctx.arc(x1 + ox, y1 + oy, br, 0, TAU); ctx.fill();
            ctx.beginPath(); ctx.arc(x2 + ox, y2 + oy, br, 0, TAU); ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
          }
        }
      }

      // ── 原子：远 → 近。每颗先铺一层略大的暗色底圈（接触遮蔽），再画四段光照本体。
      //    底圈按深度顺序压在已画好的近邻上，球与球之间就有咬合/接触感，
      //    而不是悬浮的扁圆片；仍是 O(n) 单遍，不做两两配对（327 原子也不会 O(n²)）。
      for (let oi = 0; oi < n; oi++) {
        const i = order[oi];
        const r = buf.r[i];
        if (!(r > 0)) continue;
        const sx = buf.sx[i], sy = buf.sy[i];
        if (!Number.isFinite(sx) || !Number.isFinite(sy)) continue;
        const t = buf.t[i];
        const pal = spherePalette(cpkColor(atoms[i].element), t);

        if (r > 1.6) {
          // 接触遮蔽底圈：中/高档用预渲染柔环 sprite（多段柔和、无硬边），
          // 低档回退 flat 暗圈。sprite 中心透明、极淡宽峰在 1.12R、向外缓淡到 1.55R，
          // 画在本体之下 → 只露一层宽而极淡的柔晕压在已画的近邻上，不再成硬接缝。
          const spr = ringSpriteRef.current;
          if (qMed && spr && spr.dpr === dpr) {
            const s = r * 3.2;
            ctx.drawImage(spr.canvas, sx - s / 2, sy - s / 2, s, s);
          } else {
            ctx.fillStyle = pal.contact;
            ctx.beginPath();
            ctx.arc(sx, sy, r * 1.12 + 0.5, 0, TAU);
            ctx.fill();
          }
        }

        if (r < 2.2) {
          // 极小原子：平涂 + 跳过着色/高光，避免噪点与锯齿抖动
          ctx.fillStyle = pal.flat;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, TAU);
          ctx.fill();
          continue;
        }

        // 连续着色（治「皮肤」主因）：一条 radialGradient 内 9 个 stop 由平滑光照函数采样，
        // 体渐变 + 高光亮脊 + 轮廓暗化三合一；相邻 stop 亮度增量 <2/255，Canvas 插值后无色带。
        // 渐变按「颜色×深度档」缓存（sphereGradient），同色同档原子逐帧复用同一对象、零新建。
        // 最外档在 1.045r 处收尾 + 渐变外半径略大于轮廓 → 取代旧版硬边 outline stroke（Fix 2），
        // 高光并入主渐变亮脊 → 删除独立 specular gradient（Fix 3）。
        ctx.fillStyle = sphereGradient(ctx, sx, sy, r, cpkColor(atoms[i].element), t);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.fill();

        // 球面补光（治「只有一盏灯」主因）：冷色环境补光从下方提起暗面 → 受光面/暗面/边缘三区立体。
        // sprite 构建时已 clip 球轮廓内，逐帧一次 drawImage、零新建 gradient。降级档仅对较大原子启用。
        if (useFillLight && (!fillLargeOnly || r >= 6)) {
          const fspr = fillSpriteRef.current;
          if (fspr && fspr.dpr === dpr) {
            ctx.globalAlpha = 1 - t * 0.25; // 远原子补光略衰减，不抹平深度雾
            ctx.drawImage(fspr.canvas, sx - r, sy - r, r * 2, r * 2);
            ctx.globalAlpha = 1;
          }
        }

        // 菲涅尔边缘（中/高档）：边缘物理暗化带 + 背光侧冷 rim，预渲染 sprite 一次 drawImage
        // 取代旧「逐原子新建 gradient」，globalAlpha 保留随深度雾衰减的观感。
        if (useRim) {
          const rspr = rimSpriteRef.current;
          if (rspr && rspr.dpr === dpr) {
            ctx.globalAlpha = (qHigh ? 0.42 : 0.3) * (1 - t * 0.6);
            ctx.drawImage(rspr.canvas, sx - r, sy - r, r * 2, r * 2);
            ctx.globalAlpha = 1;
          } else {
            // sprite 不可用 → 回退旧逐帧 gradient
            fillRimGradient(ctx, sx, sy, r, (qHigh ? 0.42 : 0.3) * (1 - t * 0.6));
          }
        }

        // 屏幕空间 AO + 偏光投影（中/高档）：朝「遮挡方向⊕反光方向」偏移的柔和暗影，
        // 画在本体之上、半径受限于球内 → 只压暗球面凹陷/背光侧，绝不溢出到背景。
        if (useSoftAO && occ.str[i] > 0.02) {
          fillAoGradient(ctx, sx, sy, r, occ.x[i], occ.y[i], occ.str[i], aoLayers);
        }
      }

      // 帧时采样 + 自动降级（demand 模式只在真正出帧时累积；滚动 10 帧窗口）：
      // 连续样本均值 >19ms 降一档（2→1→0），降级后清空样本重新累积，避免用陈旧样本连跳。
      if (qMed && frameStart > 0) {
        const dt = performance.now() - frameStart;
        const perf = softPerfRef.current;
        if (dt >= 1 && dt <= 250) { // 过滤 rAF 间隙 / 标签页切换导致的异常大值
          perf.samples.push(dt);
          if (perf.samples.length > 10) perf.samples.shift();
          if (perf.samples.length >= 6 && perf.level > 0) {
            const avg = perf.samples.reduce((s, v) => s + v, 0) / perf.samples.length;
            if (avg > 19) {
              perf.level = Math.max(0, perf.level - 1);
              perf.samples.length = 0;
            }
          }
        }
      }
    } catch (err) {
      // 软件渲染是最后一道保障：任何绘制异常都不应把整个分析页带崩
      logger.warn('[MoleculeViewer3D] 软件渲染绘制失败', err as Error);
    }
  }, [atoms, bonds, renderingMode, fit, basis, quality, qMed, qHigh, useSoftAO, useRim, useCylinderBond, aoLayers, baseDetailLevel, annotationLevel, structureLabels, labelScreenRef, atomScreenRef]);

  // draw 只通过 ref 暴露给 rAF 循环，避免每次数据变化都重装事件监听
  const drawRef = useRef(draw);
  useEffect(() => { drawRef.current = draw; }, [draw]);

  // 画质档切换时重置帧时降级（detailLevel = min(baseDetailLevel, level)，baseDetailLevel 已按档封顶）
  useEffect(() => {
    softPerfRef.current.level = 2;
    softPerfRef.current.samples.length = 0;
  }, [quality]);

  const schedule = useCallback(() => {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      drawRef.current();
    });
  }, []);

  // 数据 / 模式 / 朝向变化后重绘一次（首帧在尺寸测量后也会触发）
  useEffect(() => { schedule(); }, [draw, schedule]);

  // 尺寸测量 + ResizeObserver + 指针/滚轮交互（只在挂载时装配一次）
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const applySize = () => {
      // DPR 上限 2：与 WebGL 路径的 dpr={[1, 2]} 保持一致，3x 屏再高只是白烧像素
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const rect = container.getBoundingClientRect();
      const w = Math.round(rect.width || container.clientWidth || 0);
      const h = Math.round(rect.height || container.clientHeight || 0);
      // 布局尚未完成（0×0）时不要写死尺寸，等 ResizeObserver/下一帧再来
      if (w <= 0 || h <= 0) return false;
      sizeRef.current = { w, h, dpr };
      const pw = Math.max(1, Math.round(w * dpr));
      const ph = Math.max(1, Math.round(h * dpr));
      // 仅在尺寸真正变化时改写（改 width/height 会清空画布并重置变换）
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw;
        canvas.height = ph;
      }
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };
    if (!applySize()) {
      // 首次挂载时容器可能还没布局，下一帧重试一次
      requestAnimationFrame(() => { applySize(); schedule(); });
    }

    let dragging = false;
    let lastX = 0; let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      dragging = true; lastX = e.clientX; lastY = e.clientY;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* noop */ }
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX; const dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
      viewRef.current.yaw += dx * 0.008;
      viewRef.current.pitch = clamp(viewRef.current.pitch + dy * 0.008, -Math.PI / 2, Math.PI / 2);
      schedule();
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      try { canvas.releasePointerCapture(e.pointerId); } catch { /* noop */ }
      schedule();
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!Number.isFinite(e.deltaY)) return;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      viewRef.current.scale = clamp(viewRef.current.scale * factor, VIEW_SCALE_MIN, VIEW_SCALE_MAX);
      schedule();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    const ro = new ResizeObserver(() => { applySize(); schedule(); });
    ro.observe(container);
    schedule(); // 首帧

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
      ro.disconnect();
      if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    };
  }, [schedule]);

  // 自动旋转：只在本模式开启时跑 rAF，关闭 / 卸载立即停
  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0;
    let last = 0;
    const step = (now: number) => {
      if (last === 0) last = now;
      const dt = Math.min(0.12, Math.max(0, (now - last) / 1000));
      last = now;
      viewRef.current.yaw += AUTO_ROTATE_RAD_PER_SEC * dt;
      drawRef.current();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    autoRafRef.current = raf;
    return () => {
      cancelAnimationFrame(raf);
      if (autoRafRef.current === raf) autoRafRef.current = null;
    };
  }, [autoRotate]);

  // 复位：回到默认 yaw/pitch + 自动取景（取景在 draw 里按 size 重新反解，天然复位）
  useEffect(() => {
    viewRef.current.yaw = DEFAULT_VIEW_YAW;
    viewRef.current.pitch = DEFAULT_VIEW_PITCH;
    viewRef.current.scale = 1;
    schedule();
  }, [resetSignal, schedule]);

  // 对父组件的视角 API（工具条 / 键盘共用）
  useEffect(() => {
    const api: ViewerApi = {
      rotate: (deltaYaw, deltaPitch) => {
        viewRef.current.yaw += Number.isFinite(deltaYaw) ? deltaYaw : 0;
        viewRef.current.pitch = clamp(
          viewRef.current.pitch + (Number.isFinite(deltaPitch) ? deltaPitch : 0),
          -Math.PI / 2,
          Math.PI / 2,
        );
        schedule();
      },
      zoom: (factor) => {
        if (!Number.isFinite(factor) || factor <= 0) return;
        viewRef.current.scale = clamp(viewRef.current.scale * factor, VIEW_SCALE_MIN, VIEW_SCALE_MAX);
        schedule();
      },
      reset: () => {
        viewRef.current.yaw = DEFAULT_VIEW_YAW;
        viewRef.current.pitch = DEFAULT_VIEW_PITCH;
        viewRef.current.scale = 1;
        schedule();
      },
      exportPng: async () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        try {
          return canvas.toDataURL('image/png');
        } catch (err) {
          logger.warn('[MoleculeViewer3D] 软件渲染画布导出失败', err as Error);
          return null;
        }
      },
    };
    onRegisterApi(api);
    return () => { onRegisterApi(null); };
  }, [onRegisterApi, schedule]);

  // 向父组件注册 hover 命中测试（把 client 坐标转成画布坐标，取半径内最近的可见原子）。
  // 只在标注开启时命中，避免无标注时多余计算；返回 null 表示未悬停到原子。
  useEffect(() => {
    if (annotationLevel === 'off') { onRegisterHitTest(null); return; }
    const hitTest = (clientX: number, clientY: number): number | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const px = clientX - rect.left;
      const py = clientY - rect.top;
      let best = -1;
      let bestD = Infinity;
      for (const [idx, p] of atomScreenRef.current) {
        if (!(p.r > 0)) continue;
        const dx = px - p.x, dy = py - p.y;
        const d2 = dx * dx + dy * dy;
        const rr = Math.max(p.r, 6) + 4; // 命中容差：小球放大到 ≥6px，再留 4px 余量
        if (d2 <= rr * rr && d2 < bestD) { bestD = d2; best = idx; }
      }
      return best >= 0 ? best : null;
    };
    onRegisterHitTest(hitTest);
    return () => { onRegisterHitTest(null); };
  }, [annotationLevel, atomScreenRef, onRegisterHitTest]);

  return (
    <div ref={containerRef} className="absolute inset-0 select-none" style={{ touchAction: 'none' }}>
      <canvas ref={canvasRef} className="block h-full w-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}

// ─── 颜色工具：解析 #rrggbb / rgb() / rgba() ────────────────
function parseColor(color: string): [number, number, number] | null {
  const c = color.trim();
  const hex = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(c);
  if (hex) return [parseInt(hex[1], 16), parseInt(hex[2], 16), parseInt(hex[3], 16)];
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

function hexToRgba(color: string, alpha: number): string {
  const p = parseColor(color);
  const a = clamp(alpha, 0, 1).toFixed(3);
  return p ? `rgba(${p[0]},${p[1]},${p[2]},${a})` : `rgba(60,120,255,${a})`;
}

/** 线性混色：t=0 为 a，t=1 为 b */
function mixColor(a: string, b: string, t: number): string {
  const A = parseColor(a);
  const B = parseColor(b);
  if (!A || !B) return a;
  const k = clamp(t, 0, 1);
  const m = (i: number) => Math.round(A[i] + (B[i] - A[i]) * k);
  return `rgb(${m(0)},${m(1)},${m(2)})`;
}

// ─── 颜色工具：按比例调亮/调暗（负值变暗）──────────────────────
function shade(color: string, ratio: number): string {
  const p = parseColor(color);
  if (!p) return color;
  const ch = (v: number) => clamp(Math.round(v + 255 * ratio), 0, 255);
  return `rgb(${ch(p[0])},${ch(p[1])},${ch(p[2])})`;
}

// ─── WebGL 相机装置 ──────────────────────────────────────────
interface OrbitControlsLike {
  target: THREE.Vector3;
  minDistance: number;
  maxDistance: number;
  enabled: boolean;
  update: () => boolean;
}

function CameraRig({
  atoms, fit, basis, renderingMode, resetSignal, onRegisterApi,
}: {
  atoms: Atom[];
  fit: MoleculeFit;
  basis: number[] | null;
  renderingMode: RenderingMode;
  resetSignal: number;
  onRegisterApi: (api: ViewerApi | null) => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const controls = useThree((s) => s.controls) as unknown as OrbitControlsLike | null;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);

  // 与软件路径完全同源的取景（同一纯函数 + 同一默认朝向 + 同一 78% 占比 + 同一参考包络）
  const camDist = useMemo(
    () => computeFramedCameraDistance({
      atoms,
      center: fit.center,
      basis,
      width: size.width,
      height: size.height,
      fovDeg: camera.fov || CAMERA_FOV_DEG,
      mode: renderingMode,
    }),
    [atoms, fit, basis, renderingMode, size.width, size.height, camera],
  );
  const defaultPos = useMemo(() => defaultCameraPosition(camDist), [camDist]);

  // 1) 取景距离变化（数据 / 视口尺寸）：保持当前轨道方向，只更新半径；
  //    min/maxDistance 由同一个距离派生（与软件路径的 0.3–5× 缩放范围等价）。
  useEffect(() => {
    if (!controls) return;
    controls.minDistance = Math.max(0.35, camDist / VIEW_SCALE_MAX);
    controls.maxDistance = Math.max(controls.minDistance + 0.1, camDist / VIEW_SCALE_MIN);
    const offset = camera.position.clone().sub(controls.target);
    if (!(offset.lengthSq() > 1e-8) || !Number.isFinite(offset.lengthSq())) {
      camera.position.set(defaultPos[0], defaultPos[1], defaultPos[2]);
    } else {
      offset.setLength(camDist);
      camera.position.copy(controls.target).add(offset);
    }
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }, [camDist, controls, camera, invalidate, defaultPos]);

  // 2) 数据变化 / 复位：回到主轴定向 + 默认 yaw/pitch 的默认视角
  useEffect(() => {
    if (!controls) return;
    controls.target.set(0, 0, 0);
    camera.position.set(defaultPos[0], defaultPos[1], defaultPos[2]);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.update();
    invalidate();
  }, [fit, basis, resetSignal, controls, camera, invalidate, defaultPos]);

  // 3) 雾随相机距离缩放：起点置于分子之后，只影响远端背景，避免大分子被雾吞掉
  useEffect(() => {
    scene.fog = new THREE.Fog(SOFT_FOG, camDist + fit.radius, camDist + fit.radius * 3);
    invalidate();
  }, [camDist, fit, scene, invalidate]);

  // 4) 对父组件暴露视角 API：键盘 / 工具条（自动旋转由 OrbitControls.autoRotate 负责）
  useEffect(() => {
    const api: ViewerApi = {
      rotate: (deltaYaw, deltaPitch) => {
        if (!controls) return;
        const offset = camera.position.clone().sub(controls.target);
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta -= deltaYaw;  // 相机 theta = −yaw，与软件路径严格等价
        spherical.phi = clamp(spherical.phi - deltaPitch, 0.02, Math.PI - 0.02);
        spherical.radius = clamp(spherical.radius, controls.minDistance, controls.maxDistance);
        offset.setFromSpherical(spherical);
        camera.position.copy(controls.target).add(offset);
        camera.lookAt(controls.target);
        camera.updateProjectionMatrix();
        controls.update();
        invalidate();
      },
      zoom: (factor) => {
        if (!Number.isFinite(factor) || factor <= 0) return;
        const offset = camera.position.clone().sub(controls ? controls.target : new THREE.Vector3());
        const len = offset.length();
        if (!(len > 1e-6)) return;
        const minD = controls ? controls.minDistance : camDist / VIEW_SCALE_MAX;
        const maxD = controls ? controls.maxDistance : camDist / VIEW_SCALE_MIN;
        offset.setLength(clamp(len / factor, minD, maxD));
        camera.position.copy(controls ? controls.target : new THREE.Vector3()).add(offset);
        camera.updateProjectionMatrix();
        if (controls) controls.update();
        invalidate();
      },
      reset: () => {
        if (controls) controls.target.set(0, 0, 0);
        camera.position.set(defaultPos[0], defaultPos[1], defaultPos[2]);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        if (controls) controls.update();
        invalidate();
      },
      exportPng: async () => exportWebGLFrame(gl, scene, camera),
    };
    onRegisterApi(api);
    return () => { onRegisterApi(null); };
  }, [controls, camera, gl, scene, invalidate, onRegisterApi, camDist, defaultPos]);

  return null;
}

// ─── UI 呈现层 design tokens（全 UI 复用，消除字号/面板/圆角/边框不一致）───
// 字号阶梯：三档收敛，覆盖层不再散落 text-[10px] / text-xs。
const UI_TEXT = {
  micro: 'text-[10px]', // 10px：徽标 / 计数 / 画质标签
  small: 'text-[11px]', // 11px：按钮文字 / 图例项 / 模式指示
  base: 'text-xs',      // 12px：面板标题
} as const;

// 玻璃拟态面板：统一的背景透明度 + backdrop-blur + 1px 边框 + 统一圆角。
// 所有覆盖层用同一容器，视觉成体系（对标 Mol*/NGL 的克制浮层）。
const UI_PANEL =
  'pointer-events-auto rounded-lg border border-white/10 bg-neutral-950/70 backdrop-blur-md shadow-lg shadow-black/40';

// 状态徽标：低对比、小尺寸，功能性状态（兼容画质/软件渲染）hover 才完整提示。
const UI_BADGE = `inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${UI_TEXT.micro} font-mono border`;

// 分组分隔（控制栏内的细分隔线）
const UI_DIVIDER = 'mx-0.5 h-4 w-px bg-white/10';

// ─── 内联 SVG 图标（16×16 viewBox，stroke=currentColor，零外部依赖）────────
// 全部图标自绘 path；统一 width/height=16、fill=none、strokeWidth=1.5、圆角端点。
type IconProps = { className?: string };
const ICON_CLS = 'h-4 w-4 shrink-0';

function IconSvg({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`${ICON_CLS}${className ? ` ${className}` : ''}`}
    >
      {children}
    </svg>
  );
}

/** 自动旋转：环形箭头（RotateCcw 形制） */
function IconRotate() {
  return (
    <IconSvg>
      <path d="M2 8a6 6 0 1 0 6-6 6.5 6.5 0 0 0-4.5 1.83L2 5.4" />
      <path d="M2 2v3.4h3.4" />
    </IconSvg>
  );
}

/** 复位视角：准星/回到原点 */
function IconReset() {
  return (
    <IconSvg>
      <circle cx="8" cy="8" r="5.2" />
      <path d="M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2" />
      <circle cx="8" cy="8" r="1" />
    </IconSvg>
  );
}

/** 全屏：四角外扩 */
function IconFullscreen() {
  return (
    <IconSvg>
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
    </IconSvg>
  );
}

/** 导出 PNG：下载（箭头入托盘） */
function IconDownload() {
  return (
    <IconSvg>
      <path d="M8 2v7.6M4.8 6.6 8 9.8l3.2-3.2M2.5 12.8h11" />
    </IconSvg>
  );
}

/** 元素图例：2×2 色块网格 */
function IconLegend() {
  return (
    <IconSvg>
      <rect x="2.5" y="2.5" width="4.6" height="4.6" rx="1" />
      <rect x="8.9" y="2.5" width="4.6" height="4.6" rx="1" />
      <rect x="2.5" y="8.9" width="4.6" height="4.6" rx="1" />
      <rect x="8.9" y="8.9" width="4.6" height="4.6" rx="1" />
    </IconSvg>
  );
}

/** 结构标注：标签（带折角的 tag + 中心点，表示给原子挂文字标示） */
function IconAnnotation() {
  return (
    <IconSvg>
      <path d="M2.5 3.5h6.2l5 5-5 5H2.5z" />
      <circle cx="5.4" cy="8.5" r="1" />
    </IconSvg>
  );
}

/** 画质：滑块 */
function IconQuality() {
  return (
    <IconSvg>
      <path d="M2.5 5.5h11M2.5 10.5h11" />
      <circle cx="6" cy="5.5" r="1.7" />
      <circle cx="10.5" cy="10.5" r="1.7" />
    </IconSvg>
  );
}

/** 标题：分子（中心原子 + 4 配位原子） */
function IconMolecule({ className }: IconProps) {
  return (
    <IconSvg className={className}>
      <circle cx="8" cy="8" r="2" />
      <circle cx="3" cy="4.6" r="1.4" />
      <circle cx="13" cy="4.6" r="1.4" />
      <circle cx="3" cy="11.4" r="1.4" />
      <circle cx="13" cy="11.4" r="1.4" />
      <path d="M6.6 6.7 4.2 5.4M9.4 6.7l2.4-1.3M6.6 9.3 4.2 10.6M9.4 9.3l2.4 1.3" />
    </IconSvg>
  );
}

/** 渲染模式：球棍 */
function IconModeBallStick() {
  return (
    <IconSvg>
      <circle cx="4.4" cy="11.2" r="2" />
      <circle cx="11.6" cy="4.8" r="2" />
      <path d="M5.9 9.7 10.1 6.3" />
    </IconSvg>
  );
}

/** 渲染模式：空间填充（两个重叠大球） */
function IconModeSpaceFill() {
  return (
    <IconSvg>
      <circle cx="5.6" cy="8" r="3.9" />
      <circle cx="10.4" cy="8" r="3.9" />
    </IconSvg>
  );
}

/** 渲染模式：管状（缎带 S 形） */
function IconModeTube() {
  return (
    <IconSvg>
      <path d="M2.5 11c2.6 0 2.6-6 5.5-6s2.9 6 5.5 6" />
    </IconSvg>
  );
}

// ─── 工具条按钮（内联 SVG 图标 + 可选文字；title + 中文 aria-label + type=button，
//     避免触发表单提交；统一尺寸 / hover / active / focus-visible 焦点环）──
function ToolbarButton({
  label, title, ariaLabel, active, onClick, icon,
}: {
  label: string;
  title: string;
  ariaLabel: string;
  active?: boolean;
  onClick: () => void;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active === undefined ? undefined : active}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1 rounded-md border px-1.5 py-1 ${UI_TEXT.small} font-medium leading-none transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-secondary-400/70 ${
        active
          ? 'border-secondary-500/40 bg-secondary-500/25 text-secondary-200'
          : 'border-white/10 bg-white/[0.03] text-neutral-400 hover:bg-white/[0.08] hover:text-neutral-100'
      }`}
    >
      {icon}
      {label ? <span>{label}</span> : null}
    </button>
  );
}

// ─── 作用域错误边界：WebGL/渲染异常时降级到软件渲染，不拖垮分析 Tab ──
class ViewerErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || '' };
  }

  componentDidCatch(error: Error) {
    logger.error('[MoleculeViewer3D] 渲染异常，降级到软件渲染', error);
  }

  render() {
    if (this.state.hasError) {
      // 有 fallback（软件渲染）就渲染它，保证功能不中断
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="h-full w-full flex items-center justify-center">
          <div className="text-center">
            <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm font-medium">3D 预览暂不可用</p>
            <p className="text-neutral-600 text-xs mt-1">当前环境无法初始化 WebGL 3D 渲染</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── 主组件 ──────────────────────────────────────────────────
export function MoleculeViewer3D({
  atoms, bonds,
  renderingMode = 'ball-stick',
  className = '',
  sequence,
}: Props) {
  // 数据清洗 / 包围球 / 主轴朝向 / 图例：hook 必须位于任何提前 return 之前
  // （atoms 可能由空变为非空，早退后再调用会破坏 hook 顺序）
  const safeAtoms = useMemo(() => sanitizeAtoms(atoms), [atoms]);
  const safeBonds = useMemo<Bond[]>(
    () => (Array.isArray(bonds) ? bonds.filter((b) => !!b && typeof b === 'object') : []),
    [bonds],
  );
  const fit = useMemo(() => computeMoleculeFit(safeAtoms), [safeAtoms]);
  // 主轴定向只算一次，两条渲染路径共用同一个矩阵（WebGL → group.quaternion，软件 → 逐原子）
  const basis = useMemo(
    () => computeCanonicalBasis(safeAtoms, fit ? fit.center : null),
    [safeAtoms, fit],
  );
  const legend = useMemo(() => buildLegend(safeAtoms), [safeAtoms]);
  // WebGL group 的旋转矩阵（行主序 → Quaternion）；与软件路径的 basis 完全一致
  const modelQuaternion = useMemo(() => {
    if (!basis) return null;
    const matrix = new THREE.Matrix4().set(
      basis[0], basis[1], basis[2], 0,
      basis[3], basis[4], basis[5], 0,
      basis[6], basis[7], basis[8], 0,
      0, 0, 0, 1,
    );
    return new THREE.Quaternion().setFromRotationMatrix(matrix);
  }, [basis]);

  // WebGL 不可用时（无 GPU / 远程桌面 / 策略禁用）直接走 Canvas2D 软件渲染，
  // 不再挂载 Canvas —— 否则 R3F 的失败只是异步 unhandled rejection，页面会留下空白方块。
  const [webglOk, setWebglOk] = useState<boolean>(() => detectWebGLSupport());
  const [rendererCreated, setRendererCreated] = useState(false);
  const usingSoftware = !webglOk;

  // 全局 unhandledrejection 守卫（模块级，见下方 ensureR3FCanvasGuard）：
  // 二次分析会让本组件卸载重建，R3F 的 onCreated→connect 可能恰在旧 canvas 已被回收后执行，
  // 访问 gl.domElement（null）抛错。该错误发生在 React 渲染流程之外，错误边界捕获不到。
  // 关键：错误常在组件**卸载之后**才触发，若守卫随组件卸载而移除就永远捕获不到，
  // 因此守卫注册在模块级、只装一次；组件挂载时注册「降级回调」，卸载时注销回调（守卫保留）。
  useEffect(() => {
    if (usingSoftware) return;
    const downgrade = () => {
      markWebGLUnavailable();
      setWebglOk(false);
    };
    registerR3FDowngrade(downgrade);
    return () => unregisterR3FDowngrade(downgrade);
  }, [usingSoftware]);

  // 交互状态（两条路径共用同一个工具条 / 同一套状态）
  const [autoRotate, setAutoRotate] = useState(false);
  const [legendOpen, setLegendOpen] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exportHint, setExportHint] = useState<string | null>(null);
  // 画质档位（仅 WebGL 路径）：控制环境贴图分辨率 / 接触阴影 / 菲涅尔边缘光 / 半色键 / 球体细分
  const [quality, setQuality] = useState<QualityTier>('high');
  // 弱 GPU（SwiftShader / llvmpipe 等软件渲染）自动降档：探测阶段读到软件渲染器即置位，
  // 首帧前就按 low 渲染，避免 ContactShadows/Environment/清漆材质把主线程长期占满
  // （否则 Playwright 的 actionability 检查与键盘事件都会被阻塞 → 导出 PNG / 方向键失效）。
  // 首帧看门狗作兜底：渲染器字符串被屏蔽时，靠首帧耗时再触发一次降档。
  const [weakGpu, setWeakGpu] = useState<boolean>(() => isWeakGPURenderer());
  const handleWeakGpu = useCallback(() => {
    setWeakGpu((w) => {
      if (!w) logger.warn('[MoleculeViewer3D] 首帧耗时过长（弱 GPU/软件渲染），自动降为低画质');
      return true;
    });
  }, []);
  // 实际生效档位：弱 GPU 一律 low（覆盖用户选择），正常 GPU 用用户选的档位
  const effectiveQuality: QualityTier = weakGpu ? 'low' : quality;
  // 接触阴影用 frames={1} 只捕捉一次；数据 / 模式 / 生效档位变化时递增版本号 → 重挂载重新捕捉。
  // 依赖 effectiveQuality（而非 quality）：弱 GPU 下用户切档位不改变生效档位，不会频繁重挂。
  const [sceneVersion, setSceneVersion] = useState(0);
  useEffect(() => { setSceneVersion((v) => v + 1); }, [safeAtoms, renderingMode, effectiveQuality]);
  const shadowCaptureKey = `cs-${sceneVersion}`;

  // ── 结构标注层（两条渲染路径共用同一份推断结果）────────────────────
  // 默认「残基级」：只标 N端/C端/残基编号，克制不外扩；原子级/功能基需手动升档。
  // 默认不满屏标签（规范 §C）。
  const [annotationLevel, setAnnotationLevel] = useState<AnnotationLevel>('residue');
  const [hoverAtom, setHoverAtom] = useState<number | null>(null);
  // 软件路径：标签/原子屏幕坐标缓冲（draw 写入，DOM 覆盖层 rAF 读取）
  const labelScreenRef = useRef<Map<string, LabelScreenPos>>(new Map());
  const atomScreenRef = useRef<Map<number, { x: number; y: number; r: number }>>(new Map());
  // 软件路径 hover 命中测试（由 SoftwareMoleculeCanvas 注册）
  const hitTestRef = useRef<((clientX: number, clientY: number) => number | null) | null>(null);
  const handleRegisterHitTest = useCallback(
    (fn: ((clientX: number, clientY: number) => number | null) | null) => { hitTestRef.current = fn; },
    [],
  );
  const handleHoverAtomChange = useCallback((idx: number | null) => {
    setHoverAtom((cur) => (cur === idx ? cur : idx));
  }, []);
  // WebGL 路径 hover：用 pointermove + 命中测试（WebGL 无法直接读像素，借软件路径同一份推断）
  // 这里统一走 onHoverAtomChange，两条路径共用同一个 hoverAtom state。
  const handleRootPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (usingSoftware) {
      const fn = hitTestRef.current;
      const idx = fn ? fn(e.clientX, e.clientY) : null;
      handleHoverAtomChange(idx);
    }
  }, [usingSoftware, handleHoverAtomChange]);
  const handleRootPointerLeave = useCallback(() => { handleHoverAtomChange(null); }, [handleHoverAtomChange]);

  // 结构推断（纯函数，useMemo 缓存，依赖 atoms/bonds/sequence；异常内部已降级为空标注）
  const structureAnnotations = useMemo(
    () => inferStructureAnnotations(safeAtoms, safeBonds, sequence),
    [safeAtoms, safeBonds, sequence],
  );
  // 按档位构造显示标签：residue=残基级（N端/C端/残基编号），atom=残基级+主链原子/功能基
  const structureLabels = useMemo(() => {
    if (annotationLevel === 'off') return [];
    const residueLabels = buildStructureLabels(structureAnnotations);
    if (annotationLevel === 'atom') return [...residueLabels, ...buildAtomLevelLabels(structureAnnotations)];
    return residueLabels;
  }, [annotationLevel, structureAnnotations]);
  const buildTooltip = useCallback(
    (atomIndex: number) => buildAtomTooltip(structureAnnotations, atomIndex),
    [structureAnnotations],
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewApiRef = useRef<ViewerApi | null>(null);
  const hintTimerRef = useRef<number | null>(null);

  const registerViewApi = useCallback((api: ViewerApi | null) => {
    viewApiRef.current = api;
  }, []);

  // 兜底：探测通过但真实创建仍可能失败（驱动/配额问题）。若 4s 内未收到 onCreated，
  // 判定为不可用并永久降级（markWebGLUnavailable 会让后续挂载直接走软件渲染）。
  useEffect(() => {
    if (!webglOk || rendererCreated) return;
    const timer = setTimeout(() => {
      logger.warn('[MoleculeViewer3D] WebGL 渲染器创建超时，降级为软件渲染');
      markWebGLUnavailable();
      setWebglOk(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [webglOk, rendererCreated]);

  // 用户手动重试 GPU 渲染（例如刚在浏览器里打开了硬件加速）
  const retryWebGL = useCallback(() => {
    resetWebGLSupportCache();
    const ok = detectWebGLSupport();
    setWebglOk(ok);
    setRendererCreated(false);
    if (!ok) logger.warn('[MoleculeViewer3D] 重试 WebGL 仍不可用，继续使用软件渲染');
  }, []);

  // 全屏状态同步（含 webkit 前缀），卸载时移除监听
  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const sync = () => {
      const current = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      setIsFullscreen(current === containerRef.current);
    };
    doc.addEventListener('fullscreenchange', sync);
    doc.addEventListener('webkitfullscreenchange', sync);
    return () => {
      doc.removeEventListener('fullscreenchange', sync);
      doc.removeEventListener('webkitfullscreenchange', sync);
    };
  }, []);

  // 卸载时清掉导出提示定时器
  useEffect(() => {
    return () => {
      if (hintTimerRef.current != null) {
        window.clearTimeout(hintTimerRef.current);
        hintTimerRef.current = null;
      }
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    if (!el) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    try {
      const current = doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
      if (current) {
        if (doc.exitFullscreen) await doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) await doc.webkitExitFullscreen.call(doc);
      } else if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        await el.webkitRequestFullscreen.call(el);
      }
    } catch (err) {
      // 全屏需要用户手势 + 浏览器策略允许；被拒绝时保持原样，不抛到页面
      logger.warn('[MoleculeViewer3D] 全屏切换被拒绝或不受支持', err as Error);
    }
  }, []);

  const handleResetView = useCallback(() => {
    setResetSignal((v) => v + 1);
    const api = viewApiRef.current;
    if (api) api.reset();
  }, []);

  const handleExportPng = useCallback(async () => {
    const api = viewApiRef.current;
    let ok = false;
    try {
      // 先让出主线程：WebGL 导出会同步 gl.render + 读回帧缓冲，在慢 GPU（如软件渲染的
      // SwiftShader，约 300ms/帧）下若立即执行会阻塞主线程，导致点击反馈/Playwright
      // actionability 卡死。让出两帧确保点击已落地、指针状态已恢复后再做重活。
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });
      const url = api ? await api.exportPng() : null;
      if (url) ok = downloadDataUrl(url, `molecule-3d-${Date.now()}.png`);
    } catch (err) {
      logger.warn('[MoleculeViewer3D] PNG 导出失败', err as Error);
    }
    setExportHint(ok ? '已导出 PNG' : '导出失败，请重试');
    if (hintTimerRef.current != null) window.clearTimeout(hintTimerRef.current);
    hintTimerRef.current = window.setTimeout(() => {
      hintTimerRef.current = null;
      setExportHint(null);
    }, 2200);
  }, []);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const api = viewApiRef.current;
    const step = 0.12;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft': api?.rotate(-step, 0); break;
      case 'ArrowRight': api?.rotate(step, 0); break;
      case 'ArrowUp': api?.rotate(0, -step); break;
      case 'ArrowDown': api?.rotate(0, step); break;
      case '+':
      case '=': api?.zoom(1.15); break;
      case '-':
      case '_': api?.zoom(1 / 1.15); break;
      case 'Home': api?.reset(); break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  }, []);

  if (!safeAtoms || safeAtoms.length === 0) {
    return (
      <div className={`h-[420px] w-full rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-secondary-500/10 border border-secondary-500/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-secondary-400">
              <circle cx="12" cy="12" r="3" />
              <circle cx="5" cy="7" r="2" />
              <circle cx="19" cy="7" r="2" />
              <circle cx="5" cy="17" r="2" />
              <circle cx="19" cy="17" r="2" />
              <line x1="9.5" y1="9.5" x2="6.5" y2="8" />
              <line x1="14.5" y1="9.5" x2="17.5" y2="8" />
              <line x1="9.5" y1="14.5" x2="6.5" y2="16" />
              <line x1="14.5" y1="14.5" x2="17.5" y2="16" />
            </svg>
          </div>
          <p className="text-[color:var(--text-muted)] dark:text-[color:var(--text-secondary)] text-sm font-medium">暂无分子数据</p>
          <p className="text-neutral-600 text-xs mt-1">输入肽序列后自动生成3D结构</p>
        </div>
      </div>
    );
  }

  const rootClassName = [
    isFullscreen ? 'h-full w-full rounded-none' : 'h-[420px] w-full rounded-xl border border-white/10',
    'overflow-hidden relative outline-none',
    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-secondary-400/80',
    className,
  ].join(' ');

  const softwareViewer = (
    <>
      <SoftwareMoleculeCanvas
        atoms={safeAtoms}
        bonds={safeBonds}
        renderingMode={renderingMode}
        fit={fit}
        basis={basis}
        autoRotate={autoRotate}
        resetSignal={resetSignal}
        onRegisterApi={registerViewApi}
        quality={effectiveQuality}
        annotationLevel={annotationLevel}
        structureLabels={structureLabels}
        labelScreenRef={labelScreenRef}
        atomScreenRef={atomScreenRef}
        onHoverAtomChange={handleHoverAtomChange}
        onRegisterHitTest={handleRegisterHitTest}
      />
      {/* 结构标注 DOM 覆盖层：3D→屏幕投影在 draw 里算，这里只把坐标写到 DOM transform。
          标注是 canvas 之上的独立 overlay，不进入 2D canvas 像素 → 门禁墨迹/bbox/质心不受影响。 */}
      <StructureLabelsOverlay
        labels={structureLabels}
        screenPositions={labelScreenRef}
        hoverAtom={hoverAtom}
        onHoverAtom={handleHoverAtomChange}
        tooltipBuilder={buildTooltip}
      />
    </>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="application"
      aria-label="3D 分子结构查看器：拖拽旋转、滚轮缩放，方向键旋转，加减号缩放，Home 复位视角"
      onKeyDown={handleKeyDown}
      onPointerMove={handleRootPointerMove}
      onPointerLeave={handleRootPointerLeave}
      onPointerDown={() => {
        // 点击画布/空白处时把焦点收到容器上，方向键立刻可用（按钮上的 pointerdown 已 stopPropagation）
        const el = containerRef.current;
        if (el && document.activeElement !== el) {
          try { el.focus({ preventScroll: true }); } catch { /* 老浏览器不支持 preventScroll */ }
        }
      }}
      className={rootClassName}
      style={{ background: BG_COLOR }}
    >
      {/* ── 顶栏：统一的信息区（标题 + 原子数 ‖ 渲染模式 + 兼容状态徽标）────────────
          把原「左上标题 + 右上模式指示」两处零散浮层归拢为一整条顶栏，功能性状态（模式/兼容）
          视觉降权，装饰性标题弱化，不再与 3D 主体抢注意力。pointer-events-none 让空白处穿透到画布。 */}
      <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
        {/* 左：标识 + 原子计数 */}
        <div className="flex items-center gap-1.5">
          <div className={`${UI_PANEL} flex items-center gap-1.5 px-2 py-1`}>
            <IconMolecule className="text-secondary-400/90" />
            <span className={`${UI_TEXT.small} font-medium tracking-wide text-neutral-200`}>3D Structure</span>
            <span className={`${UI_TEXT.micro} font-mono text-neutral-500`}>{safeAtoms.length} atoms</span>
          </div>
          {/* 弱 GPU / 软件渲染兼容提示：已自动把生效档位降到 low（关接触阴影 + 关边缘光 +
              低分辨率环境贴图 + 单色键 + 低细分），避免首帧把主线程卡死。非常驻、低对比。 */}
          {weakGpu && (
            <span
              className={`${UI_BADGE} border-amber-500/20 bg-amber-500/10 text-amber-300/90 cursor-help`}
              title="检测到软件/弱 GPU 渲染（如远程桌面、虚拟机、无硬件加速），已自动降低画质以保障拖拽旋转与导出流畅。在浏览器开启硬件加速后可恢复高画质。"
            >
              兼容画质
            </span>
          )}
        </div>
        {/* 右：渲染模式指示（内联 SVG 图标 + 文字，替换手写符号 ●○│）+ 软件渲染状态 */}
        <div className="flex items-center gap-1.5">
          {usingSoftware && (
            <div className="pointer-events-auto flex items-center gap-1.5">
              <span
                className={`${UI_BADGE} border-white/10 bg-neutral-900/70 text-neutral-400 cursor-help`}
                title="帧率低 / 无 GPU（远程桌面、虚拟机、浏览器策略禁用 WebGL）时自动启用 Canvas2D 软件渲染。在浏览器中开启硬件加速后，点右侧「尝试启用 GPU 渲染」即可切回 WebGL。"
              >
                软件渲染 · 兼容模式
              </span>
              <button
                type="button"
                onClick={retryWebGL}
                title="重新探测 WebGL：可用则切回 GPU 渲染，否则继续使用软件渲染"
                aria-label="尝试启用 GPU 渲染"
                className={`inline-flex items-center rounded-md border border-secondary-500/30 bg-secondary-500/15 px-1.5 py-0.5 ${UI_TEXT.micro} font-medium text-secondary-300 transition-colors hover:bg-secondary-500/25 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-secondary-400/70`}
              >
                尝试启用 GPU 渲染
              </button>
            </div>
          )}
          <div className={`${UI_PANEL} flex items-center gap-1.5 px-2 py-1`}>
            {renderingMode === 'ball-stick' && <IconModeBallStick />}
            {renderingMode === 'space-filling' && <IconModeSpaceFill />}
            {renderingMode === 'tube' && <IconModeTube />}
            <span className={`${UI_TEXT.small} font-mono text-neutral-300`}>
              {renderingMode === 'ball-stick' ? 'Ball & Stick' : renderingMode === 'space-filling' ? 'Space Fill' : 'Tube Model'}
            </span>
          </div>
        </div>
      </div>

      {/* WebGL 不可用（无 GPU / 远程桌面 / 策略禁用 / 配额耗尽）时直接用 Canvas2D 软件渲染。
          不能靠错误边界兜底：R3F 的失败是 effect 内的异步 unhandled rejection，边界捕获不到，
          只会留下一块 300×150 的空白 canvas（实测）。 */}
      {usingSoftware ? (
        softwareViewer
      ) : (
        <ViewerErrorBoundary fallback={softwareViewer}>
          <Canvas
            camera={{ position: [0, 0, DEFAULT_CAMERA_DISTANCE], fov: CAMERA_FOV_DEG, near: 0.1, far: 1000 }}
            gl={{
              antialias: true,
              alpha: false,
              powerPreference: 'high-performance',
              preserveDrawingBuffer: false,
            }}
            dpr={[1, 2]}
            // demand：仅在数据/交互变化时渲染，避免空闲时持续占满 rAF
            frameloop="demand"
            onCreated={() => setRendererCreated(true)}
            style={{ background: 'transparent' }}
          >
            {/* 深空背景兜底色（雾由 CameraRig 按相机距离动态设置）。GradientBackdrop 紧随其后
                会把 scene.background 覆盖为径向渐变纹理（中心略亮→边缘近黑 + 极淡星点），
                卸载时恢复这个兜底色。它是 WebGL scene.background（全屏背景四边形），
                不是 CSS 层 → 不遮挡交互，导出 PNG 时同帧读回也带上背景。 */}
            <color attach="background" args={[BG_COLOR]} />
            <GradientBackdrop />

            {/* 环境光照 IBL（自建子场景，无网络）为主照明；下方 LightingSystem 已降为补光 */}
            <StudioEnvironment resolution={ENV_RESOLUTION[effectiveQuality]} />
            <LightingSystem />
            {fit && <GridFloor radius={fit.radius} />}
            {/* 接触阴影：分子底部落在地面上的柔和暗影；低档关闭，frames={1} 不强制持续重绘 */}
            {fit && (
              <MoleculeContactShadows
                radius={fit.radius}
                quality={effectiveQuality}
                captureKey={shadowCaptureKey}
              />
            )}

            <ContextLossHandler />
            <SceneInvalidator mode={renderingMode} atoms={safeAtoms} />
            <AutoRotateDriver enabled={autoRotate} />
            {/* 弱 GPU 兜底看门狗：渲染器字符串被屏蔽时靠首帧耗时触发降档；正常 GPU 不触发 */}
            <PerfWatchdog enabled={!weakGpu} onSlow={handleWeakGpu} />

            <OrbitControls
              makeDefault
              enableRotate={true}
              enableZoom={true}
              enablePan={true}
              autoRotate={autoRotate}
              autoRotateSpeed={AUTO_ROTATE_SPEED_WEBGL}
              dampingFactor={0.08}
              zoomSpeed={0.8}
              rotateSpeed={0.6}
            />

            {fit && (
              <CameraRig
                atoms={safeAtoms}
                fit={fit}
                basis={basis}
                renderingMode={renderingMode}
                resetSignal={resetSignal}
                onRegisterApi={registerViewApi}
              />
            )}

            {/* 质心平移到原点（外层 position）→ 再应用主轴定向（内层 quaternion），两者串联且不重复平移：
                外层 world = T(-center)，内层 world = T(-center)·R，
                所以世界坐标 = R·(atom − center)，与软件路径逐原子计算完全一致。
                注意：把 position 与 quaternion 放在同一个 group 上会变成 R·atom − center（旋转没有绕质心），
                两条路径的分子会错位——必须嵌套。 */}
            <group position={fit ? [-fit.center[0], -fit.center[1], -fit.center[2]] : [0, 0, 0]}>
              <group quaternion={modelQuaternion ?? undefined}>
                {renderingMode === 'ball-stick' && <BallAndStickModel atoms={safeAtoms} bonds={safeBonds} quality={effectiveQuality} />}
                {renderingMode === 'space-filling' && <SpaceFillingModel atoms={safeAtoms} quality={effectiveQuality} />}
                {renderingMode === 'tube' && <TubeModel atoms={safeAtoms} bonds={safeBonds} quality={effectiveQuality} />}
                {/* 结构标注层：Html 把标签 portal 到 canvas 之外的 DOM，锚定在原子世界坐标上
                    （继承本 group 的质心平移 + 主轴定向 quaternion，随分子旋转）。独立 overlay，
                    不进入 WebGL 帧缓冲 → PNG 导出与门禁读到的 canvas 像素完全不变。 */}
                {annotationLevel !== 'off' && (
                  <AnnotationLabels3D
                    labels={structureLabels}
                    atoms={safeAtoms}
                    tooltipBuilder={buildTooltip}
                  />
                )}
              </group>
            </group>
          </Canvas>
        </ViewerErrorBoundary>
      )}

      {/* ── 底部控制区：统一归拢到右下角，纵向堆叠（导出提示 → 图例 popover → 控制栏）──────
          原「左下图例 + 左下软件徽标 + 右下工具条 + 导出提示」四散浮层归拢为一组 anchored 控件；
          图例从控制栏弹出（popover 风格），左下角不再留孤立浮层。pointer-events-none 让空白穿透。 */}
      <div className="pointer-events-none absolute bottom-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-col items-end gap-2">
        {/* 导出结果提示（统一 toast 样式，置于控制栏上方，不遮挡分子中心） */}
        {exportHint && (
          <div
            role="status"
            className={`${UI_PANEL} px-2 py-1 ${UI_TEXT.small} font-medium text-neutral-200`}
          >
            {exportHint}
          </div>
        )}

        {/* 元素图例：从控制栏「图例」按钮弹出的 anchored popover（按当前分子真实原子统计） */}
        {legendOpen && (
          <div
            role="group"
            aria-label="元素图例"
            className={`${UI_PANEL} flex max-w-full flex-col gap-1 px-2 py-1.5`}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className={`${UI_TEXT.micro} font-mono uppercase tracking-wider text-neutral-500 select-none`}>
              元素图例
            </span>
            <div className="flex flex-wrap gap-x-2 gap-y-1">
              {legend.map((entry) => (
                <span
                  key={entry.symbol}
                  className={`flex items-center gap-1 font-mono leading-4 text-neutral-300 ${UI_TEXT.small}`}
                  title={`${entry.symbol}：${entry.count} 个原子`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm border border-black/40"
                    style={{ backgroundColor: entry.color }}
                    aria-hidden="true"
                  />
                  <span>{entry.symbol}</span>
                  <span className="text-neutral-500">{entry.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 控制栏：画质档位 ‖ 旋转 / 复位 / 全屏 / PNG ‖ 图例开关 */}
        <div
          className={`${UI_PANEL} flex items-center gap-0.5 p-1`}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* 画质档位：低/中/高（默认高）。控制环境贴图分辨率、接触阴影、菲涅尔边缘光、
              半色键与球体细分等开销大的特性；低档可明显省性能。仅存组件 state，不持久化。
              弱 GPU（软件渲染）下已自动强制 low 并禁用本组按钮，避免用户切到高档再卡死。 */}
          <div
            className={`flex items-center gap-0.5 pr-1 ${weakGpu ? 'opacity-50' : ''}`}
            role="group"
            aria-label="渲染画质"
            aria-disabled={weakGpu}
            title={weakGpu ? '当前为软件/弱 GPU 渲染，已自动降低画质以保障交互流畅' : undefined}
          >
            <span className={`${UI_TEXT.micro} font-mono text-neutral-500 select-none flex items-center gap-1`}>
              <IconQuality />
              画质
            </span>
            {QUALITY_ORDER.map((q) => (
              <ToolbarButton
                key={q}
                label={QUALITY_LABEL[q]}
                title={
                  weakGpu ? '当前为软件/弱 GPU 渲染，已自动降低画质以保障交互流畅'
                    : q === 'high' ? '高画质：环境反射 + 接触阴影 + 边缘光 + 高细分（默认）'
                      : q === 'medium' ? '中画质：保留环境反射与边缘光，降低细分与阴影分辨率'
                        : '低画质：关闭接触阴影与边缘光、最低细分（性能优先）'
                }
                ariaLabel={`画质${QUALITY_LABEL[q]}`}
                active={effectiveQuality === q}
                onClick={() => setQuality(q)}
              />
            ))}
          </div>
          <span className={UI_DIVIDER} aria-hidden="true" />
          <ToolbarButton
            label=""
            icon={<IconRotate />}
            title={autoRotate ? '关闭自动旋转' : '开启自动旋转：绕分子主轴匀速旋转'}
            ariaLabel={autoRotate ? '关闭自动旋转' : '开启自动旋转'}
            active={autoRotate}
            onClick={() => setAutoRotate((v) => !v)}
          />
          <ToolbarButton
            label=""
            icon={<IconReset />}
            title="复位视角：回到默认朝向与自动取景"
            ariaLabel="复位视角"
            onClick={handleResetView}
          />
          <ToolbarButton
            label=""
            icon={<IconFullscreen />}
            title={isFullscreen ? '退出全屏' : '全屏查看分子'}
            ariaLabel={isFullscreen ? '退出全屏' : '全屏查看分子'}
            onClick={() => { void toggleFullscreen(); }}
          />
          {/* 导出按钮保留可见文字「PNG」：视觉回归用 text=PNG 定位并触发真实下载 */}
          <ToolbarButton
            label="PNG"
            icon={<IconDownload />}
            title="导出当前视角为 PNG 图片（文件名 molecule-3d-时间戳.png）"
            ariaLabel="导出当前视角为 PNG 图片"
            onClick={() => { void handleExportPng(); }}
          />
          <span className={UI_DIVIDER} aria-hidden="true" />
          <ToolbarButton
            label="图例"
            icon={<IconLegend />}
            title={legendOpen ? '折叠元素图例' : '展开元素图例（按当前分子真实原子统计）'}
            ariaLabel={legendOpen ? '折叠元素图例' : '展开元素图例'}
            active={legendOpen}
            onClick={() => setLegendOpen((v) => !v)}
          />
          <span className={UI_DIVIDER} aria-hidden="true" />
          {/* 结构标注开关：off → 残基级（默认）→ 原子级（主链 N/CA/C/O + 功能基）→ off。
              默认「残基级」克制（只 N端/C端/残基编号），不外扩、不满屏标签。 */}
          <ToolbarButton
            label={annotationLevel === 'off' ? '标注' : annotationLevel === 'residue' ? '标注·残基' : '标注·原子'}
            icon={<IconAnnotation />}
            title={
              annotationLevel === 'off'
                ? '开启结构标注：显示 N端/C端与残基编号（基于原子连接性推断，身份待验证时不猜名）'
                : annotationLevel === 'residue'
                  ? '升级到原子级标注：追加主链 N/CA/C/O 与关键功能基'
                  : '关闭结构标注'
            }
            ariaLabel={
              annotationLevel === 'off' ? '开启结构标注'
                : annotationLevel === 'residue' ? '升级到原子级结构标注' : '关闭结构标注'
            }
            active={annotationLevel !== 'off'}
            onClick={() =>
              setAnnotationLevel((v) => (v === 'off' ? 'residue' : v === 'residue' ? 'atom' : 'off'))
            }
          />
        </div>
      </div>
    </div>
  );
}

export default MoleculeViewer3D;
