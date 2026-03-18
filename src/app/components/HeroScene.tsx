'use client';

import { useRef, useEffect } from 'react';
import HeroRobot from './HeroRobot';
import HeroParticles from './HeroParticles';

export default function HeroScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRaw = useRef({ x: 0, y: 0 });
  const mouseSmooth = useRef({ x: 0, y: 0 });
  const rafId = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Skip mouse tracking on mobile
    const isMobile = window.innerWidth < 768;
    if (isMobile) return;

    function onMouseMove(e: MouseEvent) {
      // Normalize to [-1, 1] relative to viewport center
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = (e.clientY / window.innerHeight) * 2 - 1;
      mouseRaw.current = { x, y };
    }

    function loop() {
      const lerp = 0.08;
      mouseSmooth.current.x += (mouseRaw.current.x - mouseSmooth.current.x) * lerp;
      mouseSmooth.current.y += (mouseRaw.current.y - mouseSmooth.current.y) * lerp;

      if (container) {
        container.style.setProperty('--mouse-x', mouseSmooth.current.x.toFixed(4));
        container.style.setProperty('--mouse-y', mouseSmooth.current.y.toFixed(4));
      }

      rafId.current = requestAnimationFrame(loop);
    }

    window.addEventListener('mousemove', onMouseMove);
    rafId.current = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      cancelAnimationFrame(rafId.current);
    };
  }, []);

  return (
    <div className="hero-scene" ref={containerRef} style={{ '--mouse-x': '0', '--mouse-y': '0' } as React.CSSProperties}>
      <HeroParticles className="hero-particles" />
      <HeroRobot className="hero-robot" />
    </div>
  );
}
