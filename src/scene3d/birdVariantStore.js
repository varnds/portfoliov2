/**
 * Tiny external store for the live bird-variant switcher. Lets the floating
 * switcher UI (rendered in App) and the 3D AutumnBirds (deep in the R3F tree)
 * share a selection without prop-drilling through the whole scene graph.
 */
import { useSyncExternalStore } from "react";

let current = "migrating";
const listeners = new Set();

export function setBirdVariant(key) {
  if (key === current) return;
  current = key;
  listeners.forEach((l) => l());
}

export function getBirdVariant() {
  return current;
}

export function useBirdVariant() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getBirdVariant,
    getBirdVariant,
  );
}

/** Switcher option metadata — flight STYLES (path + dynamics), shown in the
 *  floating UI. The style is what's visible at distance, not the wing mesh. */
export const BIRD_VARIANTS = [
  { key: "soaring", label: "Soaring" },
  { key: "migrating", label: "Migrating" },
  { key: "darting", label: "Darting" },
];
