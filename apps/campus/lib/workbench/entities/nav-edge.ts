import type { NavEdge } from "@klorad/api";
import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

/**
 * An edge in the wayfinding graph — a walkable connection between
 * two {@link NavNode} waypoints. Carries optional cost overrides for
 * elevator/stair transitions where great-circle distance is ~0, and
 * an accessibility flag that defaults to the AND of its endpoints.
 *
 * Promoting it to a workbench entity lets graph operations
 * (`nav.connect`, `nav.delete-edge`, `nav.toggle-accessible`)
 * surface generically with `scope: ["campus.nav-edge"]`.
 */
const defaults: NavEdge = {
  id: "",
  fromNodeId: "",
  toNodeId: "",
};

export const navEdgeEntity: EntityType<NavEdge> = {
  id: "campus.nav-edge",
  label: "Nav edge",
  schema: identitySchema<NavEdge>(),
  defaults,
  views: [],
  operations: [],
};
