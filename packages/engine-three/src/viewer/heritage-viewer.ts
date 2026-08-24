import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/**
 * A self-contained glTF viewer for Klorad Heritage.
 *
 * Deliberately vanilla three.js — no @react-three/fiber, no drei, no MUI. It
 * lives inside @klorad/engine-three because the workspace audit requires every
 * `three` import to, but it is a separate tsup entry and imports nothing from
 * the rest of the package, so a bundler following this module never reaches
 * `@klorad/ui` or `@klorad/engine-cesium`. That matters: the Heritage spec
 * budgets 3 seconds to first meaningful render on a mid-range phone on 4G, and
 * a public visitor page cannot afford the editor's dependency graph.
 *
 * Meshes only. Gaussian splats are deliberately absent — the spec's own
 * §13.1 records that no published benchmark of splat rendering in Quest
 * Browser WebXR exists, and that everything headset-facing rests on an
 * unverified number. Nothing splat-related should be built before that
 * measurement.
 */

export interface ProxyHotspot {
  id: string;
  /** `{ position: [x,y,z], rotation: [x,y,z,w], scale: [x,y,z] }`. */
  transform: unknown;
  shape: "box" | "sphere" | "cylinder" | "plane" | "mesh";
  label?: string | null;
}

export interface ViewerLayer {
  id: string;
  url: string;
  transform?: unknown;
}

export interface HeritageViewerOptions {
  container: HTMLElement;
  layers: ViewerLayer[];
  proxies?: ProxyHotspot[];
  /** Called when a visitor activates a hotspot, by click or by keyboard. */
  onSelectProxy?: (id: string) => void;
  onProgress?: (fraction: number) => void;
  onError?: (message: string) => void;
  onReady?: () => void;
  /** Show hotspot geometry rather than leaving it invisible. Authoring aid. */
  showProxies?: boolean;
  background?: string;
}

interface Vec3 {
  0: number;
  1: number;
  2: number;
}

function readTransform(t: unknown): {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  scale: THREE.Vector3;
} {
  const o = (t ?? {}) as {
    position?: Vec3;
    rotation?: [number, number, number, number];
    scale?: Vec3;
  };
  const p = o.position ?? { 0: 0, 1: 0, 2: 0 };
  const r = o.rotation ?? [0, 0, 0, 1];
  const s = o.scale ?? { 0: 1, 1: 1, 2: 1 };
  return {
    position: new THREE.Vector3(p[0], p[1], p[2]),
    quaternion: new THREE.Quaternion(r[0], r[1], r[2], r[3]),
    scale: new THREE.Vector3(s[0], s[1], s[2]),
  };
}

