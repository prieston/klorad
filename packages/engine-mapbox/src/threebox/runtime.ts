import type { Map as MapboxMap } from "mapbox-gl";
import type { Threebox } from "threebox-plugin";

/**
 * @see https://github.com/jscastro76/threebox/blob/master/docs/Threebox.md#threebox-instance
 *
 * Do not statically import `threebox-plugin/dist/threebox.js` at module scope: the browserify
 * bundle touches `window` immediately and breaks Next.js SSR. Call `loadThreeboxBundle()` from
 * a client `useEffect` before `getThreeboxConstructor()`.
 */
export type ThreeboxCtor = new (
  map: MapboxMap,
  gl: WebGLRenderingContext,
  options?: { defaultLights?: boolean }
) => Threebox;

export async function loadThreeboxBundle(): Promise<void> {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line import/extensions
  await import("threebox-plugin/dist/threebox.js");
}

export function getThreeboxConstructor(): ThreeboxCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Threebox?: ThreeboxCtor }).Threebox;
}
