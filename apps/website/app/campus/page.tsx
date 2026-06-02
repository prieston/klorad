import type { Metadata } from "next";
import { ProductPage, type ProductData } from "@/components/product-page";

export const metadata: Metadata = {
  title: { absolute: "Klorad Campus | The campus app students actually use" },
  description:
    "Mobile-first PWA for higher-ed campuses — indoor wayfinding, AI assistant, news / events / clubs / dining, push notifications, bilingual EN/ΕΛ. Installable. White-labelled per university.",
  alternates: { canonical: "/campus" },
};

const data: ProductData = {
  product: "Klorad Campus",
  heroImage: "/klorad-campus.webp",
  promise: "The campus app your students actually use.",
  lede:
    "Klorad Campus is a mobile-first, installable PWA per university — indoor wayfinding, news, events, clubs, dining, and an AI assistant that answers in context. Brand it, link your MappedIn venue, share a QR. Students install it once and it lives on their home screen.",
  intro:
    "For Greek higher education first, then any campus that wants a real app without writing one.",
  liveUrl: "https://campus.klorad.com",
  liveLabel: "Open the live campus →",
  capabilities: [
    {
      title: "Native-app feel",
      desc: "Persistent shell, instant tab swaps with skeletons, pull-to-refresh, install-to-home-screen. The same gestures iOS and Android users already trust.",
    },
    {
      title: "Klio, the campus assistant",
      desc: "Ask in plain language — 'step-free route to the library', 'any robotics clubs?', 'what's open for lunch?'. Klio answers with inline source cards that deep-link straight into the right surface.",
    },
    {
      title: "White-labelled per university",
      desc: "Each campus is its own tenant — own name, logo, primary colour, hero, content. The whole palette derives from one hex; theme even tints the mobile browser chrome.",
    },
  ],
  features: [
    {
      title: "Indoor & outdoor wayfinding",
      desc: "Powered by MappedIn — the venue you author once becomes the public viewer. Step-free routes are a first-class toggle, not an afterthought.",
    },
    {
      title: "News · events · clubs · dining",
      desc: "Four content surfaces with bilingual EN + ΕΛ authoring, per-row image upload, building-anchored deep links, schedule-ahead publishing, and ICS feed sync.",
    },
    {
      title: "Klio with cited sources",
      desc: "Claude tool-use answers grounded in your campus data — every mention drops a tappable card to the news post, event, club, dining venue, or directions on the map.",
    },
    {
      title: "Push notifications",
      desc: "Web push subscribed silently on install. Broadcast composer in the dashboard sends to every device. Anonymous endpoints — no student identity collected.",
    },
    {
      title: "QR-shareable everything",
      desc: "Every state of the map is in the URL — building selected, route configured, step highlighted. Generate a QR for a printed sign and students get the exact same view on tap.",
    },
    {
      title: "Five-minute setup, no developer",
      desc: "Rector dashboard: link your MappedIn venue, set the brand colour, write the welcome copy in EN and ΕΛ, publish. The first campus goes live the same morning.",
    },
  ],
  builtOn:
    "Klorad Campus is a world built on the Klorad platform. It runs on the same World model, the three renderers, and the live-data backbone behind every Klorad product — so the same plumbing scales to Mobility, Virtual Heritage, and Urban next.",
  ctaTitle: "Put your campus in your students' pockets.",
};

export default function CampusPage() {
  return <ProductPage data={data} />;
}
