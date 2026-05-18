import type { Metadata } from "next";
import { ProductPage, type ProductData } from "@/components/product-page";

export const metadata: Metadata = {
  title: { absolute: "Klorad Virtual Heritage — Heritage, reconstructed" },
  description:
    "Klorad Virtual Heritage rebuilds cultural sites as immersive, interpretable worlds — for preservation, research, and public access.",
  alternates: { canonical: "/virtual-heritage" },
};

const data: ProductData = {
  product: "Klorad Virtual Heritage",
  promise: "Heritage, reconstructed and understood.",
  lede: "Cultural sites rebuilt as immersive, interpretable worlds — for preservation, for research, and for the public who may never stand there.",
  intro: "For museums, heritage bodies, and research institutions.",
  capabilities: [
    {
      title: "Faithful reconstruction",
      desc: "Sites captured and rebuilt from survey, photogrammetry, and scholarship — accurate to the evidence.",
    },
    {
      title: "Layered interpretation",
      desc: "Meaning placed in context: narratives, periods, and detail attached to the world itself.",
    },
    {
      title: "Access for everyone",
      desc: "A site explorable from a browser or in immersive XR — open beyond the few who can visit.",
    },
  ],
  features: [
    {
      title: "Photogrammetry & 3D tiles",
      desc: "High-fidelity captured geometry, streamed efficiently to any device.",
    },
    {
      title: "Time layers",
      desc: "Move between reconstruction states and historical periods.",
    },
    {
      title: "Guided interpretation",
      desc: "Curated routes and stories that lead visitors through the site.",
    },
    {
      title: "XR & immersive viewing",
      desc: "Step into the reconstruction in virtual reality.",
    },
    {
      title: "Annotation & research notes",
      desc: "Attach scholarship and sources to specific features.",
    },
    {
      title: "Public web access",
      desc: "Publish the world to anyone, on any device, with no install.",
    },
  ],
  builtOn:
    "Klorad Virtual Heritage is a world built on the Klorad platform — the same World model, the three renderers, and the immersive XR layer behind every Klorad product.",
  ctaTitle: "Bring a site back to life.",
};

export default function VirtualHeritagePage() {
  return <ProductPage data={data} />;
}
