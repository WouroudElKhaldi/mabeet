"use client";

import { clsx } from "clsx";
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import type { PointerEvent, ReactNode } from "react";
import { useRef } from "react";

const SPRING = { stiffness: 160, damping: 18, mass: 0.6 };

/**
 * A card that leans toward the mouse in 3D while it is over it, and springs back flat when it leaves. Like
 * `BrandScene`, it sets `--px` and `--py` (-1 to 1) on itself, so a `Sheen` inside slides with the light and any
 * child can float above the card with `[transform:translateZ(..)]`. Only for a mouse: touch screens and reduced
 * motion get a still card.
 */
export function TiltCard({
  children,
  className,
  maxDegrees = 8,
}: {
  children: ReactNode;
  className?: string;
  maxDegrees?: number;
}) {
  const reduceMotion = useReducedMotion();
  const card = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const px = useSpring(pointerX, SPRING);
  const py = useSpring(pointerY, SPRING);
  const rotateY = useTransform(px, [-1, 1], [-maxDegrees, maxDegrees]);
  const rotateX = useTransform(py, [-1, 1], [maxDegrees, -maxDegrees]);

  useMotionValueEvent(px, "change", (value) => card.current?.style.setProperty("--px", value.toFixed(4)));
  useMotionValueEvent(py, "change", (value) => card.current?.style.setProperty("--py", value.toFixed(4)));

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    if (reduceMotion || event.pointerType !== "mouse") return;
    const box = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - box.left) / box.width) * 2 - 1);
    pointerY.set(((event.clientY - box.top) / box.height) * 2 - 1);
  };
  const rest = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div className="h-full [perspective:900px]" onPointerMove={follow} onPointerLeave={rest}>
      <motion.div
        ref={card}
        className={clsx("relative h-full [transform-style:preserve-3d]", className)}
        style={{ rotateX, rotateY }}
      >
        {children}
      </motion.div>
    </div>
  );
}
