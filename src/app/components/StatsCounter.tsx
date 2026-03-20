'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

interface StatsCounterProps {
  value: number | string;
  suffix?: string;
}

export default function StatsCounter({ value, suffix = '' }: StatsCounterProps) {
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    const el = ref.current;

    if (typeof value === 'number') {
      // Numeric counter
      const obj = { val: 0 };
      el.textContent = '0' + suffix;

      gsap.to(obj, {
        val: value,
        duration: 1.5,
        ease: 'power2.out',
        snap: { val: 1 },
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
        },
        onUpdate() {
          el.textContent = `${obj.val}${suffix}`;
        },
      });
    } else if (value === '∞') {
      // Infinity symbol scale-in
      gsap.fromTo(el,
        { scale: 0, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.8,
          ease: 'back.out(1.7)',
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
          },
        }
      );
    }
  }, { scope: ref });

  return (
    <div ref={ref} className="stat-value" style={{ display: 'inline-block' }}>
      {typeof value === 'number' ? `${value}${suffix}` : value}
    </div>
  );
}
