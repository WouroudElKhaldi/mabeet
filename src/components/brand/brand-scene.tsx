"use client";

import { clsx } from "clsx";
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { ReactNode } from "react";
import { useEffect, useRef } from "react";

const SPRING = { stiffness: 90, damping: 20, mass: 0.8 };
// After this long without the mouse moving, the scene sways by itself so it never looks frozen.
const IDLE_AFTER_MS = 2500;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

/**
 * The brand art as a small 3D scene: the whole group leans toward the mouse wherever it is on the page, and every
 * layer inside slides by its own depth (`SceneLayer`, and the hills and sun inside `PlaceArt`, which read `--px` and
 * `--py`, from -1 to 1). Still on touch screens except for a slow sway, and fully still for reduced motion.
 */
export function BrandScene({
  children,
  className,
  maxDegrees = 10,
}: {
  children: ReactNode;
  className?: string;
  maxDegrees?: number;
}) {
  const reduceMotion = useReducedMotion();
  const scene = useRef<HTMLDivElement>(null);
  const lastMove = useRef(0);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, SPRING);
  const py = useSpring(pointerY, SPRING);
  const rotateY = useTransform(px, [-1, 1], [-maxDegrees, maxDegrees]);
  const rotateX = useTransform(py, [-1, 1], [maxDegrees * 0.7, -maxDegrees * 0.7]);

  useEffect(() => {
    if (reduceMotion) return;
    const follow = (event: PointerEvent) => {
      if (event.pointerType !== "mouse" || !scene.current) return;
      const box = scene.current.getBoundingClientRect();
      lastMove.current = performance.now();
      pointerX.set(clamp((event.clientX - (box.left + box.width / 2)) / (window.innerWidth / 2)));
      pointerY.set(clamp((event.clientY - (box.top + box.height / 2)) / (window.innerHeight / 2)));
    };
    window.addEventListener("pointermove", follow);
    return () => window.removeEventListener("pointermove", follow);
  }, [reduceMotion, pointerX, pointerY]);

  // The layers read the lean as CSS variables, so even an SVG's hills can follow it without React drawing again.
  useMotionValueEvent(px, "change", (value) => scene.current?.style.setProperty("--px", value.toFixed(4)));
  useMotionValueEvent(py, "change", (value) => scene.current?.style.setProperty("--py", value.toFixed(4)));

  useAnimationFrame((time) => {
    if (reduceMotion || performance.now() - lastMove.current < IDLE_AFTER_MS) return;
    const seconds = time / 1000;
    pointerX.set(Math.sin(seconds * 0.45) * 0.35);
    pointerY.set(Math.cos(seconds * 0.32) * 0.25);
  });

  return (
    <div ref={scene} className={clsx("[perspective:1100px]", className)}>
      <motion.div className="relative [transform-style:preserve-3d]" style={{ rotateX, rotateY }}>
        {children}
      </motion.div>
    </div>
  );
}

const ENTRANCES = {
  rise: { initial: { opacity: 0, y: 70, scale: 0.94 }, delay: 0.1 },
  drop: { initial: { opacity: 0, y: -140, rotate: 16 }, delay: 0.55 },
  stamp: { initial: { opacity: 0, scale: 2.2, rotate: -50 }, delay: 1 },
} as const;

/**
 * One layer of a `BrandScene`. `depth` (in pixels) brings it toward the viewer: it slides further as the scene leans,
 * so the front cards move more than the window behind. `enter` is how it arrives when the page opens.
 */
export function SceneLayer({
  children,
  className,
  depth = 0,
  enter,
}: {
  children: ReactNode;
  className?: string;
  depth?: number;
  enter?: keyof typeof ENTRANCES;
}) {
  const reduceMotion = useReducedMotion();
  const entrance = enter ? ENTRANCES[enter] : null;
  return (
    <motion.div
      className={className}
      style={{ z: depth }}
      // The same first frame on the server and in the browser (the server cannot know the visitor's motion setting):
      // for reduced motion the entrance simply takes no time.
      initial={entrance ? entrance.initial : false}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : { type: "spring", stiffness: 120, damping: 14, delay: entrance?.delay ?? 0 }
      }
    >
      <div
        style={{ translate: `calc(var(--px, 0) * ${depth * 0.22}px) calc(var(--py, 0) * ${depth * 0.16}px)` }}
      >
        {children}
      </div>
    </motion.div>
  );
}

/** Light sliding across a card as the scene leans, as on a glossy ticket. Put it last inside the card. */
export function Sheen({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={clsx("pointer-events-none absolute inset-0 rounded-[inherit]", className)}
      style={{
        background:
          "radial-gradient(circle at calc(50% + var(--px, 0) * 60%) calc(35% + var(--py, 0) * 60%), " +
          "color-mix(in srgb, var(--surface) 70%, transparent), transparent 55%)",
        mixBlendMode: "soft-light",
      }}
    />
  );
}
