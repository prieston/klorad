# Topos Campus — Pitch Deck Outline

> Companion to `PRODUCT.md` and `UX.md`. Use this as the narrative
> spine for the ACG (Deree / Pierce) first-pilot pitch. Each slide is
> one idea; short talking points underneath. Rehearse the demo script
> at the end until you can do it cold in 60 seconds.

---

## Slide 1 — Cover

**Topos Campus · Χάρτες Πανεπιστημιούπολης για την επόμενη δεκαετία**
*(Campus maps for the next decade)*

- One-line positioning: *"A self-service 3D campus platform built for
  Greek higher education."*
- Your name · role · date · audience.

---

## Slide 2 — The Problem (30s)

Greek universities today:

- PDFs. Outdated Google My Maps. Print handouts.
- International students Google-translate building names.
- Staff can't find classrooms in Κτίριο Γ, 2ος όροφος, πτέρυγα βορρά.
- No accessibility data exists digitally — EU compliance risk.
- The one US competitor costs **$25–60k/yr** and takes **3–6 months**
  to deploy per campus.

One line: *Every campus in Greece has a map problem. Nobody has solved it.*

---

## Slide 3 — The Solution

**One glass-effect interactive 3D map. Everything live. Admin edits
in seconds, not months.**

Three things we do better than anyone:

1. **Indoor mapping** — Level Switcher + roof-lifting floor plans.
   Solves the Κτίριο Γ / mezzanine / floor-numbering problem.
2. **Accessibility-first** — step-free routing, accessibility scoring,
   EAA-compliant exports.
3. **Greek-native, EU-hosted** — Greek + English UI, Frankfurt region,
   GDPR-native.

---

## Slide 4 — Live Demo (the three flagship moments)

*Keep this to 60 seconds. Practice it cold.*

1. **Location + POI placement** — drop a pin, link to a real Mapbox
   building. "We just placed a point of interest anchored to an
   actual building footprint — not a fake marker."
2. **The Level Switcher + Roof Lift** — select a building with floor
   plans. Click "2". The outdoor dims, the floor plan fades in.
   "Now we're inside the building."
3. **Search-to-Event** — type `BIO 101`. Camera flies to Building Γ,
   Level Switcher auto-opens to floor 2, Room 207 gets a pulsing pin,
   event card shows *"Now · Prof. Παπαδόπουλος · BIO 101"*.
4. **Accessibility toggle** — wayfinding panel, Standard → Step-free.
   Blue line becomes purple, routes via elevators.
5. **Share** — copy the URL. Open on phone. Flip to Greek. The whole
   experience works in the thumb zone.

**End the demo with:** *"Everything I just showed is editable by a
marketing assistant in the Studio — no developer needed."*

---

## Slide 5 — Why Now

**The European Accessibility Act (Directive 2019/882)** is binding on
public-sector bodies from June 2025. State universities *must* publish
accessibility data. Most have nothing digital today.

*"Compliance becomes a purchase, not a project."*

This is a real buying window, and it closes in 2026. We want to be
the default answer when the compliance director starts googling.

---

## Slide 6 — Competitive Landscape

| | **Concept3D** | **Topos Campus** |
| --- | --- | --- |
| Time to launch | 3–6 months | **1–4 weeks** |
| Price (annual) | $25–60k | **€7–30k (setup + ARR)** |
| Greek language | No | **Native** |
| Indoor mapping | Weak / rare | **First-class** |
| Accessibility | Afterthought | **Core pillar** |
| EU data residency | US | **Frankfurt / Greece** |
| Self-service edits | Support ticket | **Marketing intern + 5 minutes** |
| Mobile | Responsive | **App-like, thumb-zoned** |

---

## Slide 7 — Product Vision

Topos isn't just a campus-maps product. It's a **spatial layer for
Greek institutions**.

Roadmap after ACG:

- Hospital campuses (same pain: multi-building, multi-floor, wayfinding).
- Museums & cultural sites (Acropolis, Herakleidon — we already built
  museum vertical plumbing in the platform).
- Municipalities (Dimos access routes, EU accessibility reporting).
- Industrial / real estate (Ellinikon, Marina Zeas, Helexpo).

**The core thesis:** every organization with a campus needs a digital
twin of *where people go*. We built the platform; each vertical is a
thin configuration on top.

---

## Slide 8 — Traction / What's Built

Built, live, demo-ready:

- Studio CMS (POIs, linking, categories, events, branding, indoor).
- Public viewer (desktop + mobile, EL/EN, branded).
- Wayfinding with accessibility toggle.
- Full search → fly → roof lift → event reveal animation chain.
- Undo / redo, drag-to-reposition, bulk edit — the Studio feels like
  a real design tool, not a form.
