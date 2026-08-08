'use client';

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshWobbleMaterial, OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';

interface VinylProps {
  coverUrl: string;
  isPlaying: boolean;
}

function VinylDisc({ coverUrl, isPlaying }: VinylProps) {
  const vinylRef = useRef<THREE.Group>(null);
  const texture = useTexture(coverUrl);

  useFrame((state, delta) => {
    if (vinylRef.current && isPlaying) {
      vinylRef.current.rotation.z -= delta * 1.5;
    }
  });

  return (
    <group ref={vinylRef} rotation={[Math.PI / 4, 0, 0]}>
      {/* Vinyl Outer Disc */}
      <mesh receiveShadow castShadow>
        <cylinderGeometry args={[2.5, 2.5, 0.08, 64]} />
        <meshStandardMaterial
          color="#0d0d0f"
          roughness={0.2}
          metalness={0.9}
        />
      </mesh>

      {/* Grooves Rings */}
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 2.4, 64]} />
        <meshStandardMaterial color="#1a1a1e" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Center Album Art Label */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.8, 64]} />
        <meshStandardMaterial map={texture} roughness={0.4} />
      </mesh>

      {/* Spindle Hole */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.1, 32]} />
        <meshStandardMaterial color="#ffffff" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}

function ParticleField() {
  const count = 120;
  const pointsRef = useRef<THREE.Points>(null);

  const positions = React.useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      pos[i] = (Math.random() - 0.5) * 12;
    }
    return pos;
  }, []);

  useFrame((state, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.05;
      pointsRef.current.rotation.x += delta * 0.02;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#EF233C"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function VinylRecordScene({ coverUrl, isPlaying }: VinylProps) {
  return (
    <div className="w-full h-[280px] md:h-[360px] relative rounded-3xl overflow-hidden glass-card">
      <div className="absolute top-4 left-6 z-10 bg-white/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/80 text-xs font-semibold text-slate-800 flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></span>
        RaagaX 3D Vinyl Experience
      </div>

      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[5, 8, 5]} intensity={1.5} color="#ffffff" castShadow />
        <pointLight position={[-4, -4, 2]} intensity={1.2} color="#EF233C" />
        
        <Float speed={2} rotationIntensity={0.4} floatIntensity={0.6}>
          <React.Suspense fallback={null}>
            <VinylDisc coverUrl={coverUrl} isPlaying={isPlaying} />
          </React.Suspense>
        </Float>

        <ParticleField />
        <OrbitControls enableZoom={false} autoRotate={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 4} />
      </Canvas>

      <div className="absolute bottom-4 right-6 text-[10px] text-slate-500 tracking-wider uppercase backdrop-blur-sm px-2 py-1 rounded-md bg-white/40">
        Drag to rotate 3D vinyl
      </div>
    </div>
  );
}
