import type { HeritageRights } from "@prisma/client";

/**
 * Rights resolution.
 *
 * §7.2.6 and §10.2: every record delivered to Europeana carries one of exactly
 * 14 permitted `edm:rights` URIs, and where the physical object and the digital
 * representation differ in status, **the more restrictive applies**. That rule
 * is not a formatting detail — it decides what a visitor is allowed to
 * download and what an aggregator is allowed to republish, so it lives in one
 * place and every read path goes through it.
 *
 * The enum values in the Prisma schema are deliberately opaque short codes;
 * this module owns the mapping to the canonical URIs and the ordering.
 */

/** The 14 permitted URIs, canonical form. */
export const RIGHTS_URI: Record<HeritageRights, string> = {
  cc0: "http://creativecommons.org/publicdomain/zero/1.0/",
  public_domain_mark: "http://creativecommons.org/publicdomain/mark/1.0/",
  cc_by: "http://creativecommons.org/licenses/by/4.0/",
  cc_by_sa: "http://creativecommons.org/licenses/by-sa/4.0/",
  cc_by_nd: "http://creativecommons.org/licenses/by-nd/4.0/",
  cc_by_nc: "http://creativecommons.org/licenses/by-nc/4.0/",
  cc_by_nc_sa: "http://creativecommons.org/licenses/by-nc-sa/4.0/",
  cc_by_nc_nd: "http://creativecommons.org/licenses/by-nc-nd/4.0/",
  noc_nc: "http://rightsstatements.org/vocab/NoC-NC/1.0/",
  noc_oklr: "http://rightsstatements.org/vocab/NoC-OKLR/1.0/",
  in_c: "http://rightsstatements.org/vocab/InC/1.0/",
  in_c_edu: "http://rightsstatements.org/vocab/InC-EDU/1.0/",
  in_c_ow_eu: "http://rightsstatements.org/vocab/InC-OW-EU/1.0/",
  cne: "http://rightsstatements.org/vocab/CNE/1.0/",
};

/** Short human labels for the curator console. */
export const RIGHTS_LABEL: Record<HeritageRights, string> = {
  cc0: "CC0 1.0 (public domain dedication)",
  public_domain_mark: "Public Domain Mark 1.0",
  cc_by: "CC BY 4.0",
  cc_by_sa: "CC BY-SA 4.0",
  cc_by_nd: "CC BY-ND 4.0",
  cc_by_nc: "CC BY-NC 4.0",
  cc_by_nc_sa: "CC BY-NC-SA 4.0",
  cc_by_nc_nd: "CC BY-NC-ND 4.0",
  noc_nc: "No Copyright — Non-Commercial Use Only",
  noc_oklr: "No Copyright — Other Known Legal Restrictions",
  in_c: "In Copyright",
  in_c_edu: "In Copyright — Educational Use Permitted",
  in_c_ow_eu: "In Copyright — EU Orphan Work",
  cne: "Copyright Not Evaluated",
};

/**
 * Restrictiveness rank, ascending: 0 is the most permissive.
 *
 * The ordering encodes what a reuser may actually do — redistribute, adapt,
 * use commercially — not the alphabetical or legal-family order. Ties are
 * broken toward caution.
 *
 * `cne` (Copyright Not Evaluated) ranks at the top with `in_c`: an
 * unevaluated status is not permission, and treating it as permissive is the
 * mistake that gets an institution's material republished when it should not
 * have been.
 */
const RANK: Record<HeritageRights, number> = {
  cc0: 0,
  public_domain_mark: 1,
  cc_by: 2,
  cc_by_sa: 3,
  cc_by_nd: 4,
  cc_by_nc: 5,
  cc_by_nc_sa: 6,
  cc_by_nc_nd: 7,
  noc_nc: 8,
  noc_oklr: 9,
  in_c_edu: 10,
  in_c_ow_eu: 11,
  in_c: 12,
  cne: 13,
};

export function restrictiveness(value: HeritageRights): number {
  return RANK[value];
}

/**
 * Resolve the rights that actually govern a representation, given the rights
 * on the physical original and the rights on the representation itself.
 *
 * Returns the more restrictive of the two. When only one side is set, that one
 * governs. When neither is set the answer is `cne` — Copyright Not Evaluated —
 * because "nobody filled the field in" is exactly what that statement means,
 * and inventing a permissive default here would publish material the
 * institution never cleared.
 */
export function resolveRights(
  objectRights: HeritageRights | null | undefined,
  representationRights: HeritageRights | null | undefined,
): HeritageRights {
  if (objectRights && representationRights) {
    return restrictiveness(objectRights) >= restrictiveness(representationRights)
      ? objectRights
      : representationRights;
  }
  return objectRights ?? representationRights ?? "cne";
}

/**
 * Whether a resolved statement permits offering the underlying file for
 * download, as opposed to viewing it in the platform's own viewer.
 *
 * Used by the public surfaces: an `edm:hasView` direct file URL scores a
 * higher Europeana content tier (§7.4.3), but only where the rights allow the
 * file to be handed over at all.
 */
export function permitsDirectFileAccess(value: HeritageRights): boolean {
  return restrictiveness(value) <= restrictiveness("noc_oklr");
}

/**
 * Whether the tenant's public-domain-scan policy should apply.
 *
 * §7.2.6: whether a faithful 3D scan of a public-domain object generates new
 * copyright is legally contested in Europe. Directive 2019/790 Art. 14 says
 * reproductions of public-domain visual artworks are not protected, but its
 * application to scans is unsettled and many institutions assert rights
 * anyway. The spec's instruction is explicit — do not hard-code a position.
 *
 * So: when the original is public domain and the tenant has *not* opted into
 * asserting rights over scans, the representation is pulled down to the
 * original's status rather than being allowed to restrict it.
 */
export function applyScanPolicy(
  objectRights: HeritageRights | null | undefined,
  representationRights: HeritageRights | null | undefined,
  scanAssertsRights: boolean,
): HeritageRights {
  const originalIsPublicDomain =
    objectRights === "cc0" || objectRights === "public_domain_mark";
  if (originalIsPublicDomain && !scanAssertsRights) {
    return objectRights;
  }
  return resolveRights(objectRights, representationRights);
}

export const ALL_RIGHTS = Object.keys(RANK) as HeritageRights[];
