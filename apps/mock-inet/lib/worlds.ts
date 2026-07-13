/**
 * World store — in-memory. A World is a saved `WorldFilter` plus a
 * shareable install URL. The install URL is where the PSMdt-iNET app
 * bootstraps a scoped inventory.
 */
import { randomUUID } from "node:crypto";
import type { World, WorldCreate } from "./types";

const store: Map<string, World> = new Map();

export function listWorlds(): World[] {
  return Array.from(store.values()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  );
}

export function getWorld(idOrSlug: string): World | undefined {
  if (store.has(idOrSlug)) return store.get(idOrSlug);
  for (const w of store.values()) {
    if (w.slug === idOrSlug) return w;
  }
  return undefined;
}

export function createWorld(input: WorldCreate, host: string): World {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  const world: World = {
    id: randomUUID(),
    slug,
    name: input.name,
    filter: input.filter,
    installUrl: `${host.replace(/\/$/, "")}/w/${slug}`,
    createdAt: new Date().toISOString(),
  };
  store.set(world.id, world);
  return world;
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || randomUUID().slice(0, 8)
  );
}
