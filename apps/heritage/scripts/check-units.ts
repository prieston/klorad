/**
 * Unit checks for the pure logic behind Heritage's harder promises.
 *
 * Deliberately free of network and database access so it can run in CI on a
 * pull request with no credentials. The parts that need real infrastructure —
 * storage, signing, the ingest round trip — live in `check-ingest-e2e.ts` and
 * `check-rights-delivery.ts`, which are run deliberately rather than on every
 * push.
 *
 * Written as plain assertions rather than pulling a test runner into a
 * monorepo that has none, matching the `check-*` convention already here.
 *
 *   pnpm --filter @klorad/heritage check:units
 */
import {
  resolveRights,
  applyScanPolicy,
  permitsDirectFileAccess,
  restrictiveness,
  ALL_RIGHTS,
  RIGHTS_URI,
} from "../lib/heritage/rights";
import { slugify } from "../lib/heritage/slug";
import { pickLocalized, missingLanguages, isFullyTranslated } from "../lib/heritage/i18n";
import {
  extensionOf,
  isAcceptedFor,
  isDeliverable,
  archivalOnlyReason,
  rejectionReason,
} from "../lib/heritage/ingest";
import { parseCanonicalUrl, clampDimension } from "../lib/heritage/oembed";
import { statsFromGltf } from "../lib/heritage/pipeline/gltf-probe";
import { probeImage } from "../lib/heritage/pipeline/image-probe";

let failures = 0;

function describe(name: string): void {
  console.log(`\n${name}`);
}

function ok(label: string, condition: boolean, detail = ""): void {
  console.log(`  ${condition ? "ok  " : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

function eq(label: string, actual: unknown, expected: unknown): void {
  const same = JSON.stringify(actual) === JSON.stringify(expected);
  ok(label, same, same ? "" : `got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

// ---------------------------------------------------------------------------
describe("Rights (§10.2 — the more restrictive of the two always wins)");

eq("unset resolves to in-copyright, not permissive", resolveRights(null, null), "cne");
eq("object-only", resolveRights("cc_by", null), "cc_by");
eq("representation-only", resolveRights(null, "cc_by_nc"), "cc_by_nc");
eq("more restrictive representation wins", resolveRights("cc0", "cne"), "cne");
eq("more restrictive object wins", resolveRights("cne", "cc0"), "cne");
ok(
  "every one of the 14 permitted statements has a URI",
  ALL_RIGHTS.every((r) => typeof RIGHTS_URI[r] === "string" && RIGHTS_URI[r].startsWith("http")),
  `${ALL_RIGHTS.length} statements`,
);
ok(
  "restrictiveness is a total order with no ties",
  new Set(ALL_RIGHTS.map(restrictiveness)).size === ALL_RIGHTS.length,
);
ok("CC0 permits direct file access", permitsDirectFileAccess("cc0"));
ok("in-copyright does not", !permitsDirectFileAccess("cne"));

describe("Scan policy (§7.3 — does scanning a public-domain work create new rights?)");
eq(
  "venue says no: the scan inherits the original's status",
  applyScanPolicy("public_domain_mark", "cne", false),
  "public_domain_mark",
);
eq(
  "venue says yes: the capture's own restriction applies",
  applyScanPolicy("public_domain_mark", "cne", true),
  "cne",
);
eq(
  "policy is irrelevant when the original is not public domain",
  applyScanPolicy("cne", "cc0", false),
  "cne",
);

// ---------------------------------------------------------------------------
describe("Slugs");
eq("Greek is transliterated, not dropped", slugify("Κόρη της Ακρόπολης"), "kori-tis-akropolis");
eq("accents are stripped", slugify("Musée d'Orsay"), "musee-d-orsay");
eq("punctuation collapses", slugify("Head  of  a  Youth!!"), "head-of-a-youth");

// ---------------------------------------------------------------------------
describe("Multilingual fallback (§7.1.6)");
const text = { en: "Amphora", el: "Αμφορέας" };
eq("exact match", pickLocalized(text, "el", "en"), "Αμφορέας");
eq("regional falls back to base language", pickLocalized(text, "el-GR", "en"), "Αμφορέας");
eq("unknown language falls back to the default", pickLocalized(text, "fr", "en"), "Amphora");
eq("empty map yields null", pickLocalized({}, "en", "en"), null);
eq("missing languages are reported", missingLanguages(text, ["en", "el", "fr"]), ["fr"]);
ok("fully translated is true when nothing is missing", isFullyTranslated(text, ["en", "el"]));

// ---------------------------------------------------------------------------
describe("Ingest formats (§5.4, §7.2.1)");
eq("plain extension", extensionOf("capture.GLB"), "glb");
eq("double extension keeps the meaningful marker", extensionOf("site.copc.laz"), "copc");
eq("no extension", extensionOf("README"), "");
ok("a PLY is accepted as a splat master", isAcceptedFor("splat", "cloud.ply"));
ok("a PLY is also accepted as a mesh", isAcceptedFor("mesh", "cloud.ply"));
ok("an EXE is not accepted anywhere", !isAcceptedFor("mesh", "virus.exe"));
ok("rejection names the accepted set", rejectionReason("mesh", "virus.exe").includes("glb"));

ok("GLB is deliverable", isDeliverable("mesh", "model.glb"));
ok("FBX is not", !isDeliverable("mesh", "model.fbx"));
ok("no splat format is deliverable yet", !isDeliverable("splat", "capture.ply"));
eq("a deliverable format has no archival reason", archivalOnlyReason("mesh", "model.glb"), null);
ok(
  "OBJ's reason names the actual next action",
  (archivalOnlyReason("mesh", "model.obj") ?? "").includes(".glb"),
);
ok(
  "splat's reason explains the benchmark, not a generic failure",
  (archivalOnlyReason("splat", "capture.ply") ?? "").includes("benchmark"),
);
ok("TIFF is kept but not published", archivalOnlyReason("image", "scan.tif") !== null);

// ---------------------------------------------------------------------------
describe("oEmbed (§7.1.2)");
ok("an object URL is recognised", parseCanonicalUrl("https://x.test/v/museum/o/kore") !== null);
ok("a scene URL is recognised", parseCanonicalUrl("https://x.test/v/museum/s/gallery") !== null);
eq("a foreign URL is refused", parseCanonicalUrl("https://sketchfab.com/models/abc"), null);
eq("a console URL is not embeddable", parseCanonicalUrl("https://x.test/org/1/venues/2"), null);
// A consumer's `maxwidth` is a ceiling, not a target.
eq("absent maxwidth uses the default", clampDimension(null, 640, 240), 640);
eq("a smaller request is honoured", clampDimension("420", 640, 240), 420);
eq("an unusably small request is floored", clampDimension("10", 640, 240), 240);
eq("a larger request never exceeds the default", clampDimension("4000", 640, 240), 640);
eq("nonsense falls back rather than throwing", clampDimension("wide", 640, 240), 640);

// ---------------------------------------------------------------------------
describe("glTF statistics");

// One mesh, two nodes. Summing meshes directly would report half the
// triangles and a box around the origin — which is exactly what a museum's
// repeated display case or column looks like.
const instanced = {
  scenes: [{ nodes: [0, 1] }],
  nodes: [
    { mesh: 0, translation: [0, 0, 0] },
    { mesh: 0, translation: [10, 0, 0] },
  ],
  meshes: [{ primitives: [{ mode: 4, indices: 0, attributes: { POSITION: 1 } }] }],
  accessors: [
    { count: 36 },
    { count: 24, min: [-1, -1, -1], max: [1, 1, 1] },
  ],
};
const s1 = statsFromGltf(instanced);
eq("an instanced mesh is counted once per instance", s1.triangleCount, 24);
eq("node transforms place the bounding box", s1.boundingBox?.max, [11, 1, 1]);
ok("a placed scene is not marked approximate", !s1.approximate);

// A file with meshes but no scene graph is legal, and must not be silently
// reported as empty.
const graphless = {
  meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }] }],
  accessors: [{ count: 300 }, { count: 100, min: [0, 0, 0], max: [2, 2, 2] }],
};
const s2 = statsFromGltf(graphless);
eq("meshes without a scene graph still count", s2.triangleCount, 100);
ok("and the result says the box is unplaced", s2.approximate);

