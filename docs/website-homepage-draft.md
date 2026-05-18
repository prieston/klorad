# Klorad — Homepage Draft (copy + layout)

> Status: draft for review · 2026-05-18 · supersedes the "infrastructure operations" homepage
> Purpose: rebuild the homepage to tell the two-layer story — Klorad the platform, the verticals the products.

## Tone & positioning

- Restrained, premium, confident — keep the current visual register (dark, light font weights, generous whitespace, uppercase tracked eyebrow labels).
- Lead with vision, anchor every visionary line with a concrete one.
- Three audiences served in layers: buyers (route to verticals), builders/partners (the engine), credibility (the research).

## Nav change (header)

Current: Platform · Sectors · Industries · Samples · Journal · Partners · Contact
New: **Platform · Products ▾ (Campus / Mobility / Virtual Heritage / Urban) · Worlds · Research · Journal · Contact**
`Sectors` and `Industries` are removed — replaced by the `Products` menu.

---

## Section 1 — Hero

Layout: full-bleed, ambient background (keep `AmbientField`). Eyebrow → H1 → large subhead → one concrete line → two CTAs.

- Eyebrow: `THE KLORAD PLATFORM`
- H1: **Build the virtual worlds of tomorrow.**
- Subhead: Klorad is a geospatial platform for digital twins — a shared foundation that turns real places into living, data-driven worlds.
- Concrete line: Campuses, road networks, cities, heritage sites. One engine beneath them all.
- CTA primary: `Explore the platform`
- CTA secondary: `See what's built on Klorad →`

H1 alternates (pick one):
- A. Build the virtual worlds of tomorrow. *(visionary — honors your phrasing)*
- B. The geospatial platform for living digital twins. *(grounded)*
- C. Klorad turns real places into living digital worlds. *(literal)*

## Section 2 — What Klorad is (the two-layer model)

Layout: centered statement + a simple diagram beneath.

- H2: **Klorad is the foundation. The worlds are the products.**
- Body: Every Klorad product is a digital twin built on the same engine — the same world model, the same geospatial core, the same live-data backbone. We built the hard part once, so each new world doesn't start from zero.
- Diagram:
  ```
                KLORAD  ·  the world engine
     ┌──────────┬──────────┬──────────────────┬──────────┐
     Campus     Mobility   Virtual Heritage     Urban
  ```

## Section 3 — Choose your world (the four verticals)

Layout: 4-card grid (reuse the existing industry grid). Each card: product name · one-line promise · description · link.

- Section H2: **Choose your world.**

- **Klorad Campus** — Campuses people can navigate.
  Indoor and outdoor wayfinding, room-level detail, points of interest — a campus that works as well on a screen as on foot.
  `Explore Klorad Campus →`

- **Klorad Mobility** — Road networks, made legible.
  Corridors, junctions, signaling and ITS telemetry as one continuous environment — see how a decision propagates before it is made.
  `Explore Klorad Mobility →`

- **Klorad Virtual Heritage** — Heritage, reconstructed and understood.
  Sites rebuilt as immersive, interpretable worlds — for preservation, research, and the public.
  `Explore Klorad Virtual Heritage →`

- **Klorad Urban** — Cities and land, as a living model.
  Urban infrastructure and land use unified into one twin — for planning, coordination, and the decisions that shape territory.
  `Explore Klorad Urban →`

## Section 4 — Inside the engine (builders + credibility)

Layout: feature grid (2×3 or 3-col), each item: title · one line.

- H2: **Inside the engine**
- Subhead: One world model. Any way you need to render it.

- **One World model** — A single, engine-agnostic model of scenes, objects, and observations. Define a world once.
- **Three renderers** — Three.js for built scenes, CesiumJS for the geospatial globe and 3D tiles, Mapbox for mapping. Same world, the right renderer.
- **Live data** — IoT and sensor telemetry stream into the world in real time. Twins that move with the thing they mirror.
- **Immersive & XR** — Worlds are XR-ready — explorable on a screen, or stepped into.
- **Multi-tenant** — Organizations, projects, and access control built in from the core.
- **The SDK** — `@klorad/api`: a programmatic scene API with an extension for each vertical. Build your own world on the foundation.

## Section 5 — Worlds built with Klorad (proof)

Layout: gallery strip of sample worlds (reuse `samples-grid`). Links to `/samples`.

- H2: **Worlds built with Klorad**
- Body: A growing collection of digital twins — explore what the platform makes possible.
- CTA: `Browse the gallery →`

## Section 6 — The research behind it (credibility)

Layout: quieter, text-led section.

- H2: **Born from research.**
- Body: Klorad began as a doctoral thesis — a formal model for describing 3D, geospatial worlds on one shared architecture, so each new project would not reinvent the same foundation. The platform is that model, in production.
- CTA: `Read the research →`

## Section 7 — Closing CTA

Layout: two-path closing.

- H2: **Start building your world.**
- Path 1 (buyers): Tell us what you need to model. → `Schedule a demo`
- Path 2 (builders): See how the platform fits together. → `Explore the platform`

## Trust section

Keep the existing "Trusted by leading organizations" strip (Prieston, PSM) — place it directly under the hero or after Section 3.

---

## Open decisions

1. H1 — pick A / B / C above.
2. "Klorad Urban" — one product covering urban infrastructure + land/agriculture, or split agriculture into its own product later?
3. Research page route — `/research` or `/story`.
4. Does the "virtual worlds of tomorrow" register feel right, or too visionary for the enterprise buyers?
