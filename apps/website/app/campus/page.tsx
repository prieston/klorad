import type { Metadata } from "next";
import { ProductPage, type ProductData } from "@/components/product-page";

export const metadata: Metadata = {
  title: { absolute: "Klorad Campus — Campus mapping & wayfinding" },
  description:
    "Klorad Campus turns a campus into a navigable digital twin — indoor and outdoor wayfinding, room-level detail, and live points of interest.",
  alternates: { canonical: "/campus" },
};

const data: ProductData = {
  product: "Klorad Campus",
  heroImage: "/klorad-campus.webp",
  promise: "Campuses people can navigate.",
  lede: "Indoor and outdoor wayfinding, room-level detail, and live points of interest — a digital twin of your campus that works as well on a screen as on foot.",
  intro: "For universities, hospitals, and corporate campuses.",
  capabilities: [
    {
      title: "Indoor meets outdoor",
      desc: "One continuous map from the main gate to the third-floor lab — no break between outside and in.",
    },
    {
      title: "Modeled to the room",
      desc: "Every building rendered with floors, entrances, and accessible routes — not just a footprint on a map.",
    },
    {
      title: "Live points of interest",
      desc: "Events, services, and facilities surfaced in place and kept current, so the map reflects the campus today.",
    },
  ],
  features: [
    {
      title: "Wayfinding & directions",
      desc: "Turn-by-turn routing between any two points, indoor or out.",
    },
    {
      title: "Floor-by-floor navigation",
      desc: "Move through buildings level by level, with rooms and entrances in place.",
    },
    {
      title: "Accessibility routing",
      desc: "Step-free paths, ramps, and lifts as first-class route options.",
    },
    {
      title: "Search & filtering",
      desc: "Find a department, a service, or an event and see it located instantly.",
    },
    {
      title: "Embeddable & shareable",
      desc: "Drop the map into any site, or share a deep link to a single place.",
    },
    {
      title: "Self-service editing",
      desc: "Update places, events, and content from a dashboard — no developer needed.",
    },
  ],
  builtOn:
    "Klorad Campus is a world built on the Klorad platform — the same World model, the three renderers, and the live-data backbone behind every Klorad product.",
  ctaTitle: "Put your campus on the map.",
};

export default function CampusPage() {
  return <ProductPage data={data} />;
}
