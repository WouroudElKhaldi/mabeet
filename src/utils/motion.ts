import type { CSSProperties } from "react";

/** Delays a `.rise-in` element by its position in a sequence. */
export function stagger(index: number): CSSProperties {
  return { "--stagger": index } as CSSProperties;
}
