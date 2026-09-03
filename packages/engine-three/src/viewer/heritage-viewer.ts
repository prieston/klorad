import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "three/examples/jsm/controls/TransformControls.js";

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

  /**
   * Authoring mode (§7.2.3, HER-203).
   *
   * §5.3 is the reason this exists at all: a splat cloud contains no objects,
   * no faces and no node names, and a raycast into it hits nothing. Proxies
   * are the entire interaction layer for a captured site, and placing them is
   * manual labour proportional to how tappable the client wants it. That cost
   * is real and belongs in the quote — what this mode can do is stop it being
   * worse than it has to be.
   */
  editable?: boolean;
  /** Clicking empty geometry places a new proxy at the surface point hit. */
  onPlaceProxy?: (transform: {
    position: [number, number, number];
    rotation: [number, number, number, number];
    scale: [number, number, number];
  }) => void;
  /** Fired continuously while a gizmo is dragged, and once on release. */
  /** Fired while a whole layer is dragged in the scene composer. */
  onTransformLayer?: (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number, number];
      scale: [number, number, number];
    },
  ) => void;
  /** Clicking a model reports which layer was hit, so the composer can select
   *  from the canvas as well as from its list. */
  onSelectLayer?: (id: string | null) => void;
  /** What a click on the model means. `proxies` places hotspots — the default,
   *  and what the annotation screen wants. `layers` selects whole models, for
   *  arranging a scene. */
  mode?: "proxies" | "layers";
  onTransformProxy?: (
    id: string,
    transform: {
      position: [number, number, number];
      rotation: [number, number, number, number];
      scale: [number, number, number];
    },
  ) => void;
  /** Translation snap in metres. Null disables snapping. */
  snap?: number | null;
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
  /** Set when the visitor has asked for reduced motion; suppresses camera
   *  flights in favour of instant cuts. */
  private reducedMotion = false;
  /** In-progress camera flight, advanced by `tick`. */
  private flight: {
    from: THREE.Vector3;
    to: THREE.Vector3;
    fromTarget: THREE.Vector3;
    toTarget: THREE.Vector3;
    startedAt: number;
    duration: number;
  } | null = null;
  private readonly controls: OrbitControls;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly proxyMeshes: THREE.Mesh[] = [];
  private readonly disposables: Array<{ dispose: () => void }> = [];
  private readonly opts: HeritageViewerOptions;
  private frame = 0;
  private destroyed = false;
  private resizeObserver?: ResizeObserver;
  private transform?: TransformControls;
  private contentRoot?: THREE.Object3D;
  /** Layer id to its root node, so a scene can be rearranged by moving whole
   *  models rather than the meshes inside them. */
  private readonly layerNodes = new Map<string, THREE.Object3D>();
  private selectedLayerId: string | null = null;
  private selectedProxy: THREE.Mesh | null = null;

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
      this.reducedMotion = true;
    }

    if (opts.editable) this.setupGizmo();

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
        // Stamped so a click can be traced back from whichever mesh deep in
        // the imported hierarchy was actually hit, up to the layer a curator
        // thinks they are moving.
        node.userData.layerId = layer.id;
        this.layerNodes.set(layer.id, node);
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
    this.contentRoot = root;
    this.addProxies();
    this.frameAll(root);
    this.opts.onReady?.();
  }

  private addProxies() {
    for (const p of this.opts.proxies ?? []) this.createProxyMesh(p);
  }

  private createProxyMesh(p: ProxyHotspot): THREE.Mesh {
    const visible = this.opts.showProxies || this.opts.editable;
    const material = new THREE.MeshBasicMaterial({
      color: 0x27cee7,
      transparent: true,
      // Invisible by default: the proxy provides interaction, the capture
      // provides appearance. Visible only while authoring.
      opacity: visible ? 0.25 : 0,
      depthWrite: false,
      wireframe: visible,
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
    return mesh;
  }

  /**
   * Attach the gizmo to a whole layer, for arranging a scene.
   *
   * Distinct from proxy selection: a proxy is a hotspot inside a model, a
   * layer *is* a model. Composing a gallery means moving the statue, not the
   * marker on the statue, so the two selections are deliberately separate
   * modes rather than one list of clickable things.
   */
  selectLayer(id: string | null) {
    this.selectedLayerId = id;
    if (!this.transform) return;
    const node = id ? this.layerNodes.get(id) : undefined;
    if (node) this.transform.attach(node);
    else this.transform.detach();
  }

  /** Which layer the gizmo currently holds, if any. */
  get selectedLayer(): string | null {
    return this.selectedLayerId;
  }

  /** Apply a transform to a layer from outside — used to reset one, or to
   *  reflect a numeric edit made in a form. */
  setLayerTransform(id: string, transform: unknown) {
    const node = this.layerNodes.get(id);
    if (!node) return;
    const t = readTransform(transform);
    node.position.copy(t.position);
    node.quaternion.copy(t.quaternion);
    node.scale.copy(t.scale);
  }

  /** Frame a single layer. Composing a scene means working on one thing at a
   *  time, and hunting for the piece you just selected is friction. */
  focusLayer(id: string) {
    const node = this.layerNodes.get(id);
    if (node) this.frameAll(node);
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
    // A drag on the gizmo is not a click on the scene behind it.
    if (this.transform?.dragging) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const proxyHit = this.raycaster.intersectObjects(this.proxyMeshes, false)[0];
    if (proxyHit) {
      const mesh = proxyHit.object as THREE.Mesh;
      this.opts.onSelectProxy?.(mesh.userData.proxyId as string);
      if (this.opts.editable) this.selectProxy(mesh);
      return;
    }

    if (!this.opts.editable || !this.contentRoot) return;

    // Scene-composition mode: a click selects the model it landed on rather
    // than dropping a hotspot onto it. Two different jobs happen on the same
    // canvas, so which one a click means has to be an explicit mode rather
    // than a guess.
    if (this.opts.mode === "layers") {
      const hit = this.raycaster.intersectObject(this.contentRoot, true)[0];
      let node: THREE.Object3D | null = hit?.object ?? null;
      while (node && node.userData.layerId === undefined) node = node.parent;
      const id = (node?.userData.layerId as string | undefined) ?? null;
      this.opts.onSelectLayer?.(id);
      this.selectLayer(id);
      return;
    }

    // Nothing hit: place a new proxy where the ray meets the geometry. Placing
    // at the surface rather than at the origin is the difference between an
    // authoring tool and a coordinate entry form — a curator marking forty
    // objects should be clicking, not typing vectors.
    const surface = this.raycaster.intersectObject(this.contentRoot, true)[0];
    if (!surface) return;
    this.opts.onPlaceProxy?.({
      position: [surface.point.x, surface.point.y, surface.point.z],
      rotation: [0, 0, 0, 1],
      scale: [0.3, 0.3, 0.3],
    });
  };

  private setupGizmo() {
    const gizmo = new TransformControls(this.camera, this.renderer.domElement);
    gizmo.setSpace("world");
    // Orbiting while dragging a handle would fight the drag.
    gizmo.addEventListener("dragging-changed", (e) => {
      this.controls.enabled = !(e.value as boolean);
    });
    gizmo.addEventListener("objectChange", () => this.emitTransform());
    if (this.opts.snap) {
      gizmo.setTranslationSnap(this.opts.snap);
      gizmo.setRotationSnap(Math.PI / 24);
    }
    // r155+ exposes the visual helper separately from the controller.
    const helper = (gizmo as unknown as { getHelper?: () => THREE.Object3D }).getHelper?.();
    this.scene.add(helper ?? (gizmo as unknown as THREE.Object3D));
    this.transform = gizmo;
  }

  private emitTransform() {
    // A layer selection takes priority: when the gizmo holds a whole model,
    // reporting its move as a proxy move would write a hotspot's position
    // from the statue's coordinates.
    if (this.selectedLayerId) {
      const node = this.layerNodes.get(this.selectedLayerId);
      if (!node) return;
      this.opts.onTransformLayer?.(this.selectedLayerId, {
        position: [node.position.x, node.position.y, node.position.z],
        rotation: [
          node.quaternion.x,
          node.quaternion.y,
          node.quaternion.z,
          node.quaternion.w,
        ],
        scale: [node.scale.x, node.scale.y, node.scale.z],
      });
      return;
    }

    const mesh = this.selectedProxy;
    if (!mesh) return;
    this.opts.onTransformProxy?.(mesh.userData.proxyId as string, {
      position: [mesh.position.x, mesh.position.y, mesh.position.z],
      rotation: [
        mesh.quaternion.x,
        mesh.quaternion.y,
        mesh.quaternion.z,
        mesh.quaternion.w,
      ],
      scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
    });
  }

  /** Attach the gizmo to a proxy, by id. Lets the console drive selection
   *  from its list as well as from the canvas. */
  selectProxyById(id: string | null) {
    if (!id) {
      this.transform?.detach();
      this.selectedProxy = null;
      return;
    }
    const mesh = this.proxyMeshes.find((m) => m.userData.proxyId === id);
    if (mesh) this.selectProxy(mesh);
  }

  private selectProxy(mesh: THREE.Mesh) {
    this.selectedProxy = mesh;
    this.transform?.attach(mesh);
  }

  /** Switch gizmo mode. Bound to W/E/R by the console, the convention every
   *  3D tool a curator's contractor uses already follows. */
  setGizmoMode(mode: "translate" | "rotate" | "scale") {
    this.transform?.setMode(mode);
  }

  /** Add a proxy to the live scene without a reload, so placing one feels
   *  immediate rather than round-tripping through the server first. */
  addProxy(p: ProxyHotspot) {
    this.createProxyMesh(p);
  }

  /** Remove one, likewise. */
  removeProxy(id: string) {
    const i = this.proxyMeshes.findIndex((m) => m.userData.proxyId === id);
    if (i < 0) return;
    const mesh = this.proxyMeshes[i];
    if (this.selectedProxy === mesh) {
      this.transform?.detach();
      this.selectedProxy = null;
    }
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    this.proxyMeshes.splice(i, 1);
  }

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

  /**
   * Move the camera to an authored viewpoint.
   *
   * This is what makes a guided tour a tour rather than a list of links: a
   * curator chose where to stand for each stop, and arriving at the default
   * framing instead would discard that decision. The same pose drives headset
   * teleport waypoints (§5.2, caveat 3).
   *
   * Animated by default, because a cut between two viewpoints leaves a visitor
   * with no idea whether they moved or the model changed. Under
   * prefers-reduced-motion it jumps: §10.1 makes that mandatory, and vestibular
   * discomfort is exactly what a swooping camera causes.
   */
  flyTo(
    pose: {
      position: [number, number, number];
      target?: [number, number, number];
      fov?: number;
    },
    opts: { animate?: boolean } = {},
  ) {
    const to = new THREE.Vector3(...pose.position);
    const toTarget = pose.target
      ? new THREE.Vector3(...pose.target)
      : this.controls.target.clone();

    if (pose.fov && pose.fov !== this.camera.fov) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }

    const animate = (opts.animate ?? true) && !this.reducedMotion;
    if (!animate) {
      this.flight = null;
      this.camera.position.copy(to);
      this.controls.target.copy(toTarget);
      this.controls.update();
      return;
    }

    this.flight = {
      from: this.camera.position.clone(),
      to,
      fromTarget: this.controls.target.clone(),
      toTarget,
      startedAt: performance.now(),
      duration: 900,
    };
  }

  private tick = () => {
    if (this.destroyed) return;
    this.frame = requestAnimationFrame(this.tick);

    if (this.flight) {
      const elapsed = performance.now() - this.flight.startedAt;
      const t = Math.min(1, elapsed / this.flight.duration);
      // Ease in and out. A linear flight starts and stops abruptly, which
      // reads as a glitch rather than as movement.
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

      this.camera.position.lerpVectors(this.flight.from, this.flight.to, eased);
      this.controls.target.lerpVectors(
        this.flight.fromTarget,
        this.flight.toTarget,
        eased,
      );
      if (t >= 1) this.flight = null;
    }

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
    this.transform?.detach();
    this.transform?.dispose();
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
