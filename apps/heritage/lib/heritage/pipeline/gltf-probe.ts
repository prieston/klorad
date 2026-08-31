/**
 * Read a glTF/GLB scene description without downloading the asset.
 *
 * A glTF binary puts its entire scene graph — every accessor count, every
 * per-attribute min/max — in a JSON chunk at the front of the file. Triangle
 * counts and bounding boxes are therefore answerable from the first megabyte
 * of a twenty-gigabyte capture. The geometry itself never has to move.
 *
 * The maths here is written out by hand rather than borrowed from three.js
 * because `three` may not be imported outside `packages/engine-three` — the
 * `THREEJS_IMPORT_OUTSIDE_ENGINE` audit enforces it, and this is server code
 * that has no business pulling a renderer in regardless.
 */

/** Bytes of the file to fetch when probing. Comfortably past the JSON chunk of
 *  a scene with thousands of nodes; far short of anything expensive. */
export const GLTF_PROBE_BYTES = 4 * 1024 * 1024;

const GLB_MAGIC = 0x46546c67; // "glTF", little-endian
const CHUNK_JSON = 0x4e4f534a; // "JSON"

export interface GltfStats {
  triangleCount: number | null;
  boundingBox: { min: [number, number, number]; max: [number, number, number] } | null;
  /** True when the box is a union of untransformed accessor extents because
   *  the file declared no scene graph to place them with. Recorded rather than
   *  hidden: a curator comparing this to their source tool's figure deserves
   *  to know which number they are looking at. */
  approximate: boolean;
}

/** Thrown when the bytes are not the format the extension claims. Distinct
 *  from "could not derive statistics", which is not a failure. */
export class GltfFormatError extends Error {}

type Json = Record<string, unknown>;

/** Extract the glTF JSON document from either container form. */
export function parseGltfJson(bytes: Uint8Array, extension: string): Json {
  if (extension === "glb") return parseGlbJson(bytes);

  // A .gltf is plain JSON. If the read was truncated mid-document the parse
  // throws, and that is reported as a probe failure rather than a bad file —
  // a 40 MB base64-embedded .gltf is legal, just larger than we choose to read.
  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text) as Json;
  } catch {
    throw new GltfFormatError(
      "The file could not be read as glTF JSON. If it is valid but very large, re-export it as .glb — the binary container keeps the scene description separate from the geometry.",
    );
  }
}

function parseGlbJson(bytes: Uint8Array): Json {
  if (bytes.byteLength < 20) {
    throw new GltfFormatError(
      "The file is too short to be a GLB. It may have been truncated during upload.",
    );
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== GLB_MAGIC) {
    throw new GltfFormatError(
      "This is not a GLB file. The name ends in .glb but the contents do not begin with the glTF header — check that the export finished and that the file was not renamed from another format.",
    );
  }
  const chunkLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== CHUNK_JSON) {
    throw new GltfFormatError(
      "This GLB does not start with a JSON chunk, which every valid glTF 2.0 binary must.",
    );
  }
  const end = 20 + chunkLength;
  if (end > bytes.byteLength) {
    throw new GltfFormatError(
      "This GLB's scene description is larger than the probe window, so it could not be validated.",
    );
  }
  const text = new TextDecoder().decode(bytes.subarray(20, end));
  try {
    return JSON.parse(text) as Json;
  } catch {
    throw new GltfFormatError("This GLB's JSON chunk is not valid JSON — the file appears corrupt.");
  }
}

// ---------------------------------------------------------------------------
// Minimal 4×4 column-major maths, matching glTF's own convention.
// ---------------------------------------------------------------------------

type Mat4 = number[];

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[row] * b[col * 4] +
        a[4 + row] * b[col * 4 + 1] +
        a[8 + row] * b[col * 4 + 2] +
        a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

/** Compose translation · rotation · scale, the order glTF specifies. */
function fromTrs(t: number[], r: number[], s: number[]): Mat4 {
  const [x, y, z, w] = r;
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const [sx, sy, sz] = s;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    t[0], t[1], t[2], 1,
  ];
}

function nodeMatrix(node: Json): Mat4 {
  const m = node.matrix;
  if (Array.isArray(m) && m.length === 16) return m as Mat4;
  const t = (Array.isArray(node.translation) ? node.translation : [0, 0, 0]) as number[];
  const r = (Array.isArray(node.rotation) ? node.rotation : [0, 0, 0, 1]) as number[];
  const s = (Array.isArray(node.scale) ? node.scale : [1, 1, 1]) as number[];
  return fromTrs(t, r, s);
}

