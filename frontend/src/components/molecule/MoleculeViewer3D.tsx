/**
 * MoleculeViewer3D - 分子三维可视化组件
 * 使用 React Three Fiber 渲染 RDKit 生成的 3D 分子坐标
 * 专业科学皮肤：深空主题 + PBR物理材质 + 环境光遮蔽
 * @ts-ignore R3F JSX类型声明与@types/three版本不兼容，运行时正常
 */
// @ts-nocheck
import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';

// ─── CPK 配色方案（科学可视化标准） ──────────────────────────
const CPK: Record<string, string> = {
  H: '#F0F0F0', C: '#555555', N: '#4090FF', O: '#FF3030',
  F: '#90D000', P: '#FF8000', S: '#FFFF30', Cl: '#1FF01F',
  Br: '#A62929', I: '#940094',
};

// 元素原子半径（范德华半径，Å → 渲染单位）
const RADIUS: Record<string, number> = {
  H: 0.45, C: 0.90, N: 0.85, O: 0.80,
  F: 0.75, P: 1.10, S: 1.05, Cl: 1.00,
  Br: 1.15, I: 1.35,
};

// ─── 主题色板 ────────────────────────────────────────────────
const BOND_COLOR = '#4a6fa5';
const BOND_EMISSIVE = '#1a3a6a';
const THEME_METALNESS = 0.65;
const THEME_ROUGHNESS = 0.25;
const THEME_CLEARCOAT = 0.4;
const THEME_CLEARCOAT_ROUGH = 0.15;

interface Atom {
  element: string; x: number; y: number; z: number; atomic_num: number;
}
interface Bond {
  start: number; end: number; type: string;
}
interface Props {
  atoms: Atom[]; bonds: Bond[];
  renderingMode?: 'ball-stick' | 'space-filling' | 'tube';
  className?: string;
}

// ─── 光照系统 ────────────────────────────────────────────────
function LightingSystem() {
  return (
    <>
      <directionalLight position={[8, 12, 6]} intensity={1.2} color="#e8f0ff" />
      <directionalLight position={[-6, 4, -4]} intensity={0.5} color="#8ab4ff" />
      <directionalLight position={[0, -8, 2]} intensity={0.3} color="#4060a0" />
      <ambientLight intensity={0.25} color="#c0d8ff" />
      <pointLight position={[5, 5, 8]} intensity={0.6} distance={30} />
      <hemisphereLight skyColor="#1a3060" groundColor="#0a0a1a" intensity={0.3} />
    </>
  );
}

// ─── 网格地面（使用 GridHelper，42 条线而非 1764 个 mesh）────────
function GridFloor() {
  return <gridHelper args={[40, 40, 0x3c78ff, 0x1a3a6a]} position={[0, -3.5, 0]} />;
}

