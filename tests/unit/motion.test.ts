import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stagger } from "@/utils/motion";

// The page's motion lives in src/app/globals.css. These tests keep the rules that are easy to break without seeing it:
// a floating card that loses its tilt, a short laptop window that scrolls, motion for a visitor who turned it off.

const css = readFileSync(path.resolve(import.meta.dirname, "../../src/app/globals.css"), "utf8");

function block(selector: string) {
  const start = css.indexOf(`${selector} {`);
  expect(start, `${selector} is defined`).toBeGreaterThanOrEqual(0);
  return css.slice(start, css.indexOf("}", start));
}

describe("motion", () => {
  it("delays each step of a sequence by its position", () => {
    expect(stagger(3)).toEqual({ "--stagger": 3 });
  });

  it("floats with `translate`, so a card keeps the depth and lean its `transform` gives it", () => {
    const keyframes = css.slice(css.indexOf("@keyframes float"), css.indexOf(".float {"));
    expect(keyframes).toContain("translate: 0 -10px");
    expect(keyframes).not.toContain("transform");
  });

  it("raises a form's fields one after another", () => {
    expect(block(".rise-in-sequence > *")).toContain("animation: rise-in");
    expect(block(".rise-in-sequence > :nth-child(2)")).toContain("--stagger: 1");
  });

  it("stops every animation for a visitor who asked for less motion", () => {
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toContain("animation-iteration-count: 1 !important");
  });

  it("names a short laptop window, where pages that must fit tighten instead of scrolling", () => {
    expect(css).toContain("@custom-variant short (@media (min-width: 64rem) and (max-height: 50rem));");
  });
});
