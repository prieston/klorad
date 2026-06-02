/**
 * Single source of truth for upload prefixes used by the campus app.
 *
 * Before this file existed, six different screens passed inline string
 * prefixes to `uploadFile` — three distinct top-level "folders" at the
 * bucket root (`campus-hero/`, `campus-thumbnails/`, `campus-news/`)
 * plus four screens (clubs / news / dining / events) that all dumped
 * into `campus-news/` because the string got copy-pasted between
 * admin clients. The bucket root was a mess and the data was
 * mislabelled.
 *
 * Every campus upload now lives under `campus-app/<surface>/`, named
 * by the public surface the file belongs to. Adding a new upload site
 * is one entry here + one import at the call site.
 *
 * **Existing files are not moved.** Persisted `imageUrl` values in
 * Postgres point at the old keys (`campus-hero/...`, etc.) and those
 * keep working — DO Spaces serves them unchanged. Only *new* uploads
 * land under the new tree. A one-shot migration script can move the
 * old files later if we want a clean bucket; it's intentionally not
 * part of this change.
 */
export const UPLOAD_PREFIXES = {
  /** Hero banner + logo + any tenant-branding asset for a campus. */
  branding: "campus-app/branding",
  /** Auto-captured MappedIn snapshots shown as the campus card thumbnail. */
  thumbnails: "campus-app/thumbnails",
  /** Per-row image on a NewsPost. */
  news: "campus-app/news",
  /** Per-row image on an EventPost. */
  events: "campus-app/events",
  /** Per-row image / avatar on a Club. */
  clubs: "campus-app/clubs",
  /** Per-row image on a DiningLocation. */
  dining: "campus-app/dining",
} as const;

export type UploadPrefix =
  (typeof UPLOAD_PREFIXES)[keyof typeof UPLOAD_PREFIXES];
