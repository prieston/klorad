import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireVenueAccess } from "@/lib/authz";
import { features } from "@/lib/env";
import { pickLocalized } from "@/lib/heritage/i18n";
import { NewItemForm } from "./NewItemForm";

type Params = Promise<{ orgId: string; venueId: string }>;

export const metadata = { title: "Add an item" };

/**
 * Add one item, starting from the file.
 *
 * The console used to require the opposite order: create an abstract object
 * record, then separately upload a capture, then join the two. That is the
 * order the database stores them in — CIDOC-CRM keeps the thing and its
 * depiction apart, correctly — and it is not the order anyone thinks in.
 * People arrive holding a model of a statue, not an intention to author a
 * record.
 *
 * So this screen takes the file first and builds the record around it. The
 * separation survives underneath, untouched; it simply stops being the
 * curator's problem.
 */
export default async function NewItemPage({ params }: { params: Params }) {
  const { orgId, venueId } = await params;
  const access = await requireVenueAccess(venueId, "write");
  if (access.denied) notFound();

  const venue = await prisma.heritageVenue.findUnique({
    where: { id: venueId },
    select: { defaultLanguage: true, languages: true },
  });
  if (!venue) notFound();

  const places = await prisma.heritageSpace.findMany({
    where: { venueId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true },
  });

  return (
    <NewItemForm
      orgId={orgId}
      venueId={venueId}
      defaultLanguage={venue.defaultLanguage}
      storageConfigured={features.uploads}
      places={places.map((p) => ({
        id: p.id,
        label: pickLocalized(p.name, venue.defaultLanguage, "en") ?? "Untitled",
      }))}
    />
  );
}
