'use client';
import HeroParticles from './HeroParticles';
import RobotViewer from './RobotViewer';

export default function HeroScene() {
  return (
    <div className="hero-scene">
      <HeroParticles className="hero-particles" />
      <div className="hero-robot">
        <RobotViewer />
      </div>
    </div>
  );
}
