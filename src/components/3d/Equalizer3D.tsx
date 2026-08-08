'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { AudioEngine } from '@/lib/audioEngine';

interface Equalizer3DProps {
  isPlaying: boolean;
}

function Bars({ isPlaying }: { isPlaying: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const count = 32;
  const barMeshRefs = useRef<THREE.Mesh[]>([]);

  useFrame(() => {
    const dataArray = new Uint8Array(64);
    if (isPlaying) {
      AudioEngine.getInstance().getFrequencyData(dataArray);
    }

    barMeshRefs.current.forEach((mesh, index) => {
      if (mesh) {
        const val = isPlaying ? (dataArray[index * 2] || 20) / 255 : 0.05;
        const targetHeight = Math.max(0.1, val * 3.5);
        mesh.scale.y = THREE.MathUtils.lerp(mesh.scale.y, targetHeight, 0.2);
        mesh.position.y = mesh.scale.y / 2;
      }
    });
  });

  return (
    <group ref={groupRef} position={[-3.5, -1.2, 0]}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) barMeshRefs.current[i] = el;
          }}
          position={[i * 0.23, 0.1, 0]}
        >
          <boxGeometry args={[0.15, 1, 0.15]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? '#EF233C' : '#0F172A'}
            roughness={0.2}
            metalness={0.8}
            emissive={i % 2 === 0 ? '#D90429' : '#000000'}
            emissiveIntensity={isPlaying ? 0.4 : 0.05}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Equalizer3D({ isPlaying }: Equalizer3DProps) {
  return (
    <div className="w-full h-[180px] rounded-2xl overflow-hidden glass-card relative">
      <div className="absolute top-3 left-4 z-10 text-xs font-semibold text-slate-700 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-crimson-500 animate-ping"></span>
        3D Spectrum Equalizer
      </div>
      <Canvas camera={{ position: [0, 0, 4.5], fov: 50 }}>
        <ambientLight intensity={1} />
        <pointLight position={[0, 5, 5]} intensity={1.5} color="#EF233C" />
        <pointLight position={[0, -5, 5]} intensity={0.8} color="#ffffff" />
        <Bars isPlaying={isPlaying} />
      </Canvas>
    </div>
  );
}
