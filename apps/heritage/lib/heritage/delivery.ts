import "server-only";
import type { HeritageRights } from "@prisma/client";
import { presignDownload, storageConfigFromEnv } from "@klorad/storage/server";
import { applyScanPolicy, permitsDirectFileAccess } from "./rights";

/**
 * Turn a stored file into a URL a browser can load, honouring its rights.
 *
 * Until now the rights console computed `permitsDirectFileAccess`, displayed
 * it, and changed nothing: every file sat on a public bucket URL that anyone
 * who saw it could keep forever. A screen that tells a curator an in-copyright
 * capture is not downloadable, while it is, is worse than not having the
 * screen — museums make licensing commitments to lenders on the strength of
 * exactly that claim.
 *
 * So delivery URLs are minted per request against private objects. What varies
 * with rights is how long they live, not whether they exist: an openly-licensed
 * scan is meant to be taken and reused, and making it awkward would betray the
 * licence as surely as leaking the restricted one betrays the lender.
 */

/** Public-domain and open licences. Long enough to cache well; still not
 *  permanent, because a curator who corrects a rights statement should not
 *  have to assume the old URL is loose in the world indefinitely. */
const OPEN_BUCKET_SECONDS = 24 * 60 * 60;

/** Everything else. Between one and two of these in practice — see the note on
 *  `presignDownload` about why a bucketed signing time trades an exact
 *  lifetime for a cacheable URL. */
const RESTRICTED_BUCKET_SECONDS = 15 * 60;

/** Objects Klorad wrote. Anything else — a demo asset pointing at an external
 *  sample repository, a URL a curator pasted — is not ours to sign for. */
const OWNED_PREFIX = "heritage/";

export interface DeliverableFile {
  storageKey: string;
  url: string | null;
}

export interface DeliveryContext {
  objectRights: HeritageRights | null | undefined;
  representationRights: HeritageRights | null | undefined;
  /** The venue's §7.3 policy on whether scanning a public-domain work asserts
   *  new rights over the scan. */
  scanAssertsRights: boolean;
}

export function isOwnedObject(storageKey: string): boolean {
  return storageKey.startsWith(OWNED_PREFIX);
}

/**
 * Resolve one file to a loadable URL, or null if there is nothing to serve.
 *
 * Falls back to the stored `url` for objects Klorad does not own, which is how
 * externally-hosted demo assets keep working without pretending we can sign
 * for someone else's bucket.
 */
export async function deliveryUrlFor(
  file: DeliverableFile,
  context: DeliveryContext,
): Promise<string | null> {
  if (!isOwnedObject(file.storageKey)) return file.url;

  const rights = applyScanPolicy(
    context.objectRights,
    context.representationRights,
    context.scanAssertsRights,
  );
  const bucketSeconds = permitsDirectFileAccess(rights)
    ? OPEN_BUCKET_SECONDS
    : RESTRICTED_BUCKET_SECONDS;

  try {
    return await presignDownload(storageConfigFromEnv(), {
      key: file.storageKey,
      bucketSeconds,
      // Twice the period, so the shortest real lifetime is one full period
      // rather than a URL that expires the instant it is handed over.
      expiresIn: bucketSeconds * 2,
    });
  } catch {
    // Storage is misconfigured. Returning null renders the "not published yet"
    // state, which is wrong but harmless; returning a public bucket URL as a
    // fallback would silently undo the entire point of this module.
    return null;
  }
}

/** Resolve several files together. Signing is local — no network round trip —
 *  so this stays cheap even for a scene with dozens of layers. */
export async function deliveryUrlsFor<T extends DeliverableFile>(
  files: readonly T[],
  context: DeliveryContext,
): Promise<(string | null)[]> {
  return Promise.all(files.map((f) => deliveryUrlFor(f, context)));
}
