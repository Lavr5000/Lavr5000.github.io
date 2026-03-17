export default function HeroRobot({ className }: { className?: string }) {
  return (
    <div className={`robot-3d-container ${className || ''}`}>
      <div className="robot-3d-card">
        <picture>
          <source srcSet="/robot/robot-hero.webp" type="image/webp" />
          <img
            className="robot-image"
            src="/robot/robot-hero.png"
            alt="AI construction robot"
            width={896}
            height={1200}
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </picture>
        <div className="robot-lighting" />
      </div>
      <div className="robot-eye-glow robot-eye-left" />
      <div className="robot-eye-glow robot-eye-right" />
      <div className="robot-hologram-glow" />
    </div>
  );
}
