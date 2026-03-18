export default function HeroRobot({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="robot-layer robot-layer-legs">
        <img src="/images/robot-layer-0.webp" alt="" draggable={false} />
      </div>
      <div className="robot-layer robot-layer-torso">
        <img src="/images/robot-layer-1.webp" alt="" draggable={false} />
      </div>
      <div className="robot-layer robot-layer-head">
        <img src="/images/robot-layer-2.webp" alt="AI Construction Robot" draggable={false} />
      </div>
    </div>
  );
}
