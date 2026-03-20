'use client';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(ScrollTrigger);

export default function AnimationInit() {
  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add('(prefers-reduced-motion: no-preference)', () => {
      // Hero content entrance
      gsap.fromTo('.hero-content > *',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.5, stagger: 0.1, ease: 'power2.out', delay: 0.3 }
      );

      // Project card stagger (2 grids)
      document.querySelectorAll('.projects-grid').forEach(grid => {
        gsap.fromTo(
          grid.querySelectorAll('.project-card'),
          { y: 60, opacity: 0 },
          {
            y: 0, opacity: 1, stagger: 0.15, duration: 0.7,
            ease: 'power2.out',
            scrollTrigger: { trigger: grid, start: 'top 80%' },
          }
        );
      });
    });
  });

  return null;
}
