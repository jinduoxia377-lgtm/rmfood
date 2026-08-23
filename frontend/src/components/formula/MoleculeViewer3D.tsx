// @ts-nocheck
/**
 * MoleculeViewer3D — 3D 分子结构查看器
 * Three.js JSX 类型与 @react-three/fiber 冲突，使用 @ts-nocheck 降级处理
 */
import React, { useState, useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Html } from '@react-three/drei'
import * as THREE from 'three'

interface MoleculeProps {
  structure: Array<{ x: number; y: number; z: number; type: string }>
  bonds: Array<[number, number]>
}

function Molecule({ structure, bonds }: MoleculeProps) {
  const groupRef = useRef<any>(null)

  useFrame((_state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.005
    }
  })

  const atomColors: Record<string, string> = {
    C: '#666666', H: '#FFFFFF', O: '#FF0000', N: '#0000FF',
    P: '#FF8C00', S: '#FFFF00'
  }

  return (
    <group ref={groupRef}>
      {structure.map((atom, i) => (
        // @ts-ignore
        <mesh key={i} position={[atom.x, atom.y, atom.z]}>
          {/* @ts-ignore */}
          <sphereGeometry args={[0.3, 16, 16]} />
          {/* @ts-ignore */}
          <meshStandardMaterial color={atomColors[atom.type] || '#888888'} />
        </mesh>
      ))}
      {bonds.map(([i, j], k) => (
        // @ts-ignore
        <line key={k}>
          {/* @ts-ignore */}
          <bufferGeometry>
            {/* @ts-ignore */}
            <float32BufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                structure[i].x, structure[i].y, structure[i].z,
                structure[j].x, structure[j].y, structure[j].z
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          {/* @ts-ignore */}
          <lineBasicMaterial color="#444444" />
        </line>
      ))}
    </group>
  )
}

export function MoleculeViewer3D({ structure, bonds }: MoleculeProps & { structure: any, bonds: any }) {
  return (
    <div className="w-full h-96 rounded-lg overflow-hidden">
      <Canvas camera={{ position: [0, 0, 10], fov: 50 }}>
        {/* @ts-ignore */}
        <ambientLight intensity={0.5} />
        {/* @ts-ignore */}
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <Molecule structure={structure} bonds={bonds} />
        {/* @ts-ignore */}
        <OrbitControls enableZoom={true} enablePan={false} />
      </Canvas>
      <div className="p-4 bg-white rounded-b-lg">
        <p className="text-sm text-gray-600">拖拽旋转查看分子结构</p>
      </div>
    </div>
  )
}
