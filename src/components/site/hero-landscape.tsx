/**
 * Mount Lebanon at dusk, drawn in the active palette: ridges, a cedar line and a low sun.
 * Pure SVG so it themes instantly and costs no image bytes.
 */
export function HeroLandscape() {
  return (
    <svg
      viewBox="0 0 1440 560"
      preserveAspectRatio="xMidYMax slice"
      className="pointer-events-none absolute inset-0 size-full"
      aria-hidden
    >
      <circle
        cx="1040"
        cy="250"
        r="120"
        className="fill-glow opacity-30 motion-safe:animate-[drift_18s_ease-in-out_infinite]"
      />
      <circle cx="1040" cy="250" r="64" className="fill-glow opacity-60" />
      <path
        d="M0 360 C 160 300 260 250 400 280 S 640 200 780 240 S 1060 180 1200 230 S 1380 260 1440 240 V560 H0Z"
        className="fill-accent opacity-[0.16]"
      />
      <path
        d="M0 420 C 120 380 240 330 380 360 S 600 300 760 340 S 1020 290 1180 330 S 1360 360 1440 340 V560 H0Z"
        className="fill-accent opacity-30"
      />
      <g className="fill-accent opacity-55">
        {[120, 168, 214, 1210, 1262, 1318, 1366].map((x, index) => (
          <path
            key={x}
            d={`M${x} ${400 - (index % 3) * 8} l-14 22 h8 l-12 18 h10 l-14 20 h44 l-14 -20 h10 l-12 -18 h8z`}
          />
        ))}
      </g>
      <path
        d="M0 470 C 200 430 360 420 520 445 S 860 470 1040 440 S 1320 430 1440 450 V560 H0Z"
        className="fill-paper"
      />
    </svg>
  );
}
