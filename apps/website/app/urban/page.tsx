import type { Metadata } from "next";
import { ProductPage, type ProductData } from "@/components/product-page";

export const metadata: Metadata = {
  title: { absolute: "Klorad Urban — Cities & land as a living model" },
  description:
    "Klorad Urban unifies urban infrastructure and land use into one digital twin — for planning, coordination, and the decisions that shape territory.",
  alternates: { canonical: "/urban" },
};

const data: ProductData = {
  product: "Klorad Urban",
  promise: "Cities and land, as a living model.",
  lede: "Urban infrastructure and land use unified into one digital twin — for planning, coordination, and the decisions that shape territory.",
  intro: "For municipalities, planners, and land authorities.",
  capabilities: [
    {
      title: "Infrastructure unified",
      desc: "Utilities, networks, and built assets in one coordinate-true model instead of disconnected registers.",
    },
    {
      title: "Land & territory",
      desc: "Terrain, parcels, and land use held alongside the infrastructure that sits on them.",
    },
    {
      title: "Plan with evidence",
      desc: "Test zoning, development, and intervention against the actual state of the place.",
    },
  ],
  features: [
    {
      title: "Terrain & land data",
      desc: "Accurate elevation, parcels, and land cover as a base layer.",
    },
    {
      title: "Infrastructure & utilities",
      desc: "Networks and assets located and attributed in 3D.",
    },
    {
      title: "Zoning & land-use overlays",
      desc: "Regulatory layers draped onto the live model.",
    },
    {
      title: "Change over time",
      desc: "Track how the territory evolves across surveys and updates.",
    },
    {
      title: "Multi-stakeholder review",
      desc: "Bring departments and the public into one shared view.",
    },
    {
      title: "Live monitoring",
      desc: "Connect sensors and feeds for an up-to-date picture.",
    },
  ],
  builtOn:
    "Klorad Urban is a world built on the Klorad platform — the same World model, the three renderers, and the live-data backbone behind every Klorad product.",
  ctaTitle: "Model the territory you govern.",
};

export default function UrbanPage() {
  return <ProductPage data={data} />;
}
