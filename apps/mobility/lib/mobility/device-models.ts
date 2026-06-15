/**
 * Stock 3D device models — Three.js primitives, no GLB files. Each
 * stock entry is a builder function that returns a fresh `Object3D`
 * for the device-model layer to position at the device's
 * `MercatorCoordinate`.
 *
 * Why primitives (no GLB)? Mobility's first 3D pass should ship
 * without a content-creation pipeline. Operators who want a precise
 * dome-camera model bring their own GLB through the Phase 3.5 upload
 * pipeline (next PR); the stock set just needs to read as "camera"
 * vs "sign" vs "post" from 50m up.
 */
import * as THREE from "three";

export interface StockDeviceModel {
  key: string;
  label: string;
  description: string;
  /** Approximate height in metres so we can scale by viewport metres
   *  later. Tuned so all stock models read at similar visual weight
   *  at zoom 16-17. */
  approxHeightMeters: number;
  build: () => THREE.Object3D;
}

/** Centralised palette so swapping accent across light/dark themes
 *  stays a one-line change. The 3D layer recolours instance materials
 *  per-render based on the active accent. */
const PALETTE = {
  body: "#dde1e7",
  housing: "#1f2937",
  lens: "#0f172a",
  pole: "#3b4453",
  signFace: "#0b1220",
  signFrame: "#94a3b8",
  signal: "#dde1e7",
};

function makeMaterial(colour: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: colour,
    roughness: 0.55,
    metalness: 0.18,
  });
}

function buildPole(height: number): THREE.Mesh {
  const geom = new THREE.CylinderGeometry(0.07, 0.09, height, 8);
  geom.translate(0, height / 2, 0);
  return new THREE.Mesh(geom, makeMaterial(PALETTE.pole));
}

function buildCamera(): THREE.Object3D {
  const root = new THREE.Group();
  const pole = buildPole(3.4);
  root.add(pole);

  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.32, 0.6),
    makeMaterial(PALETTE.housing),
  );
  housing.position.set(0, 3.55, 0.05);
  root.add(housing);

  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.22, 16),
    makeMaterial(PALETTE.lens),
  );
  lens.rotation.z = Math.PI / 2;
  lens.position.set(0.34, 3.55, 0.05);
  root.add(lens);

  return root;
}

function buildDms(): THREE.Object3D {
  const root = new THREE.Group();
  const left = buildPole(4.4);
  left.position.x = -1.6;
  const right = buildPole(4.4);
  right.position.x = 1.6;
  root.add(left, right);

  const arm = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 0.12, 0.12),
    makeMaterial(PALETTE.pole),
  );
  arm.position.set(0, 4.35, 0);
  root.add(arm);

  const face = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 1.05, 0.18),
    makeMaterial(PALETTE.signFace),
  );
  face.position.set(0, 3.6, 0);
  root.add(face);

  const frame = new THREE.Mesh(
    new THREE.BoxGeometry(3.3, 1.15, 0.06),
    makeMaterial(PALETTE.signFrame),
  );
  frame.position.set(0, 3.6, -0.07);
  root.add(frame);

  return root;
}

function buildSignal(): THREE.Object3D {
  const root = new THREE.Group();
  const pole = buildPole(4.6);
  root.add(pole);

  const horizontal = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 1.6, 8),
    makeMaterial(PALETTE.pole),
  );
  horizontal.rotation.z = Math.PI / 2;
  horizontal.position.set(0.6, 4.5, 0);
  root.add(horizontal);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.78, 0.32),
    makeMaterial(PALETTE.signFace),
  );
  head.position.set(1.25, 4.1, 0);
  root.add(head);

  const colours = ["#ef4444", "#facc15", "#22c55e"];
  colours.forEach((c, i) => {
    const lamp = new THREE.Mesh(
      new THREE.CircleGeometry(0.085, 16),
      new THREE.MeshBasicMaterial({ color: c }),
    );
    lamp.position.set(1.41, 4.35 - i * 0.22, 0);
    lamp.rotation.y = Math.PI / 2;
    root.add(lamp);
  });

  return root;
}

function buildGeneric(): THREE.Object3D {
  const root = new THREE.Group();
  const pole = buildPole(2.4);
  root.add(pole);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 18, 12),
    makeMaterial(PALETTE.body),
  );
  head.position.set(0, 2.55, 0);
  root.add(head);
  return root;
}

export const STOCK_DEVICE_MODELS: StockDeviceModel[] = [
  {
    key: "model-camera",
    label: "Pole-mounted camera",
    description: "Box housing on a pole.",
    approxHeightMeters: 3.8,
    build: buildCamera,
  },
  {
    key: "model-dms",
    label: "Dynamic sign gantry",
    description: "Two-pole signboard.",
    approxHeightMeters: 4.7,
    build: buildDms,
  },
  {
    key: "model-signal",
    label: "Signal head",
    description: "Traffic signal on mast arm.",
    approxHeightMeters: 4.7,
    build: buildSignal,
  },
  {
    key: "model-generic",
    label: "Generic device",
    description: "Pole with sensor head.",
    approxHeightMeters: 2.7,
    build: buildGeneric,
  },
];

const MODEL_INDEX: Map<string, StockDeviceModel> = new Map(
  STOCK_DEVICE_MODELS.map((entry) => [entry.key, entry]),
);

export function getStockModel(key: string): StockDeviceModel | null {
  return MODEL_INDEX.get(key) ?? null;
}

/** Auto-fill suggestion per subsystem on first visit. */
export function defaultModelKeyForSubsystem(subsystem: string): string {
  const normal = subsystem.toLowerCase();
  if (normal === "cctv") return "model-camera";
  if (normal === "dms") return "model-dms";
  if (normal === "signal" || normal === "tsc") return "model-signal";
  return "model-generic";
}
