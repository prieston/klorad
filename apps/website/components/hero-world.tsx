"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type * as ThreeModule from "three";

type Palette = { dots: string; beacon: string; arc: string };

const PALETTES: Record<"light" | "dark", Palette> = {
  dark: { dots: "#33414f", beacon: "#3fc8dd", arc: "#1ba2bc" },
  light: { dots: "#aab4bf", beacon: "#158ca3", arc: "#3aa9bd" },
};

/**
 * The hero "world" — an abstract globe of points with beacons and arcs.
 * three.js is imported dynamically inside the effect, so it never touches
 * SSR or the initial bundle; it loads as its own chunk after mount.
 */
export function HeroWorld() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const paletteRef = useRef<Palette>(PALETTES.dark);
  const applyPaletteRef = useRef<((p: Palette) => void) | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let raf = 0;
    let disposed = false;
    let cleanup = () => {};

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    import("three")
      .then((THREE) => {
        if (disposed) return;

        const width = mount.clientWidth || 1;
        const height = mount.clientHeight || 1;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
        camera.position.set(0, 0, 5.4);

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(width, height);
        mount.appendChild(renderer.domElement);

        const world = new THREE.Group();
        world.rotation.x = 0.32;
        scene.add(world);

        const R = 1.7;

        // globe — fibonacci-distributed points
        const COUNT = 2600;
        const dotPositions = new Float32Array(COUNT * 3);
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < COUNT; i++) {
          const y = 1 - (i / (COUNT - 1)) * 2;
          const ring = Math.sqrt(1 - y * y);
          const theta = golden * i;
          dotPositions[i * 3] = Math.cos(theta) * ring * R;
          dotPositions[i * 3 + 1] = y * R;
          dotPositions[i * 3 + 2] = Math.sin(theta) * ring * R;
        }
        const dotGeo = new THREE.BufferGeometry();
        dotGeo.setAttribute("position", new THREE.BufferAttribute(dotPositions, 3));
        const dotMat = new THREE.PointsMaterial({
          size: 0.021,
          sizeAttenuation: true,
          transparent: true,
          opacity: 0.85,
        });
        world.add(new THREE.Points(dotGeo, dotMat));

        // beacons — a handful of brighter location points
        const coords: Array<[number, number]> = [
          [0.4, 0.7],
          [-1.1, 0.2],
          [2.2, -0.3],
          [-2.4, -0.85],
          [1.3, 1.0],
          [-0.3, -1.1],
        ];
        const toVec = (lon: number, lat: number, radius: number) =>
          new THREE.Vector3(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.sin(lat),
            radius * Math.cos(lat) * Math.sin(lon),
          );
        const beaconPositions = new Float32Array(coords.length * 3);
        coords.forEach(([lon, lat], i) => {
          const v = toVec(lon, lat, R);
          beaconPositions[i * 3] = v.x;
          beaconPositions[i * 3 + 1] = v.y;
          beaconPositions[i * 3 + 2] = v.z;
        });
        const beaconGeo = new THREE.BufferGeometry();
        beaconGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(beaconPositions, 3),
        );
        const beaconMat = new THREE.PointsMaterial({
          size: 0.12,
          sizeAttenuation: true,
          transparent: true,
        });
        world.add(new THREE.Points(beaconGeo, beaconMat));

        // arcs — great-circle-ish links between beacons
        const arcGeos: ThreeModule.BufferGeometry[] = [];
        const arcMats: ThreeModule.LineBasicMaterial[] = [];
        for (let i = 0; i < coords.length; i++) {
          const a = toVec(coords[i][0], coords[i][1], R);
          const j = (i + 2) % coords.length;
          const b = toVec(coords[j][0], coords[j][1], R);
          const mid = a
            .clone()
            .add(b)
            .multiplyScalar(0.5)
            .normalize()
            .multiplyScalar(R * 1.42);
          const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
          const arcGeo = new THREE.BufferGeometry().setFromPoints(
            curve.getPoints(48),
          );
          const arcMat = new THREE.LineBasicMaterial({
            transparent: true,
            opacity: 0.5,
          });
          arcGeos.push(arcGeo);
          arcMats.push(arcMat);
          world.add(new THREE.Line(arcGeo, arcMat));
        }

        const applyPalette = (p: Palette) => {
          dotMat.color.set(p.dots);
          beaconMat.color.set(p.beacon);
          arcMats.forEach((m) => m.color.set(p.arc));
        };
        applyPaletteRef.current = applyPalette;
        applyPalette(paletteRef.current);

        let pointerX = 0;
        let pointerY = 0;
        const onPointer = (e: PointerEvent) => {
          pointerX = (e.clientX / window.innerWidth - 0.5) * 0.5;
          pointerY = (e.clientY / window.innerHeight - 0.5) * 0.3;
        };
        window.addEventListener("pointermove", onPointer);

        const onResize = () => {
          const w = mount.clientWidth || 1;
          const h = mount.clientHeight || 1;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener("resize", onResize);

        const renderFrame = () => {
          if (!reduceMotion) world.rotation.y += 0.0013;
          world.rotation.x += (0.32 + pointerY - world.rotation.x) * 0.05;
          world.rotation.z += (pointerX - world.rotation.z) * 0.05;
          renderer.render(scene, camera);
        };

        if (reduceMotion) {
          renderFrame();
        } else {
          const loop = () => {
            renderFrame();
            raf = requestAnimationFrame(loop);
          };
          raf = requestAnimationFrame(loop);
        }

        cleanup = () => {
          cancelAnimationFrame(raf);
          window.removeEventListener("pointermove", onPointer);
          window.removeEventListener("resize", onResize);
          dotGeo.dispose();
          dotMat.dispose();
          beaconGeo.dispose();
          beaconMat.dispose();
          arcGeos.forEach((g) => g.dispose());
          arcMats.forEach((m) => m.dispose());
          renderer.dispose();
          if (renderer.domElement.parentNode === mount) {
            mount.removeChild(renderer.domElement);
          }
          applyPaletteRef.current = null;
        };
      })
      .catch(() => {
        /* WebGL or three unavailable — the CSS background remains */
      });

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    const next = PALETTES[resolvedTheme === "light" ? "light" : "dark"];
    paletteRef.current = next;
    applyPaletteRef.current?.(next);
  }, [resolvedTheme]);

  return <div ref={mountRef} aria-hidden className="absolute inset-0" />;
}
