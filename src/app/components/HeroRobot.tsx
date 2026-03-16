export default function HeroRobot({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 300 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="robotGradient" x1="0" y1="0" x2="300" y2="400" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d4ff" />
          <stop offset="1" stopColor="#b24bf3" />
        </linearGradient>
        <radialGradient id="glowBlue" cx="50%" cy="50%" r="50%">
          <stop stopColor="rgba(0,212,255,0.3)" />
          <stop offset="1" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="glowPurple" cx="50%" cy="50%" r="50%">
          <stop stopColor="rgba(178,75,243,0.2)" />
          <stop offset="1" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Layer 0: Glow behind robot */}
      <g className="robot-glow-layer">
        <circle cx="150" cy="180" r="100" fill="url(#glowBlue)" />
        <circle cx="150" cy="240" r="80" fill="url(#glowPurple)" />
      </g>

      {/* Layer 1: Body — trapezoid torso + shoulders + chest indicator */}
      <g className="robot-body">
        <path
          d="M110 220 L100 310 L200 310 L190 220 Z"
          stroke="url(#robotGradient)"
          strokeWidth="2"
          fill="rgba(255,255,255,0.03)"
          strokeLinejoin="round"
        />
        {/* Shoulders */}
        <path
          d="M100 230 L70 245 L75 255 L105 240"
          stroke="url(#robotGradient)"
          strokeWidth="1.5"
          fill="rgba(255,255,255,0.02)"
          strokeLinejoin="round"
        />
        <path
          d="M200 230 L230 245 L225 255 L195 240"
          stroke="url(#robotGradient)"
          strokeWidth="1.5"
          fill="rgba(255,255,255,0.02)"
          strokeLinejoin="round"
        />
        {/* Chest indicator */}
        <circle cx="150" cy="260" r="8" stroke="url(#robotGradient)" strokeWidth="1.5" fill="rgba(0,212,255,0.1)" />
        <circle cx="150" cy="260" r="3" fill="#00d4ff" opacity="0.8" className="robot-chest-pulse" />
        {/* Chest lines */}
        <line x1="125" y1="245" x2="175" y2="245" stroke="url(#robotGradient)" strokeWidth="0.8" opacity="0.3" />
        <line x1="120" y1="280" x2="180" y2="280" stroke="url(#robotGradient)" strokeWidth="0.8" opacity="0.2" />
        <line x1="115" y1="295" x2="185" y2="295" stroke="url(#robotGradient)" strokeWidth="0.8" opacity="0.15" />
      </g>

      {/* Layer 2: Neck */}
      <g className="robot-neck">
        <rect x="138" y="195" width="24" height="30" rx="4" stroke="url(#robotGradient)" strokeWidth="1.5" fill="rgba(255,255,255,0.02)" />
        <line x1="145" y1="200" x2="145" y2="220" stroke="url(#robotGradient)" strokeWidth="0.8" opacity="0.3" />
        <line x1="155" y1="200" x2="155" y2="220" stroke="url(#robotGradient)" strokeWidth="0.8" opacity="0.3" />
      </g>

      {/* Layer 3: Head — rounded rect + side ears */}
      <g className="robot-head">
        <rect x="105" y="120" width="90" height="80" rx="16" stroke="url(#robotGradient)" strokeWidth="2" fill="rgba(255,255,255,0.03)" />
        {/* Left ear */}
        <rect x="92" y="145" width="13" height="30" rx="4" stroke="url(#robotGradient)" strokeWidth="1.5" fill="rgba(255,255,255,0.02)" />
        {/* Right ear */}
        <rect x="195" y="145" width="13" height="30" rx="4" stroke="url(#robotGradient)" strokeWidth="1.5" fill="rgba(255,255,255,0.02)" />
        {/* Forehead line */}
        <line x1="125" y1="132" x2="175" y2="132" stroke="url(#robotGradient)" strokeWidth="0.8" opacity="0.4" />
        {/* Mouth area */}
        <line x1="130" y1="180" x2="170" y2="180" stroke="url(#robotGradient)" strokeWidth="1" opacity="0.3" />
        <circle cx="137" cy="180" r="1.5" fill="#00d4ff" opacity="0.4" />
        <circle cx="150" cy="180" r="1.5" fill="#00d4ff" opacity="0.4" />
        <circle cx="163" cy="180" r="1.5" fill="#00d4ff" opacity="0.4" />
      </g>

      {/* Layer 4: Antenna */}
      <g className="robot-antenna">
        <line x1="150" y1="120" x2="150" y2="90" stroke="url(#robotGradient)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="150" cy="85" r="6" fill="#00d4ff" opacity="0.6" className="robot-antenna-ball" />
        <circle cx="150" cy="85" r="3" fill="#00d4ff" />
      </g>

      {/* Layer 5: Eyes — ovals + pupils */}
      <g className="robot-eyes">
        {/* Left eye socket */}
        <ellipse cx="132" cy="155" rx="14" ry="12" stroke="url(#robotGradient)" strokeWidth="1.5" fill="rgba(0,212,255,0.05)" />
        {/* Right eye socket */}
        <ellipse cx="168" cy="155" rx="14" ry="12" stroke="url(#robotGradient)" strokeWidth="1.5" fill="rgba(0,212,255,0.05)" />
        {/* Left pupil */}
        <circle cx="132" cy="155" r="5" fill="#00d4ff" className="robot-pupil-left" />
        {/* Right pupil */}
        <circle cx="168" cy="155" r="5" fill="#00d4ff" className="robot-pupil-right" />
      </g>
    </svg>
  );
}
