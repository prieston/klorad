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
        "Headline of the news item. Keep close to what the page actually says.",
    },
    body: {
      type: "string",
      description:
        "One to three short paragraphs summarising the item in the page's own voice. Do not invent details.",
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
  required: ["title", "body"],
  additionalProperties: false,
} as const;

const EVENT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Event name." },
    description: {
      type: "string",
      description:
        "Short description of the event in the page's own voice. Do not invent details.",
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
        "Free-text venue (building, room, address). Omit if not stated.",
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
  required: ["title", "description"],
  additionalProperties: false,
} as const;

export const campusExtractorProfile: ExtractorProfile = {
  appKey: "campus",
  systemPrompt:
    "Domain: a Greek higher-education campus consumer surface (news + events). The audience is students and visitors. Greek source text is fine — extract the title and body in the source language; do not translate.",
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
  body: string;
  publishedAt?: string;
  imageUrl?: string;
}

export interface CampusEventExtraction {
  title: string;
  description: string;
  startsAt?: string;
  endsAt?: string;
  location?: string;
  organizer?: string;
  registrationUrl?: string;
  imageUrl?: string;
}
