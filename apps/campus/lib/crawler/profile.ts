/**
 * Campus's registration with `@klorad/crawler` — describes which
 * content types the extractor should look for and the JSON Schema
 * each tool-use call must conform to. Other apps (Mobility, Heritage,
 * Urban) will ship their own profiles with their own schemas; the
 * crawler package stays domain-agnostic.
 */
import type { ExtractorProfile } from "@klorad/crawler";

const NEWS_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Headline in ENGLISH. If the page is Greek, translate; if the page is already English, use it verbatim. Keep close to what the page actually says — do not editorialise.",
    },
    titleEl: {
      type: "string",
      description:
        "Headline in GREEK. If the page is English, translate; if the page is already Greek, use it verbatim.",
    },
    body: {
      type: "string",
      description:
        "Body in ENGLISH — one to three short paragraphs summarising the item in the page's own voice. Translate if the source is Greek. Do not invent details.",
    },
    bodyEl: {
      type: "string",
      description:
        "Body in GREEK — the same content as `body`, translated to Greek (or verbatim when the source is Greek).",
    },
    publishedAt: {
      type: "string",
      description:
        "ISO 8601 datetime the item was published. Omit if you cannot find it on the page.",
    },
    imageUrl: {
      type: "string",
      description:
        "Absolute URL of the hero image, if the page has one. Omit otherwise.",
    },
  },
  required: ["title", "titleEl", "body", "bodyEl"],
  additionalProperties: false,
} as const;

const EVENT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description:
        "Event name in ENGLISH. Translate if the source is Greek, verbatim if already English.",
    },
    titleEl: {
      type: "string",
      description:
        "Event name in GREEK. Translate if the source is English, verbatim if already Greek.",
    },
    description: {
      type: "string",
      description:
        "Description in ENGLISH — short, in the page's own voice. Translate if source is Greek. Do not invent details.",
    },
    descriptionEl: {
      type: "string",
      description:
        "Description in GREEK — same content as `description`, translated to Greek (or verbatim when source is Greek).",
    },
    startsAt: {
      type: "string",
      description:
        "ISO 8601 datetime the event starts. Omit if not clearly stated.",
    },
    endsAt: {
      type: "string",
      description:
        "ISO 8601 datetime the event ends. Omit if not clearly stated.",
    },
    location: {
      type: "string",
      description:
        "Free-text venue (building, room, address). Omit if not stated. Render in the language it appears on the page — locations are usually proper nouns.",
    },
    organizer: {
      type: "string",
      description: "Organising group / club / department. Omit if unclear.",
    },
    registrationUrl: {
      type: "string",
      description:
        "URL the page links for registration / tickets. Omit otherwise.",
    },
    imageUrl: {
      type: "string",
      description:
        "Absolute URL of a hero image for the event. Omit otherwise.",
    },
  },
  required: ["title", "titleEl", "description", "descriptionEl"],
  additionalProperties: false,
} as const;

export const campusExtractorProfile: ExtractorProfile = {
  appKey: "campus",
  systemPrompt: [
    "Domain: a Greek higher-education campus consumer surface (news + events). Audience is students and visitors.",
    "Bilingual output is required on every item — emit both an English (`title`, `body`/`description`) and a Greek (`titleEl`, `bodyEl`/`descriptionEl`) version. If the source is Greek, translate to English for the English fields; if the source is English, translate to Greek for the Greek fields. Keep the same factual content on both sides — translation, not summarisation.",
    "Translate idiomatically (not word-for-word). University-specific jargon (department names, building codes, programme abbreviations) should stay in their canonical form on both sides.",
  ].join("\n\n"),
  schemas: {
    news: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: NEWS_ITEM_SCHEMA,
          description:
            "Every news / announcement / alert item on the page. Empty array is valid.",
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
    event: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: EVENT_ITEM_SCHEMA,
          description:
            "Every event on the page. Empty array is valid.",
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
};

/** Narrowed shapes the approval handlers consume — match the JSON
 *  Schemas above. Anthropic's tool-use enforces the shape at the
 *  call site, but we narrow again here for type safety. */
export interface CampusNewsExtraction {
  title: string;
  titleEl: string;
  body: string;
  bodyEl: string;
  publishedAt?: string;
  imageUrl?: string;
}

export interface CampusEventExtraction {
  title: string;
  titleEl: string;
  description: string;
  descriptionEl: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  organizer?: string;
  registrationUrl?: string;
  imageUrl?: string;
}