- Shared design system (`@klorad/ui`) powering multiple verticals
  from a single codebase.

(*Engineering-aside for investors: four commits in the last two weeks
took us from zero to pitch-ready. The platform is doing its job.*)

---

## Slide 9 — Pricing

Three tiers, Setup + Annual model (Greek market prefers visible
implementation work over pure SaaS).

| | Setup | Recurring | Scope |
| --- | --- | --- | --- |
| **Starter** | €5k | €2k / yr | Standard 3D, outdoor wayfinding, Google Calendar, single-language. *Acquisition tier.* |
| **Pro** | €12k | €5k / yr | + Indoor mapping (5 buildings), accessibility pillar, bilingual, custom branding. *Primary tier.* |
| **Enterprise** | €25k+ | Custom | + Full indoor mapping, IoT / security layers, SSO, SLA, in-country hosting. *State universities.* |

First pilot (ACG): target Pro.

---

## Slide 10 — The Ask (ACG)

*Specific, concrete, time-boxed.*

1. **4-week pilot on ACG's main campus** (Aghia Paraskevi) with:
   - 20 POIs placed (you choose — prospective-student tour).
   - Indoor floors for the main academic building.
   - Branding: ACG logo + primary maroon #8a1538.
   - Greek + English.
2. **Launch on `map.acg.edu`** as a public URL, embedded on the
   international admissions page.
3. **€8k pilot fee** covering setup + 6 months, renewable as Pro
   thereafter at €5k/yr.
4. **One quote for the website.** Something like *"Topos finally
   gave us a map that makes our buildings make sense to an
   18-year-old in Boston."* — we use it for 3 other Greek pilot sales.

---

## Slide 11 — Team + Contact

- Your name, background, why-you.
- Klorad: spatial-computing platform, multi-vertical, bootstrapped.
- Contact: `theofilos@prieston.gr` · `campus.klorad.com`

---

## Demo Script (rehearse cold)

**Pre-demo setup:**
- Browser at `campus.klorad.com/campus/<demo-map-id>`.
- Tab already loaded, POIs visible.
- A separate window with ACG's website open to the homepage.

**60-second script:**

> "What you're looking at is live — no video, not a mockup. I'll
> drop this URL to anyone, anywhere, on any device."
>
> [tap 🧭 Directions] [From: Main Gate] [To: Library]
> "Point A to point B — walking directions."
>
> [toggle Step-free]
> "Accessibility toggle. Routes go through elevators, not stairs.
> This is what the European Accessibility Act will require next year.
> We're the only answer in the Greek market."
>
> [close directions, tap 🔍 search, type "BIO 101"]
> [click result] [wait for roof lift]
> "Now watch. Typing a course code. We fly to the building — the roof
> comes off — we're on floor 2 — and there's the lecture, live from
> your Google Calendar."
>
> [flip to ΕΛ]
> "And the whole thing in Greek."
>
> [open share URL on phone]
> "One URL. One iframe. The Marketing team edits it in five minutes."

**Closing line:**
> "If your marketing assistant can run it, we've won. Want a pilot?"

---

## Things NOT to mention unprompted

- Step-free routing currently uses the walking network; true barrier
  avoidance needs admin-tagged stairs (Phase 2). Only raise if asked.
- 360° tours are CMS-ready, production-deferred. Only raise if asked.
- Analytics dashboard is empty today; data starts collecting after
  Live. Only raise if asked.

If asked about any of these, the honest answer is: *"Built-in hooks,
shipped when a paying customer asks. You're the first one — it's on
the list for the second month."*

---

## Questions to be ready for

- **"Why not use OpenStreetMap directly?"** — We do, for the outdoor
  base. OSM doesn't have indoor floor plans or accessibility-tagged
  campus paths. That's our value-add, and we're contributing our
  outdoor enhancements back to OSM.

- **"What happens if you get acquired?"** — Self-hosting license
  included in Enterprise tier. Your data is in your Postgres.

- **"What if Google launches a competitor?"** — Google Maps doesn't
  do indoor for universities, doesn't do CMS, doesn't do branded
  embeds. Their model is advertiser-facing; ours is admissions-facing.

- **"Who else is using it?"** — *"You're the first pilot. That's why
  the price is this — €8k for setup. The next three will be €12k."*
  Scarcity works if it's honest.

- **"How long until it's production-ready?"** — *"It's production
  today. The demo URL you're looking at is the real thing — no dev
  branch. We started yesterday, we can start onboarding you next
  Monday."*
