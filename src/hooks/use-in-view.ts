"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * True once the element has come into view, and it stays true: for motion that should play the first time a
 * visitor scrolls to something (a number counting up, a line drawing itself), not on every pass.
 */
export function useInView<T extends Element>(threshold = 0.3): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [inView, threshold]);
  return [ref, inView];
}
