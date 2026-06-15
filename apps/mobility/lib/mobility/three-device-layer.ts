/**
 * Mapbox CustomLayer that renders device meshes through Three.js.
 *
 * One layer per map. Devices are written via `setDevices(devices,
 * resolveModelKey)`; the layer keeps the Three.js scene in sync with
 * the latest device set and queues a repaint. Each device gets one
 * mesh built from the stock model registry, anchored at the device's
 * lng/lat via Mapbox's `MercatorCoordinate` so the projection matrix
 * Mapbox hands the renderer lines up with the basemap exactly.
 *
 * Why a custom layer (not Mapbox's native `model` layer)? Native v3
 * models are tied to the Standard style's `addImport` plumbing and
 * don't accept arbitrary geometry from app code without GLB files.
 * The Three.js layer keeps Phase 3 self-contained — stock primitives
 * today, GLB uploads (Phase 3.5) tomorrow.
 */
import * as THREE from "three";
import mapboxgl, {
  type CustomLayerInterface,
  type Map as MapboxMap,
} from "mapbox-gl";
import { getStockModel, type StockDeviceModel } from "./device-models";

export interface ThreeDeviceInput {
  id: string;
  lng: number;
  lat: number;
  subsystem: string;
}

export interface ThreeDeviceLayer extends CustomLayerInterface {
  setDevices(
    devices: ThreeDeviceInput[],
    resolveModelKey: (subsystem: string) => string,
  ): void;
  setHighlight(deviceId: string | null): void;
  /** Tint applied to selection halo. Defaults to a Klorad teal. */
  setAccent(hex: string): void;
}

const LAYER_ID = "device-models-3d";

interface DeviceMesh {
  id: string;
  mesh: THREE.Object3D;
  halo: THREE.Mesh;
  modelKey: string;
}

export function createThreeDeviceLayer(): ThreeDeviceLayer {
  let camera: THREE.PerspectiveCamera | null = null;
  let scene: THREE.Scene | null = null;
  let renderer: THREE.WebGLRenderer | null = null;
  let map: MapboxMap | null = null;
  const meshes: Map<string, DeviceMesh> = new Map();
  /** Cache of source meshes per stock-model key. We `.clone()` per
   *  instance so the geometry/material upload happens once. */
  const sourceModels: Map<string, THREE.Object3D> = new Map();
  let highlightId: string | null = null;
  let accent = "#0ea5e9";
  let lastDevices: ThreeDeviceInput[] = [];
  let lastResolver: ((subsystem: string) => string) | null = null;

  function ensureSourceModel(stock: StockDeviceModel): THREE.Object3D {
    const cached = sourceModels.get(stock.key);
    if (cached) return cached;
    const built = stock.build();
    sourceModels.set(stock.key, built);
    return built;
  }

  function buildHaloMesh(): THREE.Mesh {
    const geom = new THREE.RingGeometry(1.2, 1.55, 36);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(accent),
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.visible = false;
    return mesh;
  }

  function addLights(s: THREE.Scene): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(0.5, 1, 0.6);
    s.add(ambient, sun);
  }

  function placeAt(
    obj: THREE.Object3D,
    halo: THREE.Mesh,
    lng: number,
    lat: number,
  ): void {
    const merc = mapboxgl.MercatorCoordinate.fromLngLat([lng, lat], 0);
    const scale = merc.meterInMercatorCoordinateUnits();
    // The model's Y axis is "up" in metres; Mapbox's z is the
    // mercator "altitude". We orient the model upright then translate
    // everything so the base sits on the basemap.
    const t = new THREE.Group();
    t.position.set(merc.x, merc.y, merc.z);
    t.rotation.x = Math.PI / 2;
    t.scale.set(scale, scale, scale);
    t.add(obj);
    halo.position.set(merc.x, merc.y, merc.z);
    halo.scale.set(scale, scale, scale);
    // Halo is already rotated to lie flat against the basemap; replace
    // the transform's group with one that doesn't include the halo.
    return;
  }

  function rebuildScene(): void {
    if (!scene) return;
    for (const entry of meshes.values()) {
      scene.remove(entry.mesh);
      scene.remove(entry.halo);
    }
    meshes.clear();
    if (!lastResolver) return;
    for (const d of lastDevices) {
      const modelKey = lastResolver(d.subsystem);
      const stock = getStockModel(modelKey);
      if (!stock) continue;
      const source = ensureSourceModel(stock);
      const clone = source.clone();
      const halo = buildHaloMesh();
      const merc = mapboxgl.MercatorCoordinate.fromLngLat([d.lng, d.lat], 0);
      const metres = merc.meterInMercatorCoordinateUnits();
      // Compose the per-instance transform on a fresh root so we can
      // swap orientation without copy-pasting Mapbox boilerplate.
      const root = new THREE.Group();
      root.position.set(merc.x, merc.y, merc.z);
      root.rotation.x = Math.PI / 2;
      root.scale.setScalar(metres);
      root.add(clone);

      halo.position.set(merc.x, merc.y, merc.z);
      halo.rotation.x = -Math.PI / 2;
      halo.scale.setScalar(metres * stock.approxHeightMeters * 0.6);
      scene.add(root);
      scene.add(halo);
      meshes.set(d.id, { id: d.id, mesh: root, halo, modelKey });
    }
    updateHighlight();
  }

  function updateHighlight(): void {
    for (const entry of meshes.values()) {
      entry.halo.visible = entry.id === highlightId;
    }
    if (map) map.triggerRepaint();
  }

  // Suppress unused-warning for the helper retained for clarity.
  void placeAt;

  return {
    id: LAYER_ID,
    type: "custom",
    renderingMode: "3d",

    onAdd(mapInstance, gl) {
      map = mapInstance as MapboxMap;
      scene = new THREE.Scene();
      addLights(scene);
      camera = new THREE.PerspectiveCamera();
      renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      renderer.autoClear = false;
      // Rebuild scene if a previous setDevices call landed before
      // the layer was attached (Operator passes devices into the
      // factory + may swap layers across style.load).
      rebuildScene();
    },

    render(_gl, matrix) {
      if (!renderer || !scene || !camera) return;
      const projection = new THREE.Matrix4().fromArray(matrix);
      camera.projectionMatrix = projection;
      // World is already encoded in mercator coords so the view is
      // identity. The projection matrix Mapbox gives us covers all
      // the placement maths.
      renderer.resetState();
      renderer.render(scene, camera);
      if (map) map.triggerRepaint();
    },

    onRemove() {
      if (!scene) return;
      for (const entry of meshes.values()) {
        scene.remove(entry.mesh);
        scene.remove(entry.halo);
      }
      meshes.clear();
      sourceModels.clear();
      renderer?.dispose();
      renderer = null;
      scene = null;
      camera = null;
      map = null;
    },

    setDevices(devices, resolveModelKey) {
      lastDevices = devices;
      lastResolver = resolveModelKey;
      rebuildScene();
    },

    setHighlight(deviceId) {
      highlightId = deviceId;
      updateHighlight();
    },

    setAccent(hex) {
      accent = hex;
      for (const entry of meshes.values()) {
        const mat = entry.halo.material;
        if (mat instanceof THREE.MeshBasicMaterial) mat.color.set(hex);
      }
      if (map) map.triggerRepaint();
    },
  };
}

export const THREE_DEVICE_LAYER_ID = LAYER_ID;
