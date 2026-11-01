import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PALETTES } from "@/config/appearance";

// The design system lives in src/app/globals.css (docs/team/08-design-system-and-pages.md, Part 2). These tests keep
// it complete and readable: a palette that forgets a token, or text that cannot be read, is found here and not on a
// guest's phone.

const source = readFileSync(path.resolve(import.meta.dirname, "../../src/app/globals.css"), "utf8");

// Comments and one-line rules (`@import`, `@custom-variant`) are removed, so each block's selector is only its own.
const css = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@(?:import|custom-variant)[^;{]*;/g, "");

const palettes = PALETTES;
const modes = ["light", "dark"] as const;

// The tokens each palette chooses itself. The status colours, the scrim and the accent's tint are shared.
const paletteTokens = [
  "--paper",
  "--surface",
  "--surface-2",
  "--ink",
  "--ink-muted",
  "--ink-faint",
  "--line",
  "--line-strong",
  "--accent",
  "--accent-strong",
  "--accent-ink",
  "--glow",
] as const;

interface Block {
  selectors: string[];
  declarations: Map<string, string>;
}

// Blocks without blocks inside them: a palette, `:root`, `@theme inline`. (Blocks inside `@layer` come out too.)
function readBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  for (const [, selector, body] of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const declarations = new Map<string, string>();
    for (const [, name, value] of (body ?? "").matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
      declarations.set(name!, value!.trim());
    }
    blocks.push({ selectors: (selector ?? "").split(",").map((part) => part.trim()), declarations });
  }
  return blocks;
}

const blocks = readBlocks(css);

function blockFor(selector: string): Map<string, string> {
  const block = blocks.find((candidate) => candidate.selectors.includes(selector));
  if (!block) throw new Error(`globals.css has no block for ${selector}`);
  return block.declarations;
}

function palette(name: string, mode: (typeof modes)[number]): Map<string, string> {
  return blockFor(
    mode === "light" ? `:root[data-palette="${name}"]` : `:root[data-mode="dark"][data-palette="${name}"]`,
  );
}

function sharedTokens(mode: (typeof modes)[number]): Map<string, string> {
  return mode === "light" ? blockFor(":root") : blockFor(':root[data-mode="dark"]');
}

function luminance(hex: string): number {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

/** WCAG contrast ratio: 4.5 is the minimum for reading text. */
function contrast(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter! + 0.05) / (darker! + 0.05);
}

const combinations = palettes.flatMap((name) => modes.map((mode) => ({ name, mode })));

describe("palettes", () => {
  it.each(combinations)("$name ($mode) sets every token with a hex colour", ({ name, mode }) => {
    const tokens = palette(name, mode);
    for (const token of paletteTokens) {
      expect(tokens.get(token), `${name} ${mode} ${token}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it.each(combinations)("$name ($mode): the accent button's text can be read", ({ name, mode }) => {
    const tokens = palette(name, mode);
    expect(contrast(tokens.get("--accent-ink")!, tokens.get("--accent")!)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(combinations)("$name ($mode): body text and secondary text can be read", ({ name, mode }) => {
    const tokens = palette(name, mode);
    for (const background of ["--paper", "--surface"]) {
      expect(contrast(tokens.get("--ink")!, tokens.get(background)!)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens.get("--ink-muted")!, tokens.get(background)!)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(combinations)(
    "$name ($mode): the links and the focus ring stand out from the page",
    ({ name, mode }) => {
      const tokens = palette(name, mode);
      expect(contrast(tokens.get("--accent")!, tokens.get("--paper")!)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("status colours", () => {
  it.each(modes)("%s: success, warning and danger can be read as text on a card", (mode) => {
    const shared = sharedTokens(mode);
    const surface = palette("cedar", mode).get("--surface")!;
    for (const token of ["--success", "--warning", "--danger"]) {
      expect(contrast(shared.get(token)!, surface), `${mode} ${token}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(modes)("%s: the text on a danger button can be read", (mode) => {
    const shared = sharedTokens(mode);
    expect(contrast(shared.get("--danger-ink")!, shared.get("--danger")!)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("Tailwind names", () => {
  it("makes `dark:` follow the page's mode, which the visitor's switch changes", () => {
    expect(source).toMatch(
      /@custom-variant dark \(&:where\(\[data-mode="dark"\], \[data-mode="dark"\] \*\)\);/,
    );
  });

  const colourNames = [...blockFor("@theme inline")].filter(([name]) => name.startsWith("--color-"));

  it("exposes every palette token as a class", () => {
    const exposed = colourNames.map(([, value]) => value);
    for (const token of paletteTokens) {
      expect(exposed, `no class for ${token}`).toContain(`var(${token})`);
    }
  });

  it("points every class at a token that exists", () => {
    const defined = new Set([...blockFor(":root").keys(), ...palette("cedar", "light").keys()]);
    for (const [name, value] of colourNames) {
      const token = /^var\((--[a-z0-9-]+)\)$/.exec(value)?.[1];
      if (token) expect(defined.has(token), `${name} uses ${token}, which nothing defines`).toBe(true);
    }
  });
});
