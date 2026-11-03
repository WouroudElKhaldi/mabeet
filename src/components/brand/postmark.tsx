import { clsx } from "clsx";
import { useId } from "react";

/** A round postmark ("MABEET · LEBANON · BOOK DIRECT"), the brand's travel-stamp signature. Decorative. */
export function Postmark({ className, spin = false }: { className?: string; spin?: boolean }) {
  const pathId = useId();
  return (
    <svg viewBox="0 0 120 120" className={clsx("text-accent", className)} aria-hidden>
      <defs>
        <path id={pathId} d="M60 60 m-44 0 a44 44 0 1 1 88 0 a44 44 0 1 1 -88 0" />
      </defs>
      <circle cx="60" cy="60" r="57" className="fill-none stroke-current" strokeWidth="2" />
      <circle
        cx="60"
        cy="60"
        r="34"
        className="fill-none stroke-current"
        strokeWidth="1.5"
        strokeDasharray="3 4"
      />
      <g className={clsx(spin && "stamp-spin")} style={{ transformOrigin: "60px 60px" }}>
        <text className="fill-current" style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.22em" }}>
          <textPath href={`#${pathId}`}>MABEET · LEBANON · BOOK DIRECT ·</textPath>
        </text>
      </g>
      <path
        d="M47 74V58a13 13 0 0 1 26 0v16"
        className="fill-none stroke-current"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M54 74v-9a6 6 0 0 1 12 0v9" className="fill-current" />
    </svg>
  );
}
