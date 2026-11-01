/**
 * A generated "postcard" for places without photos yet: a stone arch framing hills,
 * varied by the place's name so every listing looks distinct.
 */
function hash(seed: string): number {
  let value = 2166136261;
  for (const char of seed) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}

// In the SVG's own units (the picture is 100 wide): far layers move little, near ones more, the opposite way.
const depthStyle = (units: number) => ({
  translate: `calc(var(--px, 0) * ${units}px) calc(var(--py, 0) * ${units * 0.5}px)`,
});

export function PlaceArt({ seed, className }: { seed: string; className?: string }) {
  const value = hash(seed);
  const ridge = 40 + (value % 30);
  const sunX = 30 + (value % 40);
  const tilt = (value >> 8) % 20;
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" className={className} aria-hidden>
      <rect width="100" height="100" className="fill-surface-2" />
      {/* Inside a BrandScene the sun and the hills slide by their distance (`--px`, `--py`); elsewhere they stay. */}
      <circle cx={sunX} cy={34} r={10} className="fill-glow opacity-70" style={depthStyle(2)} />
      <path
        d={`M-12 ${ridge + 8} H0 Q 30 ${ridge - tilt} 55 ${ridge + 4} T 100 ${ridge - 2} H112 V100 H-12Z`}
        className="fill-accent opacity-25"
        style={depthStyle(-3)}
      />
      <path
        d={`M-12 ${ridge + 22} H0 Q 40 ${ridge + 6} 70 ${ridge + 18} T 100 ${ridge + 12} H112 V100 H-12Z`}
        className="fill-accent opacity-45"
        style={depthStyle(-7)}
      />
      <path d="M0 0 H100 V100 H82 V46 A32 32 0 0 0 18 46 V100 H0Z" className="fill-paper opacity-90" />
    </svg>
  );
}
