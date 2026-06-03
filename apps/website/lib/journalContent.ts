/**
 * Journal content — sectioned data for /journal: live demos, the
 * publications library, and the research projects the platform grew
 * out of. Previously a flat dated feed; now a curated index of what
 * gets built on Klorad and the work it stands on.
 */

export type LiveDemo = {
  title: string;
  description: string;
  href: string;
};

export type Publication = {
  title: string;
  description: string;
  citation: string;
  href?: string;
};

export type ProjectVideo = {
  /** 11-char YouTube id — used for the privacy-friendly embed. */
  id: string;
  caption: string;
};

export const liveDemos: LiveDemo[] = [
  {
    title: "Flyover digital twin: a visibility study",
    description:
      "A working twin built to answer a real engineering question: do 42 ten-metre lighting poles, spaced 40 metres apart, block the driver's view toward the horizon? We added a PTZ camera at pole height and two more observation points, east and west. First read — no meaningful obstruction; the road's gentle curve means even a small sideways shift of the camera clears it. The same world scales to a full twin with every pole and camera when needed.",
    href: "https://platform.klorad.com/publish/cmk8230t50001k8eho9pbnkav",
  },
  {
    title: "Delos: heritage at scale, on your phone",
    description:
      "A large set of geo-referenced 3D models of Delos, opening straight on a phone without strain — a hint at what the platform handles: city-, country-, even earth-scale data, visualised anywhere. Time and sun position are live, so the scene matches the real hour on site.",
    href: "https://platform.klorad.com/publish/cmhnvpm9v0001nm9er55l7z2b",
  },
  {
    title: "Olympoi, Chios: architectural heritage",
    description:
      "The architectural-heritage settlement of Olympoi in Chios, rendered as a Klorad world.",
    href: "https://platform.klorad.com/publish/cmkgnkiw4002pt9gzx5fe6b4d",
  },
  {
    title: "IoT integration",
    description:
      "A Klorad world wired to live IoT data — sensors feeding the twin in real time.",
    href: "https://platform.klorad.com/publish/cmfybuagj0001qk7mdhl3aytn",
  },
  {
    title: "BIM integration",
    description:
      "BIM data brought inside a Klorad world — building and infrastructure detail living within the geospatial twin.",
    href: "https://platform.klorad.com/publish/cmho0oaum000113xrqhz5d9q6",
  },
];

export const publications: Publication[] = [
  {
    title: "The Metaverse Is Geospatial: A System Model Architecture",
    description:
      "The formal architecture that puts geospatial data at the core of virtual worlds, bridging digital twins, real-time data, and multi-user interaction.",
    citation: "ISPRS Int. J. Geo-Inf., 2025.",
    href: "https://www.mdpi.com/2220-9964/14/3/126",
  },
  {
    title: "Interactions in Augmented and Mixed Reality: An Overview",
    description:
      "A survey and taxonomy of how people interact inside augmented and mixed reality — a map of the field's interaction methods.",
    citation: "Applied Sciences, 2021.",
    href: "https://www.mdpi.com/2076-3417/11/18/8752",
  },
  {
    title:
      "Mixed Reality and the Internet of Things: Bridging the Virtual with the Real",
    description:
      "Connecting mixed-reality environments to live IoT data, so the virtual stays in sync with the physical.",
    citation: "Advances in Engineering Software, 2023.",
    // Awaiting DOI from Google Scholar.
  },
  {
    title:
      "Mixed Reality: A Reconsideration Based on Mixed Objects and Geospatial Modalities",
    description:
      "A rethink of mixed reality framed around mixed objects and geospatial modalities.",
    citation: "Applied Sciences, 2021.",
    href: "https://www.mdpi.com/2076-3417/11/5/2417",
  },
  {
    title:
      "Mergin' Mode: Mixed Reality and Geoinformatics for Monument Demonstration",
    description:
      "Demonstrating monuments by merging real and virtual through mixed reality and geoinformation technologies. See the videos in Projects below.",
    citation: "Applied Sciences, 2020.",
    href: "https://www.mdpi.com/2076-3417/10/11/3826",
  },
  {
    title:
      "3D Geospatial Visualizations: Animation and Motion Effects on Spatial Objects",
    description:
      "How animation and motion change the way spatial objects are read in 3D geospatial scenes.",
    citation: "Computers & Geosciences, 2018.",
    // Awaiting DOI from Google Scholar.
  },
  {
    title:
      "A JavaScript GIS Platform Based on Invocable Geospatial Web Services",
    description:
      "A web GIS platform built on standards-based, invocable geospatial web services.",
    citation: "Geosciences, 2018.",
    href: "https://www.mdpi.com/2076-3263/8/4/139",
  },
  {
    title:
      "Web-GIS Development for Geospatial Data Dissemination in EU Operational Programmes",
    description:
      "Building web-GIS to publish and share geospatial data across EU operational programmes.",
    citation: "European Journal of Geography, 2018.",
    // Awaiting DOI from Google Scholar.
  },
  {
    title:
      "Immersive Mixed Reality Experience Empowered by the Internet of Things and Geospatial Technologies",
    description:
      "An immersive mixed-reality experience driven by IoT and geospatial technologies.",
    citation: "Civil-Comp Press, 2022.",
    // Awaiting DOI from Google Scholar.
  },
  {
    title: "Is There Life in Virtual Globes?",
    description:
      "An early look at the potential — and the limits — of virtual globes.",
    citation: "2016.",
    // Awaiting DOI from Google Scholar.
  },
];

export const merginModeVideos: ProjectVideo[] = [
  { id: "4DWSnpBr7WY", caption: "Mergin' Mode demo (1 of 4)" },
  { id: "qHClsZ9y_a4", caption: "Mergin' Mode demo (2 of 4)" },
  { id: "XXmfeDzG1s0", caption: "Mergin' Mode demo (3 of 4)" },
  { id: "Zls1rD6GYFc", caption: "Mergin' Mode demo (4 of 4)" },
];