// ─── 球棍模型（PBR物理材质） ─────────────────────────────────
function BallAndStickModel({ atoms, bonds }: { atoms: Atom[]; bonds: Bond[] }) {
  // 预计算键的几何信息
  const bondInfo = useMemo(() => {
    const result: Array<{
      key: string; mid: [number, number, number]; len: number;
      isDouble: boolean; isTriple: boolean; thickness: number;
    }> = [];
    bonds.forEach(b => {
      const a1 = atoms[b.start]; const a2 = atoms[b.end];
      if (!a1 || !a2) return;
      const dx = a2.x - a1.x, dy = a2.y - a1.y, dz = a2.z - a1.z;
      const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (len < 0.01) return;
      const isDouble = b.type?.toLowerCase() === 'double';
      const isTriple = b.type?.toLowerCase() === 'triple';
      const thickness = isTriple ? 0.10 : isDouble ? 0.08 : 0.055;
      result.push({
        key: `${b.start}-${b.end}`,
        mid: [(a1.x+a2.x)/2, (a1.y+a2.y)/2, (a1.z+a2.z)/2],
        len, isDouble, isTriple, thickness,
      });
    });
    return result;
  }, [atoms, bonds]);

  return (
    <group>
      {/* 原子 */}
      {atoms.map((atom, idx) => {
        const r = Math.max(RADIUS[atom.element] || 0.5, 0.2);
        return (
          <mesh key={`a-${idx}`} position={[atom.x, atom.y, atom.z]}>
            <sphereGeometry args={[r, 24, 24]} />
            <meshStandardMaterial
              color={CPK[atom.element] || '#888888'}
              metalness={THEME_METALNESS}
              roughness={THEME_ROUGHNESS}
              clearcoat={THEME_CLEARCOAT}
              clearcoatRoughness={THEME_CLEARCOAT_ROUGH}
              reflectivity={0.8}
            />
          </mesh>
        );
      })}
      {/* 键 */}
      {bondInfo.map(b => (
        <mesh key={b.key} position={b.mid}>
          <cylinderGeometry args={[b.thickness, b.thickness, b.len, 10]} />
          <meshStandardMaterial
            color={BOND_COLOR}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── 空间填充模型（玻璃质感） ───────────────────────────────
function SpaceFillingModel({ atoms }: { atoms: Atom[] }) {
  return (
    <group>
      {atoms.map((atom, idx) => {
        const r = RADIUS[atom.element] || 0.5;
        return (
          <mesh key={`sf-${idx}`} position={[atom.x, atom.y, atom.z]}>
            <sphereGeometry args={[r, 28, 28]} />
            <meshStandardMaterial
              color={CPK[atom.element] || '#888888'}
              metalness={0.1}
              roughness={0.15}
              clearcoat={1.0}
              clearcoatRoughness={0.05}
              reflectivity={1.0}
            />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── 管线模型（简洁科技风） ──────────────────────────────────
function TubeModel({ atoms, bonds }: { atoms: Atom[]; bonds: Bond[] }) {
  return (
    <group>
      {atoms.map((atom, idx) => (
        <mesh key={`t-a-${idx}`} position={[atom.x, atom.y, atom.z]}>
          <sphereGeometry args={[0.18, 12, 12]} />
          <meshStandardMaterial
            color={CPK[atom.element] || '#888888'}
            metalness={THEME_METALNESS}
            roughness={THEME_ROUGHNESS}
            clearcoat={0.5}
          />
        </mesh>
      ))}
      {bonds.map((bond, idx) => {
        const a1 = atoms[bond.start]; const a2 = atoms[bond.end];
        if (!a1 || !a2) return null;
        const dx = a2.x - a1.x, dy = a2.y - a1.y, dz = a2.z - a1.z;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (len < 0.01) return null;
        return (
          <mesh key={`t-b-${idx}`} position={[(a1.x+a2.x)/2, (a1.y+a2.y)/2, (a1.z+a2.z)/2]}>
            <cylinderGeometry args={[0.04, 0.04, len, 8]} />
            <meshStandardMaterial color="#5a8fc4" metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

// ─── 主组件 ──────────────────────────────────────────────────
export function MoleculeViewer3D({
  atoms, bonds,
  renderingMode = 'ball-stick',
  className = '',
}: Props) {
  if (!atoms || atoms.length === 0) {
    return (
      <div className={`h-[420px] w-full rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center ${className}`}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
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
          <p className="text-slate-500 text-sm font-medium">暂无分子数据</p>
          <p className="text-slate-600 text-xs mt-1">输入肽序列后自动生成3D结构</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-[420px] w-full rounded-xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative ${className}`}>
      {/* 左上角标签 */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
          3D Structure
        </span>
        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
          {atoms.length} atoms
        </span>
      </div>
      {/* 右上角渲染模式指示 */}
      <div className="absolute top-3 right-3 z-10 text-[10px] font-mono text-slate-500 bg-slate-900/60 px-2 py-1 rounded border border-white/5">
        {renderingMode === 'ball-stick' ? '●○ Ball & Stick' : renderingMode === 'space-filling' ? '● Space Fill' : '│ Tube Model'}
      </div>

      <Canvas
        camera={{ position: [0, 0, 16], fov: 45, near: 0.1, far: 200 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: false,
        }}
        contextLostEventHandler={(e) => {
          e.preventDefault();
          console.warn('[MoleculeViewer3D] WebGL context lost, attempting restore...');
        }}
        contextRestoredEventHandler={() => {
          console.log('[MoleculeViewer3D] WebGL context restored');
        }}
        dpr={[1, 2]}
        style={{ background: 'transparent' }}
      >
        {/* 深空背景 */}
        <color attach="background" args={['#0a0e1a']} />
        {/* 环境雾：增强空间深度感 */}
        <fog attach="fog" args={['#0a0e1a', 20, 60]} />

        <LightingSystem />
        <GridFloor />

        <OrbitControls
          enableRotate={true}
          enableZoom={true}
          enablePan={true}
          minDistance={4}
          maxDistance={40}
          autoRotate={false}
          autoRotateSpeed={0.3}
          dampingFactor={0.08}
          zoomSpeed={0.8}
          rotateSpeed={0.6}
        />

        {renderingMode === 'ball-stick' && <BallAndStickModel atoms={atoms} bonds={bonds} />}
        {renderingMode === 'space-filling' && <SpaceFillingModel atoms={atoms} />}
        {renderingMode === 'tube' && <TubeModel atoms={atoms} bonds={bonds} />}
      </Canvas>
    </div>
  );
}

export default MoleculeViewer3D;
