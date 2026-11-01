import { MODE_STORAGE_KEY } from "@/config/appearance";

// Runs in <head>, before the first paint, so a visitor who chose dark mode never sees a flash of light. The saved
// choice wins; without one, the device's setting decides. It only sets the attribute the CSS reads (`data-mode`).
export const appearanceScript = `(function () {
  var mode = null;
  try { mode = localStorage.getItem(${JSON.stringify(MODE_STORAGE_KEY)}); } catch (error) {}
  if (mode !== "light" && mode !== "dark") {
    mode = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  document.documentElement.dataset.mode = mode;
})();`;

export function AppearanceScript() {
  return <script dangerouslySetInnerHTML={{ __html: appearanceScript }} />;
}