function transformPoint(m: Mat4, p: [number, number, number]): [number, number, number] {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

// ---------------------------------------------------------------------------

function trianglesInPrimitive(prim: Json, accessors: Json[]): number {
  // `mode` defaults to 4 (TRIANGLES) when absent — the single most common case
  // in exported assets, and the one an `?? 4` would silently get right for the
  // wrong reason if the property were ever explicitly null.
  const mode = typeof prim.mode === "number" ? prim.mode : 4;
  if (mode < 4) return 0; // points and lines contribute no triangles

  const indices = typeof prim.indices === "number" ? accessors[prim.indices] : undefined;
  const attributes = (prim.attributes ?? {}) as Json;
  const position =
    typeof attributes.POSITION === "number" ? accessors[attributes.POSITION] : undefined;

  const count = Number(indices?.count ?? position?.count ?? 0);
  if (!Number.isFinite(count) || count <= 0) return 0;

  // 4 = TRIANGLES, 5 = TRIANGLE_STRIP, 6 = TRIANGLE_FAN.
  return mode === 4 ? Math.floor(count / 3) : Math.max(0, count - 2);
}

function primitiveCorners(prim: Json, accessors: Json[]): [number, number, number][] {
  const attributes = (prim.attributes ?? {}) as Json;
  if (typeof attributes.POSITION !== "number") return [];
  const acc = accessors[attributes.POSITION];
  const min = acc?.min;
  const max = acc?.max;
  if (!Array.isArray(min) || !Array.isArray(max)) return [];
  if (min.length < 3 || max.length < 3) return [];

  const corners: [number, number, number][] = [];
  for (let i = 0; i < 8; i++) {
    corners.push([
      (i & 1 ? max : min)[0] as number,
      (i & 2 ? max : min)[1] as number,
      (i & 4 ? max : min)[2] as number,
    ]);
  }
  return corners;
}

/**
 * Derive triangle count and world-space bounding box from a parsed document.
 *
 * Walks the scene graph so that an instanced mesh is counted once per
 * instance and placed by its node transform. Summing meshes directly would
 * undercount a scene that reuses one mesh across forty nodes — exactly what a
 * museum's column or display-case asset looks like.
 */
export function statsFromGltf(doc: Json): GltfStats {
  const accessors = (Array.isArray(doc.accessors) ? doc.accessors : []) as Json[];
  const meshes = (Array.isArray(doc.meshes) ? doc.meshes : []) as Json[];
  const nodes = (Array.isArray(doc.nodes) ? doc.nodes : []) as Json[];
  const scenes = (Array.isArray(doc.scenes) ? doc.scenes : []) as Json[];

  let triangles = 0;
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let sawGeometry = false;

  const include = (corners: [number, number, number][], matrix: Mat4) => {
    for (const corner of corners) {
      const [x, y, z] = transformPoint(matrix, corner);
      if (x < min[0]) min[0] = x;
      if (y < min[1]) min[1] = y;
      if (z < min[2]) min[2] = z;
      if (x > max[0]) max[0] = x;
      if (y > max[1]) max[1] = y;
      if (z > max[2]) max[2] = z;
      sawGeometry = true;
    }
  };

  const rootIndices = new Set<number>();
  for (const scene of scenes) {
    if (Array.isArray(scene.nodes)) {
      for (const n of scene.nodes) if (typeof n === "number") rootIndices.add(n);
    }
  }
  // A file may omit `scenes` and still list nodes. Treating every node as a
  // root then double-counts children, so only fall back when there is no
  // scene at all.
  if (rootIndices.size === 0 && nodes.length > 0) {
    const childOf = new Set<number>();
    for (const node of nodes) {
      if (Array.isArray(node.children)) {
        for (const c of node.children) if (typeof c === "number") childOf.add(c);
      }
    }
    nodes.forEach((_, i) => {
      if (!childOf.has(i)) rootIndices.add(i);
    });
  }

  // Iterative walk with an explicit stack and a visited set: a malformed file
  // can describe a cycle, and a recursive walk would blow the stack on data we
  // do not control.
  const visited = new Set<number>();
  const stack: { index: number; parent: Mat4 }[] = [...rootIndices].map((index) => ({
    index,
    parent: IDENTITY,
  }));

  while (stack.length > 0) {
    const { index, parent } = stack.pop()!;
    const node = nodes[index];
    if (!node || visited.has(index)) continue;
    visited.add(index);

    const world = multiply(parent, nodeMatrix(node));

    if (typeof node.mesh === "number") {
      const mesh = meshes[node.mesh];
      const primitives = (Array.isArray(mesh?.primitives) ? mesh.primitives : []) as Json[];
      for (const prim of primitives) {
        triangles += trianglesInPrimitive(prim, accessors);
        include(primitiveCorners(prim, accessors), world);
      }
    }

    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        if (typeof child === "number") stack.push({ index: child, parent: world });
      }
    }
  }

  // No scene graph at all — count and union the meshes where they sit.
  let approximate = false;
  if (visited.size === 0 && meshes.length > 0) {
    approximate = true;
    for (const mesh of meshes) {
      const primitives = (Array.isArray(mesh.primitives) ? mesh.primitives : []) as Json[];
      for (const prim of primitives) {
        triangles += trianglesInPrimitive(prim, accessors);
        include(primitiveCorners(prim, accessors), IDENTITY);
      }
    }
  }

  return {
    triangleCount: triangles > 0 ? triangles : null,
    boundingBox: sawGeometry ? { min, max } : null,
    approximate,
  };
}