// `mode` defaults to triangles; points and lines contribute nothing.
eq(
  "point primitives contribute no triangles",
  statsFromGltf({
    meshes: [{ primitives: [{ mode: 0, attributes: { POSITION: 0 } }] }],
    accessors: [{ count: 5000, min: [0, 0, 0], max: [1, 1, 1] }],
  }).triangleCount,
  null,
);
eq(
  "a triangle strip is count minus two",
  statsFromGltf({
    meshes: [{ primitives: [{ mode: 5, indices: 0, attributes: { POSITION: 1 } }] }],
    accessors: [{ count: 10 }, { count: 10, min: [0, 0, 0], max: [1, 1, 1] }],
  }).triangleCount,
  8,
);

// A cycle in the node graph must terminate rather than exhaust the stack.
const cyclic = {
  scenes: [{ nodes: [0] }],
  nodes: [{ children: [1] }, { children: [0], mesh: 0 }],
  meshes: [{ primitives: [{ indices: 0, attributes: { POSITION: 1 } }] }],
  accessors: [{ count: 9 }, { count: 9, min: [0, 0, 0], max: [1, 1, 1] }],
};
ok("a cyclic node graph terminates", statsFromGltf(cyclic).triangleCount === 3);

// ---------------------------------------------------------------------------
describe("Image headers");
const png = new Uint8Array(24);
png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
new DataView(png.buffer).setUint32(16, 1234, false);
new DataView(png.buffer).setUint32(20, 5678, false);
eq("PNG dimensions", probeImage(png, "png"), { width: 1234, height: 5678 });

let threw = false;
try {
  probeImage(new Uint8Array(24), "png");
} catch {
  threw = true;
}
ok("a file that is not a PNG is rejected rather than guessed at", threw);

console.log(
  failures === 0 ? `\nALL PASS` : `\n${failures} FAILED`,
);
process.exit(failures === 0 ? 0 : 1);