function proxyGeometry(shape: ProxyHotspot["shape"]): THREE.BufferGeometry {
  switch (shape) {
    case "sphere":
      return new THREE.SphereGeometry(0.5, 16, 12);
    case "cylinder":
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 16);
    case "plane":
      return new THREE.PlaneGeometry(1, 1);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

export class HeritageViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly proxyMeshes: THREE.Mesh[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly opts: HeritageViewerOptions;
  private frame = 0;
  private destroyed = false;
  private resizeObserver?: ResizeObserver;

  constructor(opts: HeritageViewerOptions) {
    this.opts = opts;
    const { container } = opts;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: !opts.background,
      powerPreference: "high-performance",
    });
    // Capped rather than uncapped: §9.3 tracks battery as a budget, and a
    // three-hour on-site visit must not exhaust a phone.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);

    if (opts.background) this.scene.background = new THREE.Color(opts.background);

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    this.camera.position.set(0, 0.6, 2.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    // §10.1 requires prefers-reduced-motion to be honoured for all camera
    // animation. Damping is camera animation.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      this.controls.enableDamping = false;
    }

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.6);
    fill.position.set(-4, 1, -3);
    this.scene.add(fill);

    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    // Keyboard operability is a conformance requirement, not a nicety: the
    // canvas is focusable and hotspots cycle with the arrow keys.
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.setAttribute("role", "application");
    this.renderer.domElement.addEventListener("keydown", this.onKeyDown);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    void this.load();
    this.tick();
  }

  private resize = () => {
    const { container } = this.opts;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };

  private async load() {
    const loader = new GLTFLoader();

    // Draco and KTX2 are the compression paths the spec's §5.4 delivery table
    // names, so the loader has to understand both or a correctly-produced
    // asset fails to open.
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");
    loader.setDRACOLoader(draco);
    this.disposables.push(draco);

    const ktx2 = new KTX2Loader()
      .setTranscoderPath("https://unpkg.com/three@0.170.0/examples/jsm/libs/basis/")
      .detectSupport(this.renderer);
    loader.setKTX2Loader(ktx2);
    this.disposables.push(ktx2);

    const root = new THREE.Group();
    let loaded = 0;

    for (const layer of this.opts.layers) {
      try {
        const gltf = await loader.loadAsync(layer.url);
        const node = gltf.scene;
        if (layer.transform) {
          const t = readTransform(layer.transform);
          node.position.copy(t.position);
          node.quaternion.copy(t.quaternion);
          node.scale.copy(t.scale);
        }
        root.add(node);
      } catch {
        this.opts.onError?.(
          `Could not load one of this scene's models. It may be missing, or the server hosting it may not allow cross-origin access.`,
        );
      }
      loaded += 1;
      this.opts.onProgress?.(loaded / Math.max(this.opts.layers.length, 1));
    }

    if (this.destroyed) return;
    this.scene.add(root);
    this.addProxies();
    this.frameAll(root);
    this.opts.onReady?.();
  }

  private addProxies() {
    for (const p of this.opts.proxies ?? []) {
      const material = new THREE.MeshBasicMaterial({
        color: 0x27cee7,
        transparent: true,
        // Invisible by default: the proxy provides interaction, the capture
        // provides appearance. Visible only as an authoring aid.
        opacity: this.opts.showProxies ? 0.25 : 0,
        depthWrite: false,
        wireframe: this.opts.showProxies,
      });
      const mesh = new THREE.Mesh(proxyGeometry(p.shape), material);
      const t = readTransform(p.transform);
      mesh.position.copy(t.position);
      mesh.quaternion.copy(t.quaternion);
      mesh.scale.copy(t.scale);
      mesh.userData.proxyId = p.id;
      mesh.userData.label = p.label ?? null;
      this.scene.add(mesh);
      this.proxyMeshes.push(mesh);
    }
  }

  /** Fit the camera to the loaded content so a visitor never arrives staring
   *  at the inside of a model or at empty space. */
  private frameAll(root: THREE.Object3D) {
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const distance = radius / Math.sin((this.camera.fov * Math.PI) / 360);

    this.camera.near = Math.max(distance / 1000, 0.001);
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(centre).add(new THREE.Vector3(0, radius * 0.35, distance * 1.25));
    this.controls.target.copy(centre);
    this.controls.update();
  }

  private onPointerDown = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.proxyMeshes, false)[0];
    if (hit) {
      this.opts.onSelectProxy?.(hit.object.userData.proxyId as string);
    }
  };

  private focusIndex = -1;
  private onKeyDown = (e: KeyboardEvent) => {
    if (this.proxyMeshes.length === 0) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      this.focusIndex = (this.focusIndex + 1) % this.proxyMeshes.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      this.focusIndex =
        (this.focusIndex - 1 + this.proxyMeshes.length) % this.proxyMeshes.length;
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const mesh = this.proxyMeshes[this.focusIndex];
      if (mesh) this.opts.onSelectProxy?.(mesh.userData.proxyId as string);
      return;
    } else {
      return;
    }
    const mesh = this.proxyMeshes[this.focusIndex];
    if (mesh) {
      this.controls.target.copy(mesh.position);
      this.controls.update();
      this.opts.onSelectProxy?.(mesh.userData.proxyId as string);
    }
  };

  private tick = () => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.tick);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  /** Release GPU resources. A viewer left undisposed on route change leaks the
   *  whole scene graph, which on a phone is the difference between browsing a
   *  collection and the tab being killed. */
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("keydown", this.onKeyDown);
    this.controls.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else if (mat) (mat as THREE.Material).dispose();
    });
    for (const d of this.disposables) d.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
