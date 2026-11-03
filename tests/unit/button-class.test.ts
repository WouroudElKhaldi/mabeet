import { describe, expect, it } from "vitest";
import { buttonClass } from "@/components/ui/button";
import type { ButtonSize, ButtonVariant } from "@/components/ui/button";

const variants: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const sizes: ButtonSize[] = ["sm", "md", "lg", "icon"];

describe("buttonClass", () => {
  it("is a primary, medium button unless told otherwise", () => {
    const classes = buttonClass();
    expect(classes).toContain("bg-accent text-accent-ink hover:bg-accent-strong");
    expect(classes).toContain("h-11");
  });

  it("gives each variant its own look", () => {
    expect(buttonClass({ variant: "secondary" })).toContain("ring-ink");
    expect(buttonClass({ variant: "ghost" })).toContain("hover:bg-surface-2");
    expect(buttonClass({ variant: "danger" })).toContain("bg-danger text-danger-ink");
  });

  it("makes the icon button a circle and every other size a rounded rectangle", () => {
    expect(buttonClass({ size: "icon" })).toContain("rounded-full");
    for (const size of sizes.filter((candidate) => candidate !== "icon")) {
      expect(buttonClass({ size })).toContain("rounded-lg");
    }
  });

  it("keeps the caller's classes, after its own", () => {
    expect(buttonClass({ className: "w-full" }).endsWith("w-full")).toBe(true);
  });

  it("uses colour tokens only, never a hex code or a Tailwind palette colour", () => {
    for (const variant of variants) {
      for (const size of sizes) {
        expect(buttonClass({ variant, size })).not.toMatch(
          /#[0-9a-f]{3,8}|\b(?:gray|slate|red|green|blue)-\d/,
        );
      }
    }
  });
});
