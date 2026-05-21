import type { NavNode } from "@klorad/api";
import type { EntityType } from "@klorad/config/workbench";
import { identitySchema } from "../schema";

/**
 * A waypoint in the wayfinding graph — corridor intersection, door,
 * elevator/stair landing, room anchor, or outdoor path junction.
 *
 * The shape comes from `@klorad/api`'s `NavNode`; promoting it to a
 * first-class workbench entity lets graph operations (`nav.add-node`,
 * `nav.connect`, `nav.delete-node`) surface generically through the
 * selection panel, ⌘K, and the right-click menu.
 *
 * Verticals that map indoor space (Heritage, Mobility) reuse the same
 * underlying graph by registering their own per-vertical entity ids
 * that point at the same NavNode payload.
 */
const defaults: NavNode = {
  id: "",
  type: "corridor",
  position: [0, 0],
};

export const navNodeEntity: EntityType<NavNode> = {
  id: "campus.nav-node",
  label: "Nav node",
  schema: identitySchema<NavNode>(),
  defaults,
  views: [],
  operations: [],
};
