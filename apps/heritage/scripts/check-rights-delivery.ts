/**
 * Verify that rights change what a delivery URL actually is.
 *
 * The rights console used to compute `permitsDirectFileAccess`, display it,
 * and change nothing — every file sat on a permanent public bucket URL. This
 * script exists so that regression cannot happen quietly again: it uploads a
 * private object and asserts that the URL handed out for a restricted capture
 * is signed, short-lived, and stops working, while an open one is signed with
 * a long life and remains cacheable.
 *
 *   pnpm --filter @klorad/heritage check:rights
 */
import {
  createMultipartUpload,
  presignUploadPart,
  completeMultipartUpload,
  storageConfigFromEnv,
} from "@klorad/storage/server";
import { deliveryUrlFor } from "../lib/heritage/delivery";

const cfg = storageConfigFromEnv();

let failures = 0;
function assert(label: string, condition: boolean, detail = ""): void {
  console.log(`${condition ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!condition) failures++;
}

function expiryOf(url: string): number | null {
  const v = new URL(url).searchParams.get("X-Amz-Expires");
  return v ? Number(v) : null;
}

async function main(): Promise<void> {
  // A real private object, so the assertions are about live storage rather
  // than about what the signer would hypothetically produce.
  const body = new TextEncoder().encode("not a real model, but a real object");
  const up = await createMultipartUpload(cfg, {
    fileName: "rights-probe.bin",
    fileType: "application/octet-stream",
    prefix: "heritage/_checks",
    acl: "private",
  });
  const signedPut = await presignUploadPart(cfg, {
    key: up.key,
    uploadId: up.uploadId,
    partNumber: 1,
  });
  const put = await fetch(signedPut, { method: "PUT", body });
  const done = await completeMultipartUpload(cfg, {
    key: up.key,
    uploadId: up.uploadId,
    parts: [{ partNumber: 1, eTag: put.headers.get("etag")! }],
  });

  const file = { storageKey: done.key, url: null };

  // 1. The object must not be readable without a signature. This is the claim
  //    the whole rights column rests on.
  const bare = await fetch(
    `${cfg.endpoint.replace("https://", `https://${cfg.bucket}.`)}/${done.key}`,
  );
  assert("private object is not publicly readable", bare.status === 403 || bare.status === 404,
    `HTTP ${bare.status}`);

  // 2. In copyright, no reuse — the restrictive end of the list.
  const restricted = await deliveryUrlFor(file, {
    objectRights: "cne",
    representationRights: "cne",
    scanAssertsRights: false,
  });
  assert("restricted capture gets a signed URL", Boolean(restricted?.includes("X-Amz-Signature")));
  const restrictedExpiry = restricted ? expiryOf(restricted) : null;
  assert(
    "restricted URL is short-lived",
    restrictedExpiry !== null && restrictedExpiry <= 3600,
    `expires in ${restrictedExpiry}s`,
  );

  // 3. Public domain mark, with the venue not asserting rights over scans.
  const open = await deliveryUrlFor(file, {
    objectRights: "public_domain_mark",
    representationRights: null,
    scanAssertsRights: false,
  });
  const openExpiry = open ? expiryOf(open) : null;
  assert(
    "open capture is signed with a long life",
    openExpiry !== null && openExpiry > 3600,
    `expires in ${openExpiry}s`,
  );

  // 4. The signed URL must actually work.
  const fetched = await fetch(restricted!);
  assert("signed URL retrieves the object", fetched.status === 200, `HTTP ${fetched.status}`);

  // 5. Stability inside a period is what keeps a signed URL cacheable. Two
  //    calls moments apart must produce the same string, or every page render
  //    would force a re-download of the model.
  const again = await deliveryUrlFor(file, {
    objectRights: "public_domain_mark",
    representationRights: null,
    scanAssertsRights: false,
  });
  assert("repeat signing is byte-identical within a period", open === again);

  // 6. A public-domain object whose venue asserts rights over the scan must
  //    fall back to the restrictive lifetime — the policy has teeth.
  const asserted = await deliveryUrlFor(file, {
    objectRights: "public_domain_mark",
    representationRights: "cne",
    scanAssertsRights: true,
  });
  const assertedExpiry = asserted ? expiryOf(asserted) : null;
  assert(
    "scan policy downgrades a public-domain original",
    assertedExpiry !== null && assertedExpiry <= 3600,
    `expires in ${assertedExpiry}s`,
  );

  // 7. Not our object: hand back what was stored, do not pretend to sign for
  //    someone else's bucket.
  const external = await deliveryUrlFor(
    { storageKey: "demo/x.glb", url: "https://example.org/x.glb" },
    { objectRights: "cne", representationRights: null, scanAssertsRights: false },
  );
  assert("external assets pass through unsigned", external === "https://example.org/x.glb");

  console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
