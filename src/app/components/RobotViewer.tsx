'use client';
import { Suspense, useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// Drag-to-rotate: robot rotates only when user clicks and drags on the canvas
function useDragRotation() {
  const [isDragging, setIsDragging] = useState(false);
  const rotation = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    lastPos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    rotation.current.y += dx * 0.005;
    rotation.current.x += dy * 0.003;
    // Clamp vertical rotation to prevent flipping
    rotation.current.x = Math.max(-0.3, Math.min(0.3, rotation.current.x));
    lastPos.current = { x: e.clientX, y: e.clientY };
  }, [isDragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }, []);

  return { isDragging, rotation, onPointerDown, onPointerMove, onPointerUp };
}

function Robot({ dragRotation }: { dragRotation: React.RefObject<{ x: number; y: number }> }) {
  const { scene } = useGLTF('/models/robot.glb');
  const group = useRef<THREE.Group>(null);

  useEffect(() => {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const mat = child.material as THREE.MeshStandardMaterial;
        if (mat.isMeshStandardMaterial) {
          mat.metalness = 0.6;
          mat.roughness = 0.35;
        }
      }
    });
  }, [scene]);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const dragY = dragRotation.current?.y ?? 0;
    const dragX = dragRotation.current?.x ?? 0;

    // Base rotation: calibrated from real browser (2026-03-20)
    const baseY = -0.1389;
    const baseX = 0.3099;
    const targetY = baseY + dragY;
    const targetX = baseX + (-dragX);
    // Subtle idle bob
    const idle = Math.sin(clock.elapsedTime * 0.8) * 0.01;

    group.current.rotation.y += (targetY - group.current.rotation.y) * 0.08;
    group.current.rotation.x += (targetX + idle - group.current.rotation.x) * 0.08;
    // Gentle vertical float
    group.current.position.y = Math.sin(clock.elapsedTime * 1.0) * 0.02;
  });

  return (
    <group ref={group} rotation={[0.3099, -0.1389, 0]}>
      <primitive object={scene} scale={1.95} position={[0, -0.15, 0]} rotation={[-0.23, -Math.PI / 2 - 0.14, 0]} />
    </group>
  );
}

export default function RobotViewer() {
  const { isDragging, rotation, onPointerDown, onPointerMove, onPointerUp } = useDragRotation();

  return (
    <Canvas
      camera={{ position: [0, 0.1, 2.6], fov: 50 }}
      shadows
      gl={{ antialias: true, alpha: true }}
      style={{ background: 'transparent', cursor: isDragging ? 'grabbing' : 'grab' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      <Suspense fallback={null}>
        {/* Strong ambient so robot is well-lit against dark site */}
        <ambientLight intensity={1.3} />

        {/* Key light — bright from upper-front-right */}
        <directionalLight position={[3, 5, 4]} intensity={4.5} castShadow />

        {/* Fill light — from left to soften shadows */}
        <directionalLight position={[-4, 3, 2]} intensity={1.5} />

        {/* Rim light — cyan glow from behind, outlines robot against dark bg */}
        <pointLight position={[-2, 2, -3]} color="#00d4ff" intensity={3.0} distance={15} />

        {/* Accent — purple from right-back */}
        <pointLight position={[3, 1, -2]} color="#b24bf3" intensity={1.5} distance={12} />

        {/* Front fill — ensures face/visor is visible */}
        <pointLight position={[0, 1, 3]} color="#ffffff" intensity={0.5} distance={8} />

        <Robot dragRotation={rotation} />
        <ContactShadows position={[0, -0.3, 0]} opacity={0.35} scale={4} blur={2.5} far={1.5} />
      </Suspense>
    </Canvas>
  );
}
