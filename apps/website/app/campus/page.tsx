import type { Metadata } from "next";
import { ProductPage, type ProductData } from "@/components/product-page";

export const metadata: Metadata = {
  title: { absolute: "Klorad Campus | The campus app students actually use" },
  description:
    "Mobile-first PWA for higher-ed campuses: indoor wayfinding, an AI assistant, news, events, clubs, dining, and measurable push notifications. Bilingual EN and EL. Built for international presence and institutional data ownership. White-labelled per university.",
  alternates: { canonical: "/campus" },
};

const data: ProductData = {
  product: "Klorad Campus",
  heroImage: "/klorad-campus.webp",
  promise: "The campus app your students actually use.",
  lede:
    "Klorad Campus is a mobile-first, installable PWA per university. It carries indoor wayfinding, news, events, clubs, dining, and an AI assistant that answers in context. Brand it, link your MappedIn venue, share a QR. Students install it once and it lives on their home screen.",
  intro:
    "For Greek higher education first, then any campus that wants a real app without writing one.",
  liveUrl: "https://campus.klorad.com",
  liveLabel: "Open the live campus →",

  problem: {
    title: "Today, campus information is scattered.",
    body: "Students and prospective students hunt for what matters across channels the institution does not control. Announcements get buried, reach is never measured, and the research and international work of departments stays hard to find.",
    cards: [
      {
        title: "Fragmented updates",
        desc: "Important announcements and events get lost on external platforms ranked by algorithms, not by the institution.",
      },
      {
        title: "Unmeasured reach",
        desc: "The institution cannot tell what was read or who each update actually reached.",
      },
      {
        title: "Underexposed value",
        desc: "The research and international activity of departments and labs stays hard to find.",
      },
    ],
    close:
      "Klorad Campus replaces that with one branded, institutional surface, and makes reach measurable.",
  },

  capabilities: [
    {
      title: "Native-app feel",
      desc: "Lives on the home screen, used every day. Persistent shell, instant tab swaps with skeletons, pull-to-refresh, install to home screen. The same gestures iOS and Android users already trust.",
    },
    {
      title: "Klio, the campus assistant",
      desc: "Ask in plain language: 'which lab has a drone I can use?', 'is there a handball team?', 'is the Leo 200 scanner available anywhere?', 'which universities do we partner with?', 'step-free route to the library', 'what's open for lunch?'. Klio answers with inline source cards that deep link straight into the right surface.",
    },
    {
      title: "White-labelled per university",
      desc: "Each campus is its own tenant. It carries its own name, logo, primary colour, hero, and content. The whole palette derives from one hex, and the theme even tints the mobile browser chrome.",
    },
  ],
  features: [
    {
      title: "Indoor and outdoor wayfinding",
      desc: "Powered by MappedIn. The venue you author once becomes the public viewer. Step-free routes are a first-class toggle, not an afterthought.",
    },
    {
      title: "News, events, clubs, dining",
      desc: "Four content surfaces with bilingual EN and EL authoring, per-row image upload, building-anchored deep links, schedule-ahead publishing, and ICS feed sync.",
    },
    {
      title: "Klio with cited sources",
      desc: "Claude tool-use answers grounded in your campus data. Every mention drops a tappable card to the news post, event, club, dining venue, or directions on the map.",
    },
    {
      title: "Measurable push notifications",
      desc: "Web push is subscribed silently on install, with no account and no identity collected. Every broadcast reports delivery and open analytics, so the institution knows what was read and who it reached.",
    },
    {
      title: "QR-shareable everything",
      desc: "Every state of the map is in the URL: building selected, route configured, step highlighted. Generate a QR for a printed sign and students get the exact same view on tap.",
    },
    {
      title: "Five-minute setup, no developer",
      desc: "Rector dashboard: link your MappedIn venue, set the brand colour, write the welcome copy in EN and EL, publish. The first campus goes live the same morning.",
    },
  ],

  internationalPresence: {
    eyebrow: "International presence",
    title: "Built for international presence.",
    body: "Bilingual is the floor, not the ceiling. Every department, lab, and member can surface international programmes, partnerships, and publications.",
    cards: [
      {
        title: "Departments and schools",
        desc: "International programmes, partnerships, mobility.",
      },
      {
        title: "Labs and researchers",
        desc: "Publications and research activity, systematically surfaced.",
      },
      {
        title: "Partnership network",
        desc: "'Which universities do we partner with' answered in the app, not the registry office.",
      },
      {
        title: "Bilingual EN and EL",
        desc: "On every field, extensible to more languages.",
      },
    ],
  },

  dataHub: {
    eyebrow: "Data hub",
    title: "Your data stays yours, and works for you.",
    body: "Everyday use produces institutional data that stays in your ownership and turns into knowledge for decisions.",
    cards: [
      {
        title: "Activity demand",
        desc: "Which clubs and services draw the most interest.",
      },
      {
        title: "Lab performance",
        desc: "Which labs attract participation and why.",
      },
      {
        title: "Movement patterns",
        desc: "Which routes and spaces are searched most.",
      },
      {
        title: "Evidence for decisions",
        desc: "Data that supports planning and resource allocation.",
      },
    ],
  },

  digitalTwin: {
    eyebrow: "Dynamic digital twin",
    tag: "On the roadmap",
    title: "A living digital twin, not a static map.",
    body: "The campus model is dynamic. With sensors and operational data, it updates over time and supports operational decisions. The capabilities listed below are sensor-dependent and on the roadmap, not shipped today.",
    cards: [
      {
        title: "Usage heatmaps",
        desc: "With sensors, real frequency of use for spaces and routes.",
      },
      {
        title: "Evacuation support",
        desc: "Estimate the real distribution of people, beyond the paper plan.",
      },
      {
        title: "Real-time accessibility",
        desc: "Suggest alternative step-free routes around works.",
      },
      {
        title: "Infrastructure planning",
        desc: "Mapping feeds future interventions and resource optimisation.",
      },
    ],
  },

  credibility: {
    body: "Built on a peer-reviewed architecture (ISPRS Int. J. Geo-Inf., 2025). In production today.",
    cta: { label: "Read the research", href: "/research" },
    image: {
      src: "/research/klorad-system-model.png",
      alt: "Klorad system model architecture: access, world, and integration layers.",
    },
  },

  builtOn:
    "Klorad Campus is a world built on the Klorad platform. It runs on the same World model, the three renderers, and the live-data backbone behind every Klorad product. The same plumbing scales to Mobility, Virtual Heritage, and Urban next.",
  ctaTitle: "Put your campus in your students' pockets.",
};

export default function CampusPage() {
  return <ProductPage data={data} />;
}
