import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { appearanceScript } from "@/components/theme/appearance-script";
import { MODE_STORAGE_KEY } from "@/config/appearance";

// The script runs in the browser before the page paints. Here it runs in a small pretend browser, so each case that
// decides the first colours a visitor sees can be checked.

interface Browser {
  saved?: string | null;
  storageBlocked?: boolean;
  deviceIsDark?: boolean;
  noMatchMedia?: boolean;
}

function modeAfterBootScript({
  saved = null,
  storageBlocked = false,
  deviceIsDark = false,
  noMatchMedia = false,
}: Browser) {
  const documentElement = { dataset: {} as Record<string, string> };
  const asked: string[] = [];
  runInNewContext(appearanceScript, {
    document: { documentElement },
    localStorage: {
      getItem(key: string) {
        asked.push(key);
        if (storageBlocked) throw new Error("storage is blocked");
        return saved;
      },
    },
    window: noMatchMedia ? {} : { matchMedia: () => ({ matches: deviceIsDark }) },
  });
  return { mode: documentElement.dataset.mode, asked };
}

describe("the boot script", () => {
  it("uses the mode the visitor saved, whatever their device says", () => {
    expect(modeAfterBootScript({ saved: "dark", deviceIsDark: false }).mode).toBe("dark");
    expect(modeAfterBootScript({ saved: "light", deviceIsDark: true }).mode).toBe("light");
  });

  it("reads the saved mode from the key the menu writes to", () => {
    expect(modeAfterBootScript({ saved: "dark" }).asked).toEqual([MODE_STORAGE_KEY]);
  });

  it("follows the device when nothing is saved", () => {
    expect(modeAfterBootScript({ deviceIsDark: true }).mode).toBe("dark");
    expect(modeAfterBootScript({ deviceIsDark: false }).mode).toBe("light");
  });

  it("ignores a saved value that is not a mode", () => {
    expect(modeAfterBootScript({ saved: "blue", deviceIsDark: true }).mode).toBe("dark");
  });

  it("still works when the browser blocks storage (private browsing)", () => {
    expect(modeAfterBootScript({ storageBlocked: true, deviceIsDark: true }).mode).toBe("dark");
  });

  it("falls back to light on a browser that cannot tell the device's setting", () => {
    expect(modeAfterBootScript({ noMatchMedia: true }).mode).toBe("light");
  });
});
