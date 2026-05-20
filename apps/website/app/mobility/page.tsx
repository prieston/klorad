import type { Metadata } from "next";
import { ProductPage, type ProductData } from "@/components/product-page";

export const metadata: Metadata = {
  title: { absolute: "Klorad Mobility | Roads, ITS & corridors" },
  description:
    "Klorad Mobility brings corridors, junctions, signaling, and ITS telemetry into one continuous environment. See how a decision propagates before it is made.",
  alternates: { canonical: "/mobility" },
};

const data: ProductData = {
  product: "Klorad Mobility",
  heroImage: "/klorad-mobility.webp",
  promise: "Road networks, made legible.",
  lede: "Optimize live routing efficiency and simulate transit throughput via real-time IoT sensor integration. Corridors, junctions, signaling and ITS telemetry brought into one continuous environment.",
  intro: "For road authorities, operators, and mobility teams.",
  capabilities: [
    {
      title: "Corridors as one model",
      desc: "Roads, junctions, and signaling held as a single environment instead of scattered systems and spreadsheets.",
    },
    {
      title: "Live ITS telemetry",
      desc: "Traffic flow, sensor output, and device state stream into the model in real time.",
    },
    {
      title: "Decisions, rehearsed",
      desc: "Evaluate an intervention against the network before it is enacted, not after.",
    },
  ],
  features: [
    {
      title: "Traffic & signal state",
      desc: "See current flow and signal status across the corridor at a glance.",
    },
    {
      title: "Sensor & ITS integration",
      desc: "Connect roadside devices, detectors, and telemetry feeds.",
    },
    {
      title: "Incident views",
      desc: "Locate, contextualise, and track incidents in their real position.",
    },
    {
      title: "Maintenance windows",
      desc: "Plan and visualise works against live network conditions.",
    },
    {
      title: "Policy overlays",
      desc: "Layer speed, access, and zoning rules onto the live network.",
    },
    {
      title: "Control-room sync",
      desc: "Operators and field teams working from one shared picture.",
    },
  ],
  builtOn:
    "Klorad Mobility is a world built on the Klorad platform. It runs on the same World model, the three renderers, and the live-data backbone behind every Klorad product.",
  ctaTitle: "See your network as one.",
};

export default function MobilityPage() {
  return <ProductPage data={data} />;
}
