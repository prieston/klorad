/**
 * Verify the ingest probes against real assets.
 *
 * Runs the glTF and image header parsers over the Khronos sample models — the
 * same files the demo seed points at — and over headers constructed locally so
 * the expected dimensions are known exactly rather than asserted against
 * whatever the parser happens to return.
 *
 * Deliberately fetches only the first 4 MB of each model with a Range request:
 * that is the same read the pipeline performs in production, so a regression
 * in "the JSON chunk fits in the probe window" is caught here rather than on a
 * curator's upload.
 *
 *   pnpm --filter @klorad/heritage check:probe
 */
import { parseGltfJson, statsFromGltf, GLTF_PROBE_BYTES } from "../lib/heritage/pipeline/gltf-probe";
import { probeImage } from "../lib/heritage/pipeline/image-probe";

const MODELS = ["Box", "BoxTextured", "Duck", "DamagedHelmet", "Avocado", "Lantern"];

const url = (n: string) =>
  `https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/${n}/glTF-Binary/${n}.glb`;

let failures = 0;

function assert(label: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

async function main(): Promise<void> {
  for (const name of MODELS) {
    let bytes: Uint8Array;
    try {
      const res = await fetch(url(name), {
        headers: { Range: `bytes=0-${GLTF_PROBE_BYTES - 1}` },
      });
      if (!res.ok) {
        assert(`${name}: fetch`, false, `HTTP ${res.status}`);
        continue;
      }
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (error) {
      assert(`${name}: fetch`, false, (error as Error).message);
      continue;
    }

    try {
      const stats = statsFromGltf(parseGltfJson(bytes, "glb"));
      const box = stats.boundingBox
        ? `[${stats.boundingBox.min.map((v) => v.toFixed(2)).join(", ")}] → [${stats.boundingBox.max
            .map((v) => v.toFixed(2))
            .join(", ")}]`
        : "none";
      assert(
        `${name}: ${stats.triangleCount?.toLocaleString() ?? "?"} triangles, box ${box}${
          stats.approximate ? " (no scene graph)" : ""
        }`,
        (stats.triangleCount ?? 0) > 0 && stats.boundingBox !== null,
      );
    } catch (error) {
      assert(`${name}: probe`, false, (error as Error).message);
    }
  }

  // A file renamed to .glb must be caught here, not by a visitor's blank viewer.
  const pngHeader = new Uint8Array(24);
  pngHeader.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  try {
    parseGltfJson(pngHeader, "glb");
    assert("rejects a PNG renamed to .glb", false, "no error was thrown");
  } catch (error) {
    assert("rejects a PNG renamed to .glb", (error as Error).message.includes("not a GLB"));
  }

  // Locally built headers: the expected answer is known, not inferred.
  const png = new Uint8Array(24);
  png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(png.buffer).setUint32(16, 4096, false);
  new DataView(png.buffer).setUint32(20, 2160, false);
  const p = probeImage(png, "png");
  assert("PNG 4096 × 2160", p.width === 4096 && p.height === 2160, `${p.width} × ${p.height}`);

  // SOF0 marker at offset 2; height at marker+3, width at marker+5 within the
  // segment payload, i.e. absolute offsets 7 and 9.
  const jpg = new Uint8Array(24);
  jpg.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  new DataView(jpg.buffer).setUint16(7, 1080, false);
  new DataView(jpg.buffer).setUint16(9, 1920, false);
  const j = probeImage(jpg, "jpeg");
  assert("JPEG 1920 × 1080", j.width === 1920 && j.height === 1080, `${j.width} × ${j.height}`);

  // WebP VP8X stores canvas size minus one across three little-endian bytes.
  const webp = new Uint8Array(30);
  webp.set(new TextEncoder().encode("RIFF"), 0);
  webp.set(new TextEncoder().encode("WEBP"), 8);
  webp.set(new TextEncoder().encode("VP8X"), 12);
  const w = 8000 - 1;
  const h = 4000 - 1;
  webp[24] = w & 0xff;
  webp[25] = (w >> 8) & 0xff;
  webp[26] = (w >> 16) & 0xff;
  webp[27] = h & 0xff;
  webp[28] = (h >> 8) & 0xff;
  webp[29] = (h >> 16) & 0xff;
  const wp = probeImage(webp, "webp");
  assert("WebP 8000 × 4000", wp.width === 8000 && wp.height === 4000, `${wp.width} × ${wp.height}`);

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
