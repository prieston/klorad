"use client";

import { useSceneStore, type Model } from "@klorad/core";
import { useEffect, useRef } from "react";
import type { Map as MapboxMap } from "mapbox-gl";
import * as THREE from "three";
import type { Threebox as ThreeboxApi, ThreeboxObject3D } from "threebox-plugin";
import {
  getThreeboxConstructor,
  loadThreeboxBundle,
} from "../threebox/runtime";

const LAYER_ID = "klorad-threebox-models";

const ION_TYPES = new Set(["cesium-ion-tileset", "cesiumIonAsset"]);

function pathFromModelUrl(url: string): string {
  try {
    const u = new URL(
      url,
      typeof window !== "undefined" ? window.location.href : "http://localhost"
    );
    return u.pathname.toLowerCase();
  } catch {
    return url.split(/[?#]/)[0]!.toLowerCase();
  }
}

/** Absolute URL usable by Three.js loaders (fetch). */
function resolveModelFetchUrl(m: Model): string | null {
  const raw = String(m.url ?? "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (typeof window === "undefined") return null;
  if (raw.startsWith("//")) return `${window.location.protocol}${raw}`;
  if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
  return null;
}

function shouldRenderModelInThreebox(m: Model): boolean {
  if (!resolveModelFetchUrl(m)) return false;
  if (m.type && ION_TYPES.has(String(m.type))) return false;
  return inferThreeboxType(m) !== null;
}

/**
 * Scene updates via `rotation.0`-style paths store vec3s as `{0,1,2}` objects.
 * Coerce to a numeric triple so array destructuring and Threebox options work.
 */
function vec3FromScene(
  raw: unknown,
  fallback: [number, number, number]
): [number, number, number] {
  if (Array.isArray(raw) && raw.length >= 3) {
    return [
      Number(raw[0]) || 0,
      Number(raw[1]) || 0,
      Number(raw[2]) || 0,
    ];
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, number>;
    const x = o[0] ?? o["0"];
    const y = o[1] ?? o["1"];
    const z = o[2] ?? o["2"];
    if (x !== undefined || y !== undefined || z !== undefined) {
      return [
        Number(x) || 0,
        Number(y) || 0,
        Number(z) || 0,
      ];
    }
  }
  return fallback;
}

function modelForThreebox(m: Model): Model {
  return {
    ...m,
    position: vec3FromScene(m.position, [0, 0, 0]),
    rotation: vec3FromScene(m.rotation, [0, 0, 0]),
    scale: vec3FromScene(m.scale, [1, 1, 1]),
  };
}

const GLTF_EULER_ORDER: THREE.EulerOrder = "XYZ";
/**
 * glTF/glb are usually Y-up; Threebox/map altitude maps to Three.js +Z. Without this,
 * models read as “lying” on the map (Mapbox Threebox example uses x: -90).
 */
const GLTF_MAPBOX_BASE_ROT_DEG: [number, number, number] = [-90, 0, 0];

function threeboxRotationDeg(
  userDeg: [number, number, number],
  kind: "gltf" | "glb" | null
): { x: number; y: number; z: number } {
  if (kind !== "gltf" && kind !== "glb") {
    return { x: userDeg[0], y: userDeg[1], z: userDeg[2] };
  }
  const d2r = Math.PI / 180;
  const base = new THREE.Euler(
    GLTF_MAPBOX_BASE_ROT_DEG[0] * d2r,
    GLTF_MAPBOX_BASE_ROT_DEG[1] * d2r,
    GLTF_MAPBOX_BASE_ROT_DEG[2] * d2r,
    GLTF_EULER_ORDER
  );
  const user = new THREE.Euler(
    userDeg[0] * d2r,
    userDeg[1] * d2r,
    userDeg[2] * d2r,
    GLTF_EULER_ORDER
  );
  const qBase = new THREE.Quaternion().setFromEuler(base);
  const qUser = new THREE.Quaternion().setFromEuler(user);
  const q = qUser.multiply(qBase);
  const out = new THREE.Euler().setFromQuaternion(q, GLTF_EULER_ORDER);
  const r2d = 180 / Math.PI;
  return { x: out.x * r2d, y: out.y * r2d, z: out.z * r2d };
}

function inferThreeboxType(m: Model): "gltf" | "glb" | null {
  const t = String(m.type ?? "").toLowerCase();
  if (t.includes("glb")) return "glb";
  if (t.includes("gltf")) return "gltf";
  const absolute = resolveModelFetchUrl(m);
  if (!absolute) return null;
  const path = pathFromModelUrl(absolute);
  if (path.endsWith(".glb")) return "glb";
  if (path.endsWith(".gltf")) return "gltf";
  if (t.includes("model") || t.includes("mesh")) return "gltf";
  return null;
}

function snapshotForModel(m: Model): string {
  const [lng, lat, alt = 0] = m.position;
  const rot = m.rotation ?? [0, 0, 0];
  const sc = m.scale ?? [1, 1, 1];
  return JSON.stringify({
    url: m.url,
    type: inferThreeboxType(m),
    lng,
    lat,
    alt,
    rx: rot[0],
    ry: rot[1],
    rz: rot[2],
    sx: sc[0],
    sy: sc[1],
    sz: sc[2],
  });
}

type Entry = {
  tbObject: ThreeboxObject3D;
  snapshot: string;
};

function applyTransform(
  tbObject: ThreeboxObject3D,
  m: Model,
  kind: "gltf" | "glb" | null
) {
  const mm = modelForThreebox(m);
  const [lng, lat, alt = 0] = mm.position;
  tbObject.setCoords([lng, lat, alt]);
  const rot = (mm.rotation ?? [0, 0, 0]) as [number, number, number];
  const r = threeboxRotationDeg(rot, kind);
  tbObject.setRotation(r);
  const sc = mm.scale ?? [1, 1, 1];
  if (tbObject.model?.scale?.set) {
    tbObject.model.scale.set(sc[0], sc[1], sc[2]);
  }
}

function getMapGlContext(
  map: MapboxMap,
  glFromOnAdd?: WebGLRenderingContext
): WebGLRenderingContext | null {
  if (glFromOnAdd) return glFromOnAdd;
  const canvas = map.getCanvas();
  return (
    (canvas.getContext("webgl2") as WebGLRenderingContext | null) ||
    (canvas.getContext("webgl") as WebGLRenderingContext | null)
  );
}

/** Threebox object methods (setCoords → _setObject) reference a global `tb`; docs use `window.tb`. */
function setThreeboxGlobal(tb: ThreeboxApi): void {
  (window as Window & { tb?: ThreeboxApi }).tb = tb;
}

function clearThreeboxGlobal(tb: ThreeboxApi): void {
  const w = window as Window & { tb?: ThreeboxApi };
  if (w.tb === tb) delete w.tb;
}

export function useMapboxThreeboxModels(map: MapboxMap | null) {
  const tbRef = useRef<ThreeboxApi | null>(null);
  const objectsRef = useRef<Map<string, Entry>>(new Map());
  const loadingIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!map) return;

    let cancelled = false;
    let offStyleLoad: (() => void) | undefined;
    let unsubStore: (() => void) | undefined;

    void loadThreeboxBundle().then(() => {
      if (cancelled) return;

      const Threebox = getThreeboxConstructor();
      if (!Threebox) return;

      const removeTrackedObjects = (tb: ThreeboxApi) => {
        for (const { tbObject } of objectsRef.current.values()) {
          try {
            tb.remove(tbObject);
          } catch {
            /* ignore */
          }
        }
        objectsRef.current.clear();
      };

      const syncFromStore = (tb: ThreeboxApi) => {
        const objects = useSceneStore.getState().objects.map(modelForThreebox);
        const wanted = objects.filter(shouldRenderModelInThreebox);
        const wantedIds = new Set(wanted.map((m) => m.id));

        for (const [id, entry] of objectsRef.current) {
          if (!wantedIds.has(id)) {
            loadingIdsRef.current.delete(id);
            try {
              tb.remove(entry.tbObject);
            } catch {
              /* ignore */
            }
            objectsRef.current.delete(id);
          }
        }

        for (const m of wanted) {
          const snap = snapshotForModel(m);
          const existing = objectsRef.current.get(m.id);
          if (existing) {
            if (existing.snapshot !== snap) {
              loadingIdsRef.current.delete(m.id);
              try {
                tb.remove(existing.tbObject);
              } catch {
                /* ignore */
              }
              objectsRef.current.delete(m.id);
            } else {
              continue;
            }
          }

          const kind = inferThreeboxType(m);
          const fetchUrl = resolveModelFetchUrl(m);
          if (!kind || !fetchUrl) continue;

          if (loadingIdsRef.current.has(m.id)) continue;
          loadingIdsRef.current.add(m.id);
          const failSafeTimer = window.setTimeout(() => {
            loadingIdsRef.current.delete(m.id);
          }, 20_000);

          const sc = m.scale ?? [1, 1, 1];
          const rot = (m.rotation ?? [0, 0, 0]) as [number, number, number];
          const rotation = threeboxRotationDeg(rot, kind);

          tb.loadObj(
            {
              obj: fetchUrl,
              type: kind,
              units: "meters",
              scale: { x: sc[0], y: sc[1], z: sc[2] },
              rotation,
            },
            (model) => {
              window.clearTimeout(failSafeTimer);
              loadingIdsRef.current.delete(m.id);

              if (cancelled) {
                try {
                  tb.remove(model);
                } catch {
                  /* ignore */
                }
                return;
              }

              const rawLatest = useSceneStore
                .getState()
                .objects.find((o) => o.id === m.id);
              const latest = rawLatest ? modelForThreebox(rawLatest) : null;
              const latestFetchUrl = latest ? resolveModelFetchUrl(latest) : null;
              if (
                !latest ||
                !shouldRenderModelInThreebox(latest) ||
                latestFetchUrl !== fetchUrl
              ) {
                try {
                  tb.remove(model);
                } catch {
                  /* ignore */
                }
                return;
              }

              applyTransform(model, latest, inferThreeboxType(latest));
              try {
                tb.add(model, LAYER_ID);
              } catch {
                /* ignore */
              }

              objectsRef.current.set(m.id, {
                tbObject: model,
                snapshot: snapshotForModel(latest),
              });
            }
          );
        }
      };

      const attachLayer = () => {
        if (cancelled || map.getLayer(LAYER_ID)) return;

        const customLayer = {
          id: LAYER_ID,
          type: "custom" as const,
          renderingMode: "3d" as const,

          onAdd: (_m: MapboxMap, gl?: WebGLRenderingContext) => {
            const ctx = getMapGlContext(map, gl);
            if (!ctx) return;

            if (tbRef.current) {
              removeTrackedObjects(tbRef.current);
            }
            objectsRef.current.clear();
            const instance = new Threebox(map, ctx, { defaultLights: true });
            tbRef.current = instance;
            setThreeboxGlobal(instance);
            syncFromStore(instance);
          },

          render: () => {
            tbRef.current?.update();
          },

          onRemove: () => {
            const tb = tbRef.current;
            tbRef.current = null;
            if (!tb) return;
            clearThreeboxGlobal(tb);
            removeTrackedObjects(tb);
            if ((map as unknown as { tb?: ThreeboxApi }).tb === tb) {
              delete (map as unknown as { tb?: ThreeboxApi }).tb;
            }
          },
        };

        try {
          map.addLayer(customLayer as Parameters<MapboxMap["addLayer"]>[0]);
        } catch {
          /* style not ready */
        }
      };

      const onStyleLoad = () => {
        attachLayer();
      };

      map.on("style.load", onStyleLoad);
      offStyleLoad = () => map.off("style.load", onStyleLoad);

      if (map.isStyleLoaded()) attachLayer();

      let lastObjects = useSceneStore.getState().objects;
      unsubStore = useSceneStore.subscribe((state) => {
        if (state.objects === lastObjects) return;
        lastObjects = state.objects;
        const tb = tbRef.current;
        if (tb) syncFromStore(tb);
      });
    });

    return () => {
      cancelled = true;
      loadingIdsRef.current.clear();
      offStyleLoad?.();
      unsubStore?.();
      const tbAtTeardown = tbRef.current;
      try {
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
      } catch {
        /* ignore */
      }
      tbRef.current = null;
      objectsRef.current.clear();
      if (tbAtTeardown) clearThreeboxGlobal(tbAtTeardown);
    };
  }, [map]);
}
