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
        <img src="/images/robot-head-0.webp" alt="" className="robot-head robot-head-0" draggable={false} />
        <img src="/images/robot-head-1.webp" alt="" className="robot-head robot-head-1" draggable={false} />
        <img src="/images/robot-head-2.webp" alt="AI Construction Robot" className="robot-head robot-head-2" draggable={false} />
        <img src="/images/robot-head-3.webp" alt="" className="robot-head robot-head-3" draggable={false} />
        <img src="/images/robot-head-4.webp" alt="" className="robot-head robot-head-4" draggable={false} />
      </div>
    </div>
  );
}
